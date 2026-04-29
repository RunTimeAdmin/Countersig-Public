/**
 * Plan Enforcement Middleware
 * Checks org usage against billing plan limits.
 * Fails open — if the check errors out, the request is allowed through.
 */

const { query } = require('../models/db');
const { getCache, setCache, getRedisClient } = require('../models/redis');
const { getLogger } = require('../utils/logger');

/**
 * Fetch plan limits, cached in Redis for 5 minutes.
 * @param {string} planId - Plan identifier (free/pro/business)
 * @returns {Promise<Object|null>}
 */
async function getPlanLimits(planId) {
  const cacheKey = `plan_limits:${planId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached; // getCache already JSON-parses

  const result = await query('SELECT * FROM billing_plans WHERE id = $1', [planId]);
  if (!result.rows.length) return null;

  const plan = result.rows[0];
  await setCache(cacheKey, plan, 300); // 5 min TTL — setCache handles stringify
  return plan;
}

/**
 * Gather current usage counters for an org.
 * @param {string} orgId
 * @returns {Promise<{apiCalls: number, agentCount: number, webhookCount: number}>}
 */
async function getOrgUsage(orgId) {
  const date = new Date().toISOString().slice(0, 10);

  // Get API call count from Redis
  let apiCalls = 0;
  try {
    const redis = getRedisClient();
    if (redis) {
      const count = await redis.get(`usage:${orgId}:${date}:api_calls`);
      apiCalls = parseInt(count || '0', 10);
    }
  } catch (err) { /* fallback to 0 */ }

  // Get agent count from DB
  const agentResult = await query(
    'SELECT COUNT(*) as count FROM agent_identities WHERE org_id = $1 AND deleted_at IS NULL',
    [orgId]
  );
  const agentCount = parseInt(agentResult.rows[0]?.count || '0', 10);

  // Get webhook count from DB
  const webhookResult = await query(
    'SELECT COUNT(*) as count FROM webhooks WHERE org_id = $1 AND enabled = true',
    [orgId]
  );
  const webhookCount = parseInt(webhookResult.rows[0]?.count || '0', 10);

  return { apiCalls, agentCount, webhookCount };
}

/**
 * Express middleware — enforces billing plan limits.
 * Runs asynchronously; fails open on error.
 */
function planEnforcement(req, res, next) {
  const orgId = req.user?.orgId;
  const orgPlan = req.user?.plan || 'free';

  if (!orgId) return next();

  getPlanLimits(orgPlan).then(async (limits) => {
    if (!limits) return next();

    const usage = await getOrgUsage(orgId);

    // Check API call limit
    if (usage.apiCalls >= limits.max_api_calls_daily) {
      return res.status(429).json({
        error: 'Plan limit exceeded',
        limit: 'api_calls_daily',
        current: usage.apiCalls,
        max: limits.max_api_calls_daily,
        plan: orgPlan,
        upgrade_url: 'https://agentidapp.com/pricing'
      });
    }

    next();
  }).catch((err) => {
    // Fail open — allow the request through
    const logger = getLogger();
    logger.warn({ err, orgId }, 'Plan enforcement check failed, allowing request');
    next();
  });
}

module.exports = { planEnforcement, getPlanLimits, getOrgUsage };
