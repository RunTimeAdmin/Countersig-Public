const { pool } = require('../models/db');
const { TIER_LIMITS } = require('./billingMeter');
const { getLogger } = require('../utils/logger');

/**
 * Creates quota enforcement middleware.
 * Returns 429 if the org has exceeded their monthly limit for this operation type.
 * Usage: router.post('/attest', authenticate, enforceQuota('attestation'), handler)
 */
function enforceQuota(operationType) {
  return async (req, res, next) => {
    try {
      const orgId = req.user?.orgId;

      // No org context = no quota enforcement (e.g. public endpoints)
      if (!orgId) return next();

      // Get org tier (default to free)
      const planResult = await pool.query(
        'SELECT tier, current_period_start FROM org_plans WHERE org_id = $1',
        [orgId]
      );
      const tier = planResult.rows[0]?.tier || 'free';
      const limits = TIER_LIMITS[tier];

      if (!limits) return next(); // Unknown tier, allow

      const limit = limits[operationType];
      if (limit === Infinity) return next(); // Enterprise = unlimited

      // Count usage this period
      const periodStart = planResult.rows[0]?.current_period_start || getMonthStart();

      const usageResult = await pool.query(
        `SELECT COUNT(*) as count FROM billing_events 
         WHERE org_id = $1 AND operation_type = $2 AND created_at >= $3`,
        [orgId, operationType, periodStart]
      );
      const currentUsage = parseInt(usageResult.rows[0].count, 10);

      if (currentUsage >= limit) {
        return res.status(429).json({
          error: 'Quota exceeded',
          message: `Monthly ${operationType} limit reached (${limit}). Upgrade your plan at https://agentidapp.com/settings.`,
          usage: { current: currentUsage, limit, operationType, tier },
        });
      }

      // Attach usage info for downstream use
      req.billingUsage = { current: currentUsage, limit, tier, operationType };

      // Add usage headers
      res.set('X-RateLimit-Limit', String(limit));
      res.set('X-RateLimit-Remaining', String(Math.max(0, limit - currentUsage - 1)));

      next();
    } catch (err) {
      getLogger().error({ err, orgId: req.user?.orgId, operationType }, '[quota-enforcement] CRITICAL - Quota check failed, allowing request');
      // Fail open: don't block requests if billing check fails
      next();
    }
  };
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

module.exports = { enforceQuota };
