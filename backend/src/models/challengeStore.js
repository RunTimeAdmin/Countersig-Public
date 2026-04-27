/**
 * ChallengeStore - Redis-backed storage with in-memory fallback
 * Handles challenge and nonce storage with automatic fallback when Redis is unavailable
 */

const { redis } = require('./redis');
const config = require('../config');

// Default TTL for challenges (5 minutes)
const DEFAULT_CHALLENGE_TTL = config.challengeExpirySeconds || 300;

/**
 * ChallengeStore class
 * Manages challenge and nonce storage with Redis fallback
 */
class ChallengeStore {
  constructor() {
    // In-memory fallback stores
    this.memoryStore = new Map();
    this.usedNoncesStore = new Map();
    
    // Track if we're in fallback mode
    this.isFallbackMode = false;
    this.fallbackWarned = false;
    
    // Cleanup interval for expired entries (runs every minute)
    // Use unref() to allow the process to exit cleanly
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
    this.cleanupInterval.unref();
    
    // Test Redis connection on initialization
    this.testRedisConnection();
  }

  /**
   * Test Redis connection and set fallback mode if unavailable
   */
  async testRedisConnection() {
    try {
      await redis.ping();
      this.isFallbackMode = false;
      if (this.fallbackWarned) {
        console.log('ChallengeStore: Redis connection restored');
        this.fallbackWarned = false;
      }
    } catch (err) {
      if (!this.isFallbackMode) {
        console.warn('ChallengeStore: Redis unavailable, falling back to in-memory storage');
        this.isFallbackMode = true;
        this.fallbackWarned = true;
      }
    }
  }

  /**
   * Check Redis availability before operations
   * @returns {Promise<boolean>} - True if Redis is available
   */
  async checkRedisAvailable() {
    if (this.isFallbackMode) {
      // Periodically retry Redis connection
      try {
        await redis.ping();
        this.isFallbackMode = false;
        console.log('ChallengeStore: Redis connection restored');
        return true;
      } catch (err) {
        return false;
      }
    }
    return true;
  }

  /**
   * Store a challenge with TTL
   * @param {string} key - Challenge key (e.g., challenge:{agentId}:{nonce})
   * @param {string} value - Challenge value
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async setChallenge(key, value, ttlSeconds = DEFAULT_CHALLENGE_TTL) {
    const isRedisAvailable = await this.checkRedisAvailable();
    
    if (isRedisAvailable) {
      try {
        await redis.setex(key, ttlSeconds, value);
        return true;
      } catch (err) {
        console.error('ChallengeStore: Redis setex error:', err.message);
        // Fall through to in-memory fallback
      }
    }
    
    // In-memory fallback
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.memoryStore.set(key, { value, expiresAt });
    return true;
  }

  /**
   * Get a challenge by key
   * @param {string} key - Challenge key
   * @returns {Promise<string|null>} - Challenge value or null
   */
  async getChallenge(key) {
    const isRedisAvailable = await this.checkRedisAvailable();
    
    if (isRedisAvailable) {
      try {
        const value = await redis.get(key);
        return value;
      } catch (err) {
        console.error('ChallengeStore: Redis get error:', err.message);
        // Fall through to in-memory fallback
      }
    }
    
    // In-memory fallback
    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Delete a challenge by key
   * @param {string} key - Challenge key
   * @returns {Promise<boolean>} - Success status
   */
  async deleteChallenge(key) {
    const isRedisAvailable = await this.checkRedisAvailable();
    
    if (isRedisAvailable) {
      try {
        await redis.del(key);
        return true;
      } catch (err) {
        console.error('ChallengeStore: Redis del error:', err.message);
        // Fall through to in-memory fallback
      }
    }
    
    // In-memory fallback
    this.memoryStore.delete(key);
    return true;
  }

  /**
   * Mark a nonce as used to prevent replay attacks
   * @param {string} nonce - The nonce to mark as used
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async markNonceUsed(nonce, ttlSeconds = DEFAULT_CHALLENGE_TTL) {
    const key = `used_nonce:${nonce}`;
    const isRedisAvailable = await this.checkRedisAvailable();
    
    if (isRedisAvailable) {
      try {
        await redis.setex(key, ttlSeconds, '1');
        return true;
      } catch (err) {
        console.error('ChallengeStore: Redis setex error for used nonce:', err.message);
        // Fall through to in-memory fallback
      }
    }
    
    // In-memory fallback
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.usedNoncesStore.set(nonce, { expiresAt });
    return true;
  }

  /**
   * Check if a nonce has been used
   * @param {string} nonce - The nonce to check
   * @returns {Promise<boolean>} - True if nonce has been used
   */
  async isNonceUsed(nonce) {
    const key = `used_nonce:${nonce}`;
    const isRedisAvailable = await this.checkRedisAvailable();
    
    if (isRedisAvailable) {
      try {
        const value = await redis.get(key);
        return value !== null;
      } catch (err) {
        console.error('ChallengeStore: Redis get error for used nonce:', err.message);
        // Fall through to in-memory fallback
      }
    }
    
    // In-memory fallback
    const entry = this.usedNoncesStore.get(nonce);
    if (!entry) return false;
    
    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.usedNoncesStore.delete(nonce);
      return false;
    }
    
    return true;
  }

  /**
   * Cleanup expired in-memory entries
   * Called periodically by the cleanup interval
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let cleanedChallenges = 0;
    let cleanedNonces = 0;
    
    // Cleanup challenge store
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt < now) {
        this.memoryStore.delete(key);
        cleanedChallenges++;
      }
    }
    
    // Cleanup used nonces store
    for (const [nonce, entry] of this.usedNoncesStore.entries()) {
      if (entry.expiresAt < now) {
        this.usedNoncesStore.delete(nonce);
        cleanedNonces++;
      }
    }
    
    if (cleanedChallenges > 0 || cleanedNonces > 0) {
      console.log(`ChallengeStore cleanup: removed ${cleanedChallenges} expired challenges, ${cleanedNonces} expired nonces`);
    }
  }

  /**
   * Get store statistics (for monitoring)
   * @returns {Object} - Store statistics
   */
  getStats() {
    return {
      isFallbackMode: this.isFallbackMode,
      memoryStoreSize: this.memoryStore.size,
      usedNoncesSize: this.usedNoncesStore.size
    };
  }

  /**
   * Shutdown cleanup
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
const challengeStore = new ChallengeStore();

module.exports = {
  challengeStore,
  ChallengeStore
};
