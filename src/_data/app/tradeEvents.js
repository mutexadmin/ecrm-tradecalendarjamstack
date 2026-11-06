const { DBSQLClient } = require('@databricks/sql');
const { AssetCache } = require('@11ty/eleventy-fetch');
const entityConvert = require('entity-convert');
const slugify = require('slugify');
const cheerio = require('cheerio');

const markdownIt = require('markdown-it');
const md = new markdownIt({
  breaks: true,
});

const htmlToText = require('html-to-text');

// Allows environment variables to be set in an .env file in project root
// See .env.example for structure and refer to this code for how the
// environment variables are used
require('dotenv').config();

async function fetchData(token, hostName, path, query, cacheLimit) {
  let cacheKey = `${hostName}${path}`;
  let asset = new AssetCache(cacheKey);
  let cacheTime = cacheLimit;

  if (asset.isCacheValid(cacheTime)) {
    // return cached data.
    console.log('Returning cached data');
    return asset.getCachedValue(); // a promise
  }

  if (!token) {
    throw new Error('Null or empty argument for access token value');
  }

  const client = new DBSQLClient();

  console.log('Fetching fresh data');

  await client.connect({
    host: hostName,
    path: path,
    token: token,
  });

  console.log('SQL client connected');

  // databricks-sql is built on top of apache hive.  There are different
  // styles of javascript in play, leading to a mix of promises, event
  // emitters and exceptions.  If an HTTP error happens in openSession
  // it will be silently discarded, unless we wrap the event emitter.
  const session = await new Promise((resolve, reject) => {
    client.on('error', reject).openSession().then(resolve);
  });

  console.log('SQL session opened');

  const queryOperation = await session.executeStatement(query, {
    runAsync: true,
  });

  const result = await queryOperation.fetchAll();

  console.log('Query finished');

  await queryOperation.close();
  await session.close();
  await client.close();
  console.log('SQL operations finished');
  await asset.save(result, 'json');
  console.log('Cache operations finished');
  console.log(result);
  return result;
}

const fetchDbSql = fetchData;

const getChildSector = function (sectorString) {
  return sectorString.split('>')[0].trim();
};

const hasApprover = function (event) {
  return event.Approver;
};

const isPublished = function (event) {
  return event.Publish_Status === 'Completed';
};

const transformRawDescription = function (description) {
  const transformDescription = function (value) {
    //convert bullet list to hyphen
    value = value.replace(/\n\s*•\s*/g, '\n- ');
    // Preventing asterisk with space to turn into a markdown list - issue #33
    value = value.replace(/\*\s/g, '\\* ');
    // Adds space after hyphen on a new line - issue #34
    value = value.replace(/(\n+\s*)-(?!\s)/g, '$1- ');

    return value;
  };

  return entityConvert.html(md.render(transformDescription(description)));
};

// Convert GMT-formatted event dates that may also have times into a consistent YYYY-MM-DD format
const normalizeEventDates = function (eventDate) {
  let date = Date.parse(eventDate);
  const formatter = new Intl.DateTimeFormat('en-ca', { timezone: 'UTC' });
  let formattedParts = formatter.formatToParts(date);
  return formattedParts
    .map(({ type, value }) => {
      switch (type) {
        case 'literal':
          return '-';
        default:
          return value;
      }
    })
    .join('');
};
const normalizeTime = function (eventDate) {
  let date = Date.parse(eventDate);
  const formatter = new Intl.DateTimeFormat('en-ca', {
    timezone: 'UTC',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  });
  let formattedParts = formatter.formatToParts(date);
  return formattedParts
    .map(({ type, value }) => {
      switch (type) {
        case 'literal':
          return ':';
        default:
          return value;
      }
    })
    .join('');
};
// Return a representation of the
const getSortableEventDate = function (eventDate) {
  return Date.parse(eventDate);
};

