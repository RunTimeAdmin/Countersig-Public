/**
 * Data Residency Middleware
 * Adds data residency headers and logs compliance events for audit trail.
 * Must never crash requests — always fails silently.
 */

const { getLogger } = require('../utils/logger');

const DATA_REGIONS = {
  'us-east-1': { label: 'US East (Virginia)', country: 'US' },
  'eu-west-1': { label: 'EU West (Ireland)', country: 'IE' },
  'ap-southeast-1': { label: 'Asia Pacific (Singapore)', country: 'SG' }
};

/**
 * Middleware that adds data residency headers and logs compliance events.
 * Runs after authentication so req.user is available.
 */
function dataResidencyMiddleware(req, res, next) {
  try {
    // Only apply for authenticated org-scoped requests
    const orgRegion = req.user?.dataRegion || 'us-east-1';
    const regionInfo = DATA_REGIONS[orgRegion] || DATA_REGIONS['us-east-1'];

    // Add data residency headers
    res.setHeader('X-Data-Region', orgRegion);
    res.setHeader('X-Data-Country', regionInfo.country);

    // Log data access for compliance audit trail (on response finish)
    if (req.method !== 'GET' && req.user?.orgId) {
      res.on('finish', () => {
        try {
          const logger = getLogger();
          logger.info({
            type: 'compliance_access',
            orgId: req.user.orgId,
            dataRegion: orgRegion,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            userId: req.user.userId
          }, 'Data access event');
        } catch (err) { /* never crash on logging */ }
      });
    }
  } catch (err) { /* never crash on middleware failure */ }

  next();
}

module.exports = { dataResidencyMiddleware, DATA_REGIONS };
