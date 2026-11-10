// Fills Eleventy's local cache with trade events read directly from
// Dynamics 365, bypassing the GSIC data warehouse. For local testing only.
//
// Add these lines to .env (the file git ignores) and fill them in:
//   DYN_URL=https://gsic-ecrm-uat.crm3.dynamics.com
//   DYN_TENANT_ID=<Azure AD tenant id of the Ontario tenant>
//   DYN_CLIENT_ID=<app registration client id>
//   DYN_CLIENT_SECRET=<client secret>
//
// Then run from the project root:
//   node util\fetch-from-dynamics.js
//   npx.cmd eleventy --serve
//
// The rows are stored under the same cache key the build uses for the
// warehouse (uat or prod, from ADB_INSTANCE), so the build picks them up
// without any code changes. The cache lasts 24 hours; run this again to
// refresh. Delete the .cache folder to go back to warehouse data.

const path = require('path');
require('dotenv').config();
const { AssetCache } = require(path.join(
  process.cwd(),
  'node_modules/@11ty/eleventy-fetch'
));
const slugify = require(path.join(process.cwd(), 'node_modules/slugify'));

// Must match adbInstances in src/_data/app/tradeEvents.js
const cacheKeys = {
  uat: 'adb-1266957567140292.12.azuredatabricks.net/sql/1.0/warehouses/e83a97cd72cdcf3b',
  prod: 'adb-1030457547327364.4.azuredatabricks.net/sql/1.0/warehouses/173e0afe3eb5e442',
};

const FORMATTED = '@OData.Community.Display.V1.FormattedValue';

// Dynamics field -> column name the build expects (see tradeEvents.js).
// Lookups and option sets are read through their formatted (display) value.
const fieldMap = {
  'Events[Event]': 'msevtmgt_eventid',
  Event_Name: 'msevtmgt_name',
  Event_Name_French: 'gsic_eventnamefrench',
  Description: 'msevtmgt_description',
  Description_French: 'gsic_descriptionfrench',
  Sector_for_Public_Events: 'gsic_sectorforpublicevents',
  Sector_for_Public_Events_French: 'gsic_sectorforpubliceventsfrench',
  Market_for_Public_Events: 'gsic_marketforpublicevents',
  Market_for_Public_Events_French: 'gsic_marketforpubliceventsfrench',
  Event_Start_Date: 'msevtmgt_eventstartdate',
  Event_End_Date: 'msevtmgt_eventenddate',
  Approval_Date: 'gsic_approvaldate',
  Modified_On: 'modifiedon',
  Approver: 'gsic_approver',
  Publish_Status: 'msevtmgt_publishstatus',
  Organizer_Ministry: 'gsic_eventorganizersministry',
  Organizer_Ministry_French: 'gsic_eventorganizersministry_fr',
  Organizer_Contact_Email: 'gsic_eventorganizerscontactemail',
  Organizer_Contact_Number: 'gsic_eventhelpnumber',
  Owner: 'ownerid',
  Sign_Up_URL: 'msevtmgt_publiceventurl',
  Sign_Up_URL_French: 'etc_eventurlfr',
};

// Reads a field whether Dynamics returned it as a plain value, a lookup
// (_name_value + formatted value) or an option set (number + formatted value).
function readField(record, name) {
  const lookupKey = `_${name}_value`;
  if (lookupKey in record) {
    return record[`${lookupKey}${FORMATTED}`] ?? record[lookupKey] ?? null;
  }
  if (`${name}${FORMATTED}` in record) {
    return record[`${name}${FORMATTED}`];
  }
  return record[name] ?? null;
}

// The build (tradeEvents.js) crashes if any of these is missing, so events
// without them are left out, as the warehouse rows always have them.
const requiredColumns = [
  'Events[Event]',
  'Event_Name',
  'Description',
  'Sector_for_Public_Events',
  'Market_for_Public_Events',
  'Event_Start_Date',
  'Event_End_Date',
];

function toWarehouseRow(record) {
  const row = {};
  for (const [column, field] of Object.entries(fieldMap)) {
    row[column] = readField(record, field);
  }
  // Empty text columns become '' so the build's string handling doesn't
  // trip over null (it already warns about empty French fields).
  for (const column of Object.keys(fieldMap)) {
    if (row[column] == null && !requiredColumns.includes(column)) {
      row[column] = '';
    }
  }
  return row;
}

