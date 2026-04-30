const { pool } = require('../models/db');
const { getLogger } = require('../utils/logger');

// Tier limits per monthly period
const TIER_LIMITS = {
  free:         { attestation: 100, verification: 50, credential_fetch: 500, token_issuance: 100 },
  starter:      { attestation: 5000, verification: 1000, credential_fetch: 10000, token_issuance: 1000 },
  professional: { attestation: 50000, verification: 10000, credential_fetch: 100000, token_issuance: 10000 },
  enterprise:   { attestation: Infinity, verification: Infinity, credential_fetch: Infinity, token_issuance: Infinity },
};

/**
 * Creates metering middleware that logs a billable event.
 * Usage: router.post('/attest', authenticate, meterEvent('attestation'), handler)
 */
function meterEvent(operationType) {
  return (req, res, next) => {
    // Fire-and-forget: log the billing event asynchronously
    const orgId = req.user?.orgId || null;
    const apiKeyId = req.user?.apiKeyId || null;
    const userId = req.user?.id || null;
    const endpoint = req.originalUrl;

    pool.query(
      'INSERT INTO billing_events (org_id, api_key_id, user_id, operation_type, endpoint) VALUES ($1, $2, $3, $4, $5)',
      [orgId, apiKeyId, userId, operationType, endpoint]
    ).catch(err => {
      getLogger().error({ err }, '[billing-meter] Failed to log event');
    });

    next();
  };
}

module.exports = { meterEvent, TIER_LIMITS };
