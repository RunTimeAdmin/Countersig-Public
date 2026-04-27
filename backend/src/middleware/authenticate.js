/**
 * Authentication Middleware
 * Supports JWT cookies and API key bearer tokens
 */

const { query } = require('../models/db');
const { verifyAccessToken, verifyApiKey } = require('../services/authService');

/**
 * Parse a cookie value from the request header
 * @param {Request} req - Express request
 * @param {string} name - Cookie name
 * @returns {string|null}
 */
function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Authenticate request via JWT cookie or API key
 * Attaches req.user if valid, otherwise returns 401
 */
async function authenticate(req, res, next) {
  try {
    // 1. Check for access token cookie
    const accessToken = getCookie(req, 'aid_access');
    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          orgId: decoded.orgId,
          role: decoded.role
        };
        return next();
      } catch (err) {
        // Invalid JWT, fall through to API key check
      }
    }

    // 2. Check for API key in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawKey = authHeader.slice(7).trim();
      if (rawKey) {
        const keyHash = verifyApiKey(rawKey);
        // When looking up API key, also get the user's role
        const result = await query(
          `SELECT ak.id, ak.org_id, ak.user_id, ak.scopes, u.role
           FROM api_keys ak
           JOIN users u ON ak.user_id = u.id
           WHERE ak.key_hash = $1
             AND ak.revoked_at IS NULL
             AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
          [keyHash]
        );

        if (result.rows.length > 0) {
          const apiKey = result.rows[0];
          // Only update last_used if it's been more than 60 seconds
          await query(
            'UPDATE api_keys SET last_used = NOW() WHERE id = $1 AND (last_used IS NULL OR last_used < NOW() - INTERVAL \'60 seconds\')',
            [apiKey.id]
          );
          req.user = {
            userId: apiKey.user_id,
            orgId: apiKey.org_id,
            role: apiKey.role,
            isApiKey: true,
            scopes: apiKey.scopes,
            apiKeyId: apiKey.id
          };
          return next();
        }
      }
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication — same logic as authenticate
 * but proceeds without error if no credentials are found
 */
async function optionalAuth(req, res, next) {
  try {
    // 1. Check for access token cookie
    const accessToken = getCookie(req, 'aid_access');
    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          orgId: decoded.orgId,
          role: decoded.role
        };
        return next();
      } catch (err) {
        // Invalid JWT, fall through
      }
    }

    // 2. Check for API key in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const rawKey = authHeader.slice(7).trim();
      if (rawKey) {
        const keyHash = verifyApiKey(rawKey);
        // When looking up API key, also get the user's role
        const result = await query(
          `SELECT ak.id, ak.org_id, ak.user_id, ak.scopes, u.role
           FROM api_keys ak
           JOIN users u ON ak.user_id = u.id
           WHERE ak.key_hash = $1
             AND ak.revoked_at IS NULL
             AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
          [keyHash]
        );

        if (result.rows.length > 0) {
          const apiKey = result.rows[0];
          // Only update last_used if it's been more than 60 seconds
          await query(
            'UPDATE api_keys SET last_used = NOW() WHERE id = $1 AND (last_used IS NULL OR last_used < NOW() - INTERVAL \'60 seconds\')',
            [apiKey.id]
          );
          req.user = {
            userId: apiKey.user_id,
            orgId: apiKey.org_id,
            role: apiKey.role,
            isApiKey: true,
            scopes: apiKey.scopes,
            apiKeyId: apiKey.id
          };
          return next();
        }
      }
    }

    return next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, optionalAuth };
