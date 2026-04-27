/**
 * Redis client for caching
 * Uses the 'ioredis' package
 */

const Redis = require('ioredis');
const config = require('../config');

// Create Redis client instance
const redis = new Redis(config.redisUrl, {
  // Retry strategy for connection failures
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Maximum retries before giving up
  maxRetriesPerRequest: 3,
  // Enable offline queue to buffer commands during reconnection
  enableOfflineQueue: true
});

// Handle connection events
redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
  // Don't crash - Redis is a cache, not critical for operation
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Parsed value or null
 */
async function getCache(key) {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('Redis getCache error:', err.message);
    return null;
  }
}

/**
 * Set a value in cache with optional TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>} - Success status
 */
async function setCache(key, value, ttlSeconds) {
  try {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, stringValue);
    } else {
      await redis.set(key, stringValue);
    }
    return true;
  } catch (err) {
    console.error('Redis setCache error:', err.message);
    return false;
  }
}

/**
 * Delete a key from cache
 * @param {string} key - Cache key to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteCache(key) {
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.error('Redis deleteCache error:', err.message);
    return false;
  }
}

module.exports = {
  redis,
  getCache,
  setCache,
  deleteCache
};