module.exports = async function () {
  const adbInstance = process.env.ADB_INSTANCE || 'prod';
  const token = adbInstances[adbInstance].token;
  const hostname = adbInstances[adbInstance].hostname;
  const path = adbInstances[adbInstance].path;
  const query = adbInstances[adbInstance].query;
  const cacheLimit = '24h';
  const tradeEventDataRaw = await fetchDbSql(
    token,
    hostname,
    path,
    query,
    cacheLimit
  );

  // Existing code for processing tradeEventDataRaw
  const tradeEventData = tradeEventDataRaw
    .map((event) => {
      const modifiedEvent = { ...event };

      modifiedEvent.sector = getChildSector(event['Sector_for_Public_Events']);
      modifiedEvent.sector_fr = getChildSector(
        event['Sector_for_Public_Events_French']
      );

      modifiedEvent.market = event.Market_for_Public_Events;
      modifiedEvent.market_fr = event.Market_for_Public_Events_French;

      modifiedEvent.id = event['Events[Event]'];

      const convertDynamicsPlainText = function (value) {
        return entityConvert.html(value);
      };

      const convertDynamicsRichText = function (value) {
        const $ = cheerio.load(value);

        $('a').replaceWith(function () {
          return $(this).text();
        });

        let converted = $.root().html();

        let richText = htmlToText.convert(converted, {
          wordwrap: null,
          ignoreHref: false,
          ignoreImage: true,
        });

        return entityConvert.html(richText);
      };

      function truncate(content) {
        const normalizedContent = content.replace(/\s{2,}/g, ' ').trim(); // Replace multiple spaces with a single space

        if (normalizedContent.length <= 360) {
          return normalizedContent;
        }

        const sentences = normalizedContent.match(/[^.!?]+[.!?]*(?= |\n|$)/g);
        let truncated = '';
        let i = 0;

        while (
          i < sentences.length &&
          truncated.length + sentences[i].length <= 360
        ) {
          if (truncated.length + sentences[i].length >= 330) {
            truncated += sentences[i].trim();
            break;
          }
          truncated += sentences[i].trim();
          i++;
          if (i < sentences.length) {
            truncated += ' ';
          }
        }

        // If no sentence ending was found within the 330-360 character range, truncate at 360 characters
        if (truncated.length < 330) {
          truncated = normalizedContent.substring(0, 360);
          let lastSpace = truncated.lastIndexOf(' ');
          if (lastSpace > 330) {
            // Only truncate at the last space if it's after the 330-character limit
            truncated = truncated.substring(0, lastSpace);
          }
        }

        // Add ellipsis if the content has been truncated
        if (truncated.length < normalizedContent.length) {
          truncated += '...';
        }

        return truncated;
      }

      const sanitizeTags = function (value) {
        const $ = cheerio.load(value);
        $('[style]').removeAttr('style');

        // Remove all tags and only keep the following
        const keepTags = new Set([
          'p',
          'ul',
          'ol',
          'li',
          'a',
          'abbr',
          'strong',
          'u',
          'br',
        ]);
        $('*')
          .filter((index, element) => !keepTags.has(element.name))
          .replaceWith((index, element) => $(element).contents());

        const sanitizedDescription = $.html();
        return sanitizedDescription;
      };

      if (event.Description.startsWith('<')) {
        // Rich Text
        modifiedEvent.description = sanitizeTags(
          event.Description
        );
        modifiedEvent.description_fr = sanitizeTags(
          event.Description_French
        );
        modifiedEvent.summaryDescription = truncate(
          convertDynamicsRichText(event.Description)
        );
        modifiedEvent.summaryDescription_fr = truncate(
          convertDynamicsRichText(event.Description_French)
        );
      } else {
        // Plain Text
        modifiedEvent.description = sanitizeTags(transformRawDescription(event.Description));
        modifiedEvent.description_fr = sanitizeTags(transformRawDescription(
          event.Description_French
        ));
        modifiedEvent.summaryDescription = truncate(
          convertDynamicsPlainText(event.Description)
        );
        modifiedEvent.summaryDescription_fr = truncate(
          convertDynamicsPlainText(event.Description_French)
        );
      }

      modifiedEvent.start_date = normalizeEventDates(event.Event_Start_Date);
      modifiedEvent.end_date = normalizeEventDates(event.Event_End_Date);
      modifiedEvent.start_time = normalizeTime(event.Event_Start_Date);
      modifiedEvent.end_time = normalizeTime(event.Event_End_Date);
      modifiedEvent.start_date_epoch = getSortableEventDate(
        event.Event_Start_Date
      );
      modifiedEvent.end_date_epoch = getSortableEventDate(event.Event_End_Date);
      modifiedEvent.published_date = getSortableEventDate(event.Approval_Date);
      modifiedEvent.updated_date = getSortableEventDate(event.Modified_On);
      modifiedEvent.current_epoch = Date.now();
      modifiedEvent.title = event['Event_Name'];
      modifiedEvent.title_fr = event['Event_Name_French'];
      modifiedEvent.slug = slugify(
        modifiedEvent.title + '-' + modifiedEvent.id.substring(0, 3),
        { lower: true, strict: true, locale: 'en' }
      );
      modifiedEvent.slug_fr = slugify(
        modifiedEvent.title_fr + '-' + modifiedEvent.id.substring(0, 3),
        { lower: true, strict: true, locale: 'fr' }
      );
      return modifiedEvent;
    })

    // Filter out or flag any records based on their data
    .filter((event) => {
      // Filter unapproved events
      if (!hasApprover(event)) {
        console.warn(
          `Filtered out event with id ${event.id} from record set used to build application - no approver`
        );
        return false;
      }
      // Warning for events that are not published (may become a filter)
      if (!isPublished(event)) {
        console.warn(
          `Warning for event with id ${event.id} - published status is not Complete`
        );
      }
      // Warnings for empty record fields here
      let flagEmptyFields = [
        'Description_French',
        'Event_Name_French',
        'Organizer_Ministry_French',
      ];
      flagEmptyFields.forEach(function (field) {
        if (event[field] === '' || !event[field]) {
          console.warn(
            `Warning for event with id ${event.id} - ${field} is empty, null, or non-truthy`
          );
        }
      });
      return true;
    });
  return tradeEventData;
};

const adbInstances = {
  uat: {
    hostname: 'adb-1266957567140292.12.azuredatabricks.net',
    path: '/sql/1.0/warehouses/e83a97cd72cdcf3b',
    query: 'select * from ecrm.ecrm_tradecalendar_uat.ecrmexportgrowthevent',
    token:
      process.env.GSIC_WAREHOUSE_TOKEN_UAT || process.env.GSIC_WAREHOUSE_TOKEN,
  },
  prod: {
    hostname: 'adb-1030457547327364.4.azuredatabricks.net',
    path: '/sql/1.0/warehouses/173e0afe3eb5e442',
    query: 'select * from ecrm.ecrm_tradecalendar_prod.ecrmExportGrowthEvent',
    token:
      process.env.GSIC_WAREHOUSE_TOKEN_PROD || process.env.GSIC_WAREHOUSE_TOKEN,
  },
};
