module.exports = function () {
  var userFriendlyEnvString = {
    dev: 'development',
    stage: 'staging',
    prod: 'production',
  };

  var siteRootEnvs = {
    dev: '',
    stage: '',
    prod: '',
  };

  var useApplicationHeader = false;

  var footerType = 'default';
  const googleTagManagerID = 'GTM-5NDTCPCS';

  // Relative to siteRoot
  var assetsPath = '/international-trade-events-calendar/assets';

  return {
    userFriendlyEnvString: userFriendlyEnvString,
    useApplicationHeader: useApplicationHeader,
    siteRootEnvs: siteRootEnvs,
    footerType: footerType,
    assetsPath: assetsPath,
    googleTagManagerID: googleTagManagerID,
  };
};

