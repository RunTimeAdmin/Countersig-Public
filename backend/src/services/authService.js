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
const jose = require('jose');
const crypto = require('crypto');
const { redis } = require('../models/redis');
const { timingSafeEqual } = require('../utils/crypto');

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

// --- A2A Token Ed25519 Key Pair ---
// In production, Ed25519 keys are REQUIRED for A2A token signing.
// Generate with: node -e "require('jose').generateKeyPair('EdDSA').then(async ({publicKey,privateKey})=>{const j=require('jose');console.log('A2A_SIGNING_KEY='+Buffer.from(await j.exportPKCS8(privateKey)).toString('base64'));console.log('A2A_VERIFY_KEY='+Buffer.from(await j.exportSPKI(publicKey)).toString('base64'))})"
let a2aPrivateKey = null;
let a2aPublicKey = null;
let a2aUseHMAC = true; // fallback flag

async function initA2AKeys() {
  const signingKeyB64 = process.env.A2A_SIGNING_KEY;
  const verifyKeyB64 = process.env.A2A_VERIFY_KEY;
  
  if (signingKeyB64 && verifyKeyB64) {
    try {
      const signingPem = Buffer.from(signingKeyB64, 'base64').toString('utf8');
      const verifyPem = Buffer.from(verifyKeyB64, 'base64').toString('utf8');
      a2aPrivateKey = await jose.importPKCS8(signingPem, 'EdDSA');
      a2aPublicKey = await jose.importSPKI(verifyPem, 'EdDSA');
      a2aUseHMAC = false;
      console.log('[AuthService] A2A tokens: Ed25519 asymmetric signing enabled');
    } catch (err) {
      console.error('[AuthService] Failed to load A2A Ed25519 keys:', err.message);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: Invalid A2A Ed25519 keys in production');
      }
      console.warn('[AuthService] Falling back to HMAC signing for A2A tokens (development only)');
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: A2A_SIGNING_KEY and A2A_VERIFY_KEY are required in production');
  } else {
    console.warn('[AuthService] A2A Ed25519 keys not configured — using HMAC fallback (development only)');
  }
}

// Initialize keys at module load
const a2aKeysReady = initA2AKeys();
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
    const pipeline = redis.pipeline();
    pipeline.setex(`refresh:${tokenId}`, ttl, userId);
    // Track session for "logout all" support
    pipeline.sadd(`sessions:${userId}`, tokenId);
    pipeline.expire(`sessions:${userId}`, ttl);
    await pipeline.exec();
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
    if (userId) {
      const pipeline = redis.pipeline();
      pipeline.del(`refresh:${tokenId}`);
      pipeline.srem(`sessions:${userId}`, tokenId);
      await pipeline.exec();
    } else {
      await redis.del(`refresh:${tokenId}`);
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
 * Revoke a user's access — adds to Redis blacklist with TTL matching access token expiry.
 * Call on logout and admin-initiated revocation.
 * @param {string} userId - User ID to revoke
 * @returns {Promise<boolean>}
 */
async function revokeUserAccess(userId) {
  try {
    const ttl = expiryToSeconds(JWT_EXPIRY);
    await redis.setex(`revoked:user:${userId}`, ttl, '1');
    return true;
  } catch (err) {
    console.error('Redis revokeUserAccess error:', err.message);
    return false;
  }
}

/**
 * Check if a user's access has been revoked (constant-time, Redis-backed).
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} true if revoked
 */
async function isUserRevoked(userId) {
  try {
    const revoked = await redis.get(`revoked:user:${userId}`);
    return revoked === '1';
  } catch (err) {
    // Redis failure should NOT block authentication (fail-open for availability)
    console.error('Redis isUserRevoked error:', err.message);
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
    return timingSafeEqual(stored, String(userId));
  } catch (err) {
    console.error('Redis isRefreshTokenValid error:', err.message);
    return false;
  }
}

/**
 * Generate a short-lived A2A (agent-to-agent) authentication token
 * @param {Object} payload - Token payload (sub, name, pubkey, chain, caps, score)
 * @returns {Promise<string>} Signed JWT
 */
async function generateA2AToken(payload) {
  await a2aKeysReady;
  
  if (!a2aUseHMAC) {
    // Ed25519 asymmetric signing (production)
    return new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'EdDSA', kid: 'a2a-ed25519-1' })
      .setIssuer('agentidapp.com')
      .setAudience('agentid-a2a')
      .setExpirationTime('60s')
      .setIssuedAt()
      .sign(a2aPrivateKey);
  }
  
  // HMAC fallback (development only)
  return jwt.sign(payload, A2A_TOKEN_SECRET, {
    expiresIn: '60s',
    issuer: 'agentidapp.com',
    audience: 'agentid-a2a'
  });
}

/**
 * Verify an A2A authentication token
 * @param {string} token - A2A JWT string
 * @returns {Promise<Object>} Decoded payload
 */
async function verifyA2AToken(token) {
  await a2aKeysReady;
  
  if (!a2aUseHMAC) {
    // Ed25519 asymmetric verification (production)
    const { payload } = await jose.jwtVerify(token, a2aPublicKey, {
      issuer: 'agentidapp.com',
      audience: 'agentid-a2a',
    });
    return payload;
  }
  
  // HMAC fallback (development only)
  return jwt.verify(token, A2A_TOKEN_SECRET, {
    issuer: 'agentidapp.com',
    audience: 'agentid-a2a'
  });
}

/**
 * Export the A2A public key as JWK (for the JWKS endpoint)
 * @returns {Promise<Object|null>} JWK object or null if not configured
 */
async function getA2APublicKeyJWK() {
  await a2aKeysReady;
  if (!a2aPublicKey) return null;
  const jwk = await jose.exportJWK(a2aPublicKey);
  jwk.kid = 'a2a-ed25519-1';
  jwk.use = 'sig';
  jwk.alg = 'EdDSA';
  return jwk;
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
  revokeUserAccess,
  isUserRevoked,
  generateA2AToken,
  verifyA2AToken,
  getA2APublicKeyJWK
};
