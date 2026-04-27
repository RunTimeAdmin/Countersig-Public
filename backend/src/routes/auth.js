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
  isRefreshTokenValid,
  expiryToSeconds
} = require('../services/authService');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
};

const ACCESS_MAX_AGE = expiryToSeconds(process.env.JWT_EXPIRY || '15m') * 1000;
const REFRESH_MAX_AGE = expiryToSeconds(process.env.JWT_REFRESH_EXPIRY || '7d') * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
router.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password, name, orgName } = req.body;

    // Validation
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
      const { accessToken, refreshToken } = generateTokens(user);
      await storeRefreshToken(user.id, refreshToken);

      res.cookie('aid_access', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
      res.cookie('aid_refresh', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });

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
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, email, password_hash, name, role, org_id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last_login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const { accessToken, refreshToken } = generateTokens(user);
    await storeRefreshToken(user.id, refreshToken);

    res.cookie('aid_access', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
    res.cookie('aid_refresh', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });

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
router.post('/auth/refresh', async (req, res, next) => {
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

    const valid = await isRefreshTokenValid(payload.userId, refreshToken);
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
    await revokeRefreshToken(user.id);
    await storeRefreshToken(user.id, tokens.refreshToken);

    res.cookie('aid_access', tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
    res.cookie('aid_refresh', tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });

    return res.status(200).json({ success: true });
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
        if (payload && payload.userId) {
          await revokeRefreshToken(payload.userId);
        }
      } catch (err) {
        // Ignore invalid token on logout
      }
    }

    res.clearCookie('aid_access', COOKIE_OPTIONS);
    res.clearCookie('aid_refresh', COOKIE_OPTIONS);

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