function missingColumns(row) {
  return requiredColumns.filter((c) => row[c] == null || row[c] === '');
}

// The build makes each event's page address from its name plus the first 3
// characters of its id (see tradeEvents.js), and stops if two events get
// the same address. Returns the addresses the build would use for a row.
function pageSlugs(row) {
  const suffix = '-' + row['Events[Event]'].substring(0, 3);
  return [
    slugify(row.Event_Name + suffix, { lower: true, strict: true, locale: 'en' }),
    slugify(row.Event_Name_French + suffix, { lower: true, strict: true, locale: 'fr' }),
  ];
}

async function getToken({ url, tenantId, clientId, clientSecret }) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: `${url}/.default`,
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: 'POST', body }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Sign-in failed: ${json.error} - ${json.error_description}`);
  }
  return json.access_token;
}

async function fetchEvents(url, token) {
  // No $select: every field comes back, and lookups arrive as _name_value
  // with their display text in the formatted-value annotation.
  let next =
    `${url}/api/data/v9.2/msevtmgt_events` +
    `?$filter=statecode eq 0` +
    `&$orderby=modifiedon desc`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    Prefer: 'odata.include-annotations="*"',
  };
  const records = [];
  while (next) {
    const res = await fetch(next, { headers });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(
        `Dynamics query failed (${res.status}): ${JSON.stringify(json.error || json)}`
      );
    }
    records.push(...json.value);
    next = json['@odata.nextLink'];
  }
  return records;
}

async function main() {
  const config = {
    url: (process.env.DYN_URL || '').replace(/\/$/, ''),
    tenantId: process.env.DYN_TENANT_ID,
    clientId: process.env.DYN_CLIENT_ID,
    clientSecret: process.env.DYN_CLIENT_SECRET,
  };
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => 'DYN_' + k.replace(/([A-Z])/g, '_$1').toUpperCase());
  if (missing.length) {
    throw new Error(`Missing in .env: ${missing.join(', ')}`);
  }

  const instance = process.env.ADB_INSTANCE || 'prod';
  const cacheKey = cacheKeys[instance];
  if (!cacheKey) throw new Error(`Unknown ADB_INSTANCE '${instance}'`);

  console.log(`Signing in to ${config.url} ...`);
  const token = await getToken(config);
  console.log('Reading events ...');
  const records = await fetchEvents(config.url, token);
  console.log(`Dynamics returned ${records.length} active event(s).`);

  const allRows = records.map(toWarehouseRow);

  // Warn about fields that came back empty for every event: usually a wrong
  // field name in fieldMap above.
  for (const column of Object.keys(fieldMap)) {
    if (allRows.length && allRows.every((r) => r[column] == null || r[column] === '')) {
      console.warn(`Warning: '${column}' (${fieldMap[column]}) is empty for every event`);
    }
  }

  const rows = [];
  const seenSlugs = new Map();
  console.log('\nSkipped:');
  let skipped = 0;
  for (const r of allRows) {
    const label = r.Event_Name || r['Events[Event]'];
    const missing = missingColumns(r);
    if (missing.length) {
      skipped++;
      console.log(`  ${label} - missing ${missing.join(', ')}`);
      continue;
    }
    const clash = pageSlugs(r).find((s) => seenSlugs.has(s));
    if (clash) {
      skipped++;
      console.log(
        `  ${label} - would get the same page address '${clash}' as '${seenSlugs.get(clash)}'`
      );
      continue;
    }
    pageSlugs(r).forEach((s) => seenSlugs.set(s, label));
    rows.push(r);
  }
  if (!skipped) console.log('  (none)');

  console.log('\nSaved to cache:');
  for (const r of rows) {
    console.log(
      `  ${r.Event_Name} | start ${r.Event_Start_Date} | approver ${r.Approver} | status ${r.Publish_Status}`
    );
  }

  await new AssetCache(cacheKey).save(rows, 'json');
  console.log(`\nSaved ${rows.length} event(s) to the local cache for '${instance}' (${skipped} skipped).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
