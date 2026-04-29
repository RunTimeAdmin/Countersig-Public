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
    enableOfflineQueue: true,
    connectTimeout: 5000,
    commandTimeout: 10000
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

/**
 * Delete multiple keys from cache using a Redis pipeline
 * @param {string[]} keys - Cache keys to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteCacheMulti(keys) {
  if (!keys || keys.length === 0) return true;
  try {
    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }
    await pipeline.exec();
    return true;
  } catch (err) {
    console.error('Redis multi-delete error:', err.message);
    return false;
  }
}

/**
 * Set multiple keys in cache using a Redis pipeline
 * @param {Array<{key: string, value: any, ttl?: number}>} entries - Cache entries
 * @returns {Promise<boolean>} - Success status
 */
async function setCacheMulti(entries) {
  if (!entries || entries.length === 0) return true;
  try {
    const pipeline = redis.pipeline();
    for (const { key, value, ttl } of entries) {
      const strValue = JSON.stringify(value);
      if (ttl) {
        pipeline.setex(key, ttl, strValue);
      } else {
        pipeline.set(key, strValue);
      }
    }
    await pipeline.exec();
    return true;
  } catch (err) {
    console.error('Redis multi-set error:', err.message);
    return false;
  }
}

/**
 * Get Redis connection health metrics
 * @returns {Object} Redis status info
 */
function getRedisMetrics() {
  return {
    status: redis.status,
    connected: redis.status === 'ready',
  };
}

module.exports = {
  redis,
  getCache,
  setCache,
  deleteCache,
  deleteCacheMulti,
  setCacheMulti,
  getRedisMetrics
};
