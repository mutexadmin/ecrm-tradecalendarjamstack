const { DBSQLClient } = require('@databricks/sql');
const { AssetCache } = require('@11ty/eleventy-fetch');

async function fetchData(token, hostName, path, query) {
  if (!token) {
    throw new Error('Null or empty argument for access token value');
  }

  const client = new DBSQLClient();

  let cacheKey = `${hostName}${path}`;
  let asset = new AssetCache(cacheKey);

  if (asset.isCacheValid('30m')) {
    // return cached data.
    console.log('Returning cached data');
    return asset.getCachedValue(); // a promise
  }

  console.log('Fetching fresh data');

  await client.connect({
    host: hostName,
    path: path,
    token: token,
  });

  console.log('SQL client connected');

  const session = await client.openSession();

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

  return result;
}

module.exports = fetchData;
