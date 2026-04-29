/**
 * Authentication Routes
 * Handles registration, login, token refresh, and logout
 */

const express = require('express');
const { query, pool } = require('../models/db');
const {
  hashPassword,
  comparePassword,
  generateTokens,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
  revokeUserAccess,
  isRefreshTokenValid,
  expiryToSeconds
} = require('../services/authService');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimit');
const { authenticate } = require('../middleware/authenticate');
const authManager = require('../auth/authManager');
const authConfig = require('../auth/authConfig');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
  path: '/'
};

const ACCESS_MAX_AGE = expiryToSeconds(process.env.JWT_EXPIRY || '15m') * 1000;
const REFRESH_MAX_AGE = expiryToSeconds(process.env.JWT_REFRESH_EXPIRY || '7d') * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DUMMY_HASH = '$2a$12$' + 'a'.repeat(53); // valid bcrypt format, never matches

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
 * Convert a string to a URL-friendly slug
 * @param {string} name - Organization name
 * @returns {string}
 */
function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * POST /auth/register
 * Register a new user and organization
 */
router.post('/auth/register', registrationLimiter, async (req, res, next) => {
  try {
    const { email, password, name, orgName } = req.body;

    // Validation
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }
    if (!orgName || typeof orgName !== 'string' || orgName.trim().length === 0) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const passwordHash = await hashPassword(password);
    const slug = slugify(orgName);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check for duplicate email
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Check for duplicate slug
      const existingOrg = await client.query('SELECT id FROM organizations WHERE slug = $1', [slug]);
      if (existingOrg.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Organization name already taken' });
      }

      // Create organization
      const orgResult = await client.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug',
        [orgName.trim(), slug]
      );
      const org = orgResult.rows[0];

      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, name, org_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, org_id',
        [email.toLowerCase().trim(), passwordHash, name || null, org.id, 'admin']
      );
      const user = userResult.rows[0];

      // Update org owner
      await client.query('UPDATE organizations SET owner_user_id = $1 WHERE id = $2', [user.id, org.id]);

      await client.query('COMMIT');

      // Generate tokens
      const { accessToken, refreshToken, tokenId } = generateTokens(user);
      await storeRefreshToken(tokenId, user.id);

      res.cookie('aid_access', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
      res.cookie('aid_refresh', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });
      res.cookie('aid_logged_in', '1', {
        ...COOKIE_OPTIONS,
        httpOnly: false,  // Override: frontend needs to read this
        maxAge: REFRESH_MAX_AGE  // Match refresh token lifetime
      });

      return res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        org: { id: org.id, name: org.name, slug: org.slug }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Authenticate existing user
 */
