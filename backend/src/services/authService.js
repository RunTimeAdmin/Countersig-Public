/**
 * Authentication Service
 * Handles password hashing, JWT tokens, API keys, and Redis session management
 */

let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('bcryptjs');
  console.warn('[AuthService] Using bcryptjs fallback — native bcrypt not available');
}
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { redis } = require('../models/redis');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}
if (JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
}
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;
const A2A_TOKEN_SECRET = process.env.A2A_TOKEN_SECRET || JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Convert a JWT expiry string (e.g. '7d', '15m') to seconds for Redis TTL
 * @param {string} expiry - Expiry string
 * @returns {number} Seconds
 */
function expiryToSeconds(expiry) {
  const match = String(expiry).match(/^(\d+)([smhdw])$/);
  if (!match) return 7 * 24 * 60 * 60;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return value * multipliers[unit];
}


/**
 * Hash a password with bcrypt (12 rounds)
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Bcrypt hash
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Compare a plaintext password against a bcrypt hash
 * @param {string} password - Plaintext password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} Match result
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate access and refresh tokens for a user
 * @param {Object} user - User object with id, email, org_id, role
 * @returns {Object} { accessToken, refreshToken, tokenId }
 */
function generateTokens(user) {
  const tokenId = crypto.randomUUID();
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, orgId: user.org_id, role: user.role, type: 'access' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: JWT_EXPIRY, issuer: 'agentidapp.com', audience: 'agentid-access' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh', jti: tokenId },
    REFRESH_TOKEN_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY, issuer: 'agentidapp.com', audience: 'agentid-refresh' }
  );

  return { accessToken, refreshToken, tokenId };
}

/**
 * Verify an access JWT
 * @param {string} token - JWT string
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
    issuer: 'agentidapp.com',
    audience: 'agentid-access'
  });
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }
  return decoded;
}

/**
 * Verify a refresh JWT
 * @param {string} token - JWT string
 * @returns {Object} Decoded payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET, {
    issuer: 'agentidapp.com',
    audience: 'agentid-refresh'
  });
}

/**
 * Generate a new API key pair
 * @returns {Object} { rawKey, keyHash, keyPrefix }
 */
function generateApiKey() {
  const rawKey = 'aid_' + crypto.randomBytes(20).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash a raw API key for database lookup
 * @param {string} rawKey - Raw API key
 * @returns {string} SHA-256 hash
 */
function verifyApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Store a refresh token in Redis (per-token storage for multi-session support)
 * @param {string} tokenId - Unique token ID (jti)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function storeRefreshToken(tokenId, userId) {
  try {
    const ttl = expiryToSeconds(JWT_REFRESH_EXPIRY);
    await redis.setex(`refresh:${tokenId}`, ttl, userId);
    // Track session for "logout all" support
    await redis.sadd(`sessions:${userId}`, tokenId);
    await redis.expire(`sessions:${userId}`, ttl);
    return true;
  } catch (err) {
    console.error('Redis storeRefreshToken error:', err.message);
    return false;
  }
}

/**
 * Revoke a refresh token in Redis by tokenId
 * @param {string} tokenId - Unique token ID (jti)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function revokeRefreshToken(tokenId, userId) {
  try {
    await redis.del(`refresh:${tokenId}`);
    if (userId) {
      await redis.srem(`sessions:${userId}`, tokenId);
    }
    return true;
  } catch (err) {
    console.error('Redis revokeRefreshToken error:', err.message);
    return false;
  }
}

/**
 * Revoke all sessions for a user ("logout all" support)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function revokeAllSessions(userId) {
  try {
    const tokenIds = await redis.smembers(`sessions:${userId}`);
    if (tokenIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const tid of tokenIds) {
        pipeline.del(`refresh:${tid}`);
      }
      pipeline.del(`sessions:${userId}`);
      await pipeline.exec();
    }
    return true;
  } catch (err) {
    console.error('Redis revokeAllSessions error:', err.message);
    return false;
  }
}

/**
 * Check if a refresh token is valid in Redis (constant-time comparison)
 * @param {string} tokenId - Unique token ID (jti)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function isRefreshTokenValid(tokenId, userId) {
  try {
    const stored = await redis.get(`refresh:${tokenId}`);
    if (!stored || !userId) return false;
    const storedBuf = Buffer.from(stored, 'utf8');
    const userBuf = Buffer.from(userId, 'utf8');
    if (storedBuf.length !== userBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, userBuf);
  } catch (err) {
    console.error('Redis isRefreshTokenValid error:', err.message);
    return false;
  }
}

/**
 * Generate a short-lived A2A (agent-to-agent) authentication token
 * @param {Object} payload - Token payload (sub, name, pubkey, chain, caps, score)
 * @returns {string} Signed JWT
 */
function generateA2AToken(payload) {
  return jwt.sign(payload, A2A_TOKEN_SECRET, {
    expiresIn: '60s',
    issuer: 'agentidapp.com',
    audience: 'agentid-a2a'
  });
}

/**
 * Verify an A2A authentication token
 * @param {string} token - A2A JWT string
 * @returns {Object} Decoded payload
 */
function verifyA2AToken(token) {
  return jwt.verify(token, A2A_TOKEN_SECRET, {
    issuer: 'agentidapp.com',
    audience: 'agentid-a2a'
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  generateApiKey,
  verifyApiKey,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
  isRefreshTokenValid,
  expiryToSeconds,
  generateA2AToken,
  verifyA2AToken
};
