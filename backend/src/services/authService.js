/**
 * Authentication Service
 * Handles password hashing, JWT tokens, API keys, and Redis session management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { redis } = require('../models/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
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

const REFRESH_TTL_SECONDS = expiryToSeconds(JWT_REFRESH_EXPIRY);

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
 * @returns {Object} { accessToken, refreshToken }
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, orgId: user.org_id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify an access JWT
 * @param {string} token - JWT string
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type === 'refresh') {
    throw new Error('Token type mismatch: refresh token used as access token');
  }
  return decoded;
}

/**
 * Verify a refresh JWT
 * @param {string} token - JWT string
 * @returns {Object} Decoded payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_SECRET);
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
 * Store a refresh token in Redis
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token string
 * @returns {Promise<boolean>}
 */
async function storeRefreshToken(userId, refreshToken) {
  try {
    await redis.setex(`refresh:${userId}`, REFRESH_TTL_SECONDS, refreshToken);
    return true;
  } catch (err) {
    console.error('Redis storeRefreshToken error:', err.message);
    return false;
  }
}

/**
 * Revoke a user's refresh token in Redis
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function revokeRefreshToken(userId) {
  try {
    await redis.del(`refresh:${userId}`);
    return true;
  } catch (err) {
    console.error('Redis revokeRefreshToken error:', err.message);
    return false;
  }
}

/**
 * Check if a refresh token is valid in Redis
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token string
 * @returns {Promise<boolean>}
 */
async function isRefreshTokenValid(userId, refreshToken) {
  try {
    const stored = await redis.get(`refresh:${userId}`);
    return stored === refreshToken;
  } catch (err) {
    console.error('Redis isRefreshTokenValid error:', err.message);
    return false;
  }
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
  isRefreshTokenValid,
  expiryToSeconds
};
