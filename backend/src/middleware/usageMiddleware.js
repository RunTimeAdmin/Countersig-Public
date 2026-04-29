/**
 * Usage Tracking Middleware
 * Tracks API calls per org per day using Redis counters.
 * Fire-and-forget — never blocks or crashes the request pipeline.
 */

const { getRedisClient } = require('../models/redis');

function usageMiddleware(req, res, next) {
  // Increment counter after the response is sent
  res.on('finish', () => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return;

      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const key = `usage:${orgId}:${date}:api_calls`;

      const redis = getRedisClient();
      if (redis) {
        redis.incr(key).catch(() => {});
        // Set TTL of 48 hours if it's a new key
        redis.expire(key, 172800).catch(() => {});
      }
    } catch (err) {
      // Never let usage tracking crash the request
    }
  });
  next();
}

module.exports = { usageMiddleware };