router.post('/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, email, password_hash, name, role, org_id, failed_login_count, locked_until FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    // Check if account is locked due to too many failed attempts
    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      await comparePassword(password, DUMMY_HASH); // burn the time to prevent timing leak
      return res.status(423).json({
        error: 'Account temporarily locked. Try again later.'
      });
    }

    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const valid = await comparePassword(password, hashToCompare);
    if (!user || !valid) {
      // Audit log for unknown user attempts
      if (!user) {
        try {
          await pool.query(
            'INSERT INTO auth_attempts (email, ip_address, user_agent, success) VALUES ($1, $2, $3, false)',
            [email.toLowerCase().trim(), req.ip, req.get('user-agent')]
          );
        } catch (e) { /* fire and forget */ }
      }

      // Track failed login attempt if we found a user
      if (user) {
        try {
          await pool.query(
            `UPDATE users SET
              failed_login_count = COALESCE(failed_login_count, 0) + 1,
              locked_until = CASE
                WHEN COALESCE(failed_login_count, 0) + 1 >= 5
                THEN NOW() + INTERVAL '15 minutes'
                ELSE locked_until
              END
            WHERE id = $1`,
            [user.id]
          );
        } catch (trackErr) {
          console.error('Failed to track login attempt:', trackErr.message);
        }

        // Audit log for failed login
        try {
          const { logAction } = require('../services/auditService');
          await logAction({
            orgId: user.org_id,
            actorId: user.id,
            actorType: 'user',
            action: 'login_failed',
            resourceType: 'user',
            resourceId: user.id,
            changes: null,
            metadata: { ip: req.ip, userAgent: req.get('user-agent'), email }
          });
        } catch (auditErr) {
          console.error('Failed to audit login failure:', auditErr.message);
        }
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset failed login count and update last_login
    await pool.query(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Log successful login to auth_attempts
    try {
      await pool.query(
        'INSERT INTO auth_attempts (email, ip_address, user_agent, success) VALUES ($1, $2, $3, true)',
        [email.toLowerCase().trim(), req.ip, req.get('user-agent')]
      );
    } catch (e) { /* fire and forget */ }

    const { accessToken, refreshToken, tokenId } = generateTokens(user);
    await storeRefreshToken(tokenId, user.id);

    res.cookie('aid_access', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
    res.cookie('aid_refresh', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });
    res.cookie('aid_logged_in', '1', {
      ...COOKIE_OPTIONS,
      httpOnly: false,  // Override: frontend needs to read this
      maxAge: REFRESH_MAX_AGE  // Match refresh token lifetime
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.org_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Rotate access and refresh tokens
 */
router.post('/auth/refresh', authLimiter, async (req, res, next) => {
  try {
    const refreshToken = getCookie(req, 'aid_refresh');
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const valid = await isRefreshTokenValid(payload.jti, payload.userId);
    if (!valid) {
      return res.status(401).json({ error: 'Refresh token revoked or expired' });
    }

    // Fetch user for new token generation
    const result = await query(
      'SELECT id, email, name, role, org_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [payload.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const tokens = generateTokens(user);

    // Rotate: revoke old, store new
    await revokeRefreshToken(payload.jti, payload.userId);
    await storeRefreshToken(tokens.tokenId, user.id);

    res.cookie('aid_access', tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
    res.cookie('aid_refresh', tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });
    res.cookie('aid_logged_in', '1', {
      ...COOKIE_OPTIONS,
      httpOnly: false,  // Override: frontend needs to read this
      maxAge: REFRESH_MAX_AGE  // Match refresh token lifetime
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.org_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Revoke refresh token and clear cookies
 */
router.post('/auth/logout', async (req, res, next) => {
  try {
    const refreshToken = getCookie(req, 'aid_refresh');
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        if (payload && payload.userId && payload.jti) {
          await revokeRefreshToken(payload.jti, payload.userId);
          // Blacklist all access tokens for this user until they expire
          await revokeUserAccess(payload.userId);
        }
      } catch (err) {
        // Ignore invalid token on logout
      }
    }

    res.clearCookie('aid_access', COOKIE_OPTIONS);
    res.clearCookie('aid_refresh', COOKIE_OPTIONS);
    res.clearCookie('aid_logged_in', { ...COOKIE_OPTIONS, httpOnly: false });

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/verify-external-token
 * Validate an external OAuth2/OIDC JWT and return decoded claims.
 * Requires authentication (org context needed to check allowed providers).
 */
router.post('/auth/verify-external-token', authenticate, async (req, res) => {
  try {
    const { token, provider } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Determine which strategy to use
    const credentialType = provider === 'entra_id' ? 'entra_id' : 'oauth2';

    // Check if the strategy is enabled
    if (!authConfig.isStrategyEnabled(credentialType)) {
      return res.status(400).json({ error: `${credentialType} authentication is not enabled` });
    }

    const strategyConfig = authConfig.getStrategyConfig(credentialType);

    const result = await authManager.validateAgentCredentials(credentialType, {
      token,
      allowedIssuers: strategyConfig?.allowedIssuers || [],
      expectedAudience: strategyConfig?.allowedAudiences || undefined,
    });

    if (!result.valid) {
      return res.status(401).json({ error: 'Token validation failed' });
    }

    return res.json({
      valid: true,
      identity: result.identity,
    });
  } catch (err) {
    console.error('External token verification error:', err);
    return res.status(500).json({ error: 'Token verification failed' });
  }
});

module.exports = router;
