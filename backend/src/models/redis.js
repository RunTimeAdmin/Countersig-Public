/**
 * Redis client for caching
 * Uses the 'ioredis' package
 */

const Redis = require('ioredis');
const config = require('../config');

// Parse Redis connection options from URL or individual env vars
function getRedisOptions() {
  const baseOptions = {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true
  };

  // Prefer explicit host/port/password if available
  if (config.redisHost) {
    return {
      host: config.redisHost,
      port: config.redisPort || 6379,
      password: config.redisPassword || undefined,
      ...baseOptions
    };
  }

  // Parse REDIS_URL manually to avoid ioredis URL parsing issues
  const url = config.redisUrl;
  if (url && url !== 'redis://localhost:6379') {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        ...baseOptions
      };
    } catch (e) {
      console.warn('Failed to parse REDIS_URL, falling back to defaults:', e.message);
    }
  }

  return { host: 'localhost', port: 6379, ...baseOptions };
}

// Create Redis client instance
const redisOpts = getRedisOptions();
console.log(`Redis connecting to ${redisOpts.host}:${redisOpts.port}`);
const redis = new Redis(redisOpts);

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
