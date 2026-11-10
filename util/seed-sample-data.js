// Fills Eleventy's local cache with made-up trade events so the site can be
// built without a Databricks token. Run from the project root:
//   node util/seed-sample-data.js
// The cache lasts 24 hours (see cacheLimit in src/_data/app/tradeEvents.js);
// run this again if the "access token" error comes back.
const path = require('path');
const { AssetCache } = require(path.join(process.cwd(), 'node_modules/@11ty/eleventy-fetch'));

// Must match the prod entry of adbInstances in src/_data/app/tradeEvents.js
const cacheKey = 'adb-1030457547327364.4.azuredatabricks.net/sql/1.0/warehouses/173e0afe3eb5e442';

const day = 24 * 60 * 60 * 1000;
const dateFromToday = (days) => new Date(Date.now() + days * day).toISOString();

const event = (id, days, length, name, nameFr, sector, sectorFr, market, marketFr, description, descriptionFr) => ({
  'Events[Event]': id,
  Event_Name: name,
  Event_Name_French: nameFr,
  Description: description,
  Description_French: descriptionFr,
  Sector_for_Public_Events: sector,
  Sector_for_Public_Events_French: sectorFr,
  Market_for_Public_Events: market,
  Market_for_Public_Events_French: marketFr,
  Event_Start_Date: dateFromToday(days),
  Event_End_Date: dateFromToday(days + length),
  Approval_Date: dateFromToday(-30),
  Modified_On: dateFromToday(-1),
  Approver: 'Sample Approver',
  Publish_Status: 'Completed',
  Organizer_Ministry: 'Ministry of Economic Development, Job Creation and Trade',
  Organizer_Ministry_French: 'Ministère du Développement économique, de la Création d’emplois et du Commerce',
  Organizer_Contact_Email: 'sample@example.com',
  Organizer_Contact_Number: '555-555-0100',
  Owner: 'Sample Contact',
  Sign_Up_URL: 'https://example.com/register',
  Sign_Up_URL_French: 'https://example.com/inscription',
});

const events = [
  event('a11-sample', 14, 3, 'SAMPLE Trade Mission to Germany', 'EXEMPLE Mission commerciale en Allemagne',
    'Automotive', 'Automobile', 'Europe', 'Europe',
    'A plain text sample description.\n\nThis is the second paragraph.\n\n* First item\n* Second item',
    'Un exemple de description en texte brut.\n\nCeci est le deuxième paragraphe.'),
  event('b22-sample', 45, 0, 'SAMPLE Exporter Education Webinar', 'EXEMPLE Webinaire pour les exportateurs',
    'Information Technology', 'Technologie de l’information', 'Asia', 'Asie',
    '<p>A <strong>rich text</strong> sample description.</p><ul><li>First item</li><li>Second item</li></ul>',
    '<p>Un exemple de description en <strong>texte enrichi</strong>.</p>'),
  event('c33-sample', 90, 2, 'SAMPLE Agri-Food Buyers Mission', 'EXEMPLE Mission d’acheteurs agroalimentaires',
    'Agri-Food', 'Agroalimentaire', 'United States', 'États-Unis',
    'A sample event further in the future.', 'Un exemple d’événement plus lointain.'),
  event('d44-sample', -20, 1, 'SAMPLE Past Event', 'EXEMPLE Événement passé',
    'Automotive', 'Automobile', 'Asia', 'Asie',
    'A sample event in the past, with no Register button.', 'Un exemple d’événement passé.'),
];

new AssetCache(cacheKey).save(events, 'json').then(() => {
  console.log(`Saved ${events.length} sample events to the local cache.`);
});
