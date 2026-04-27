/**
 * API Key Routes
 * Manage organization API keys
 */

const express = require('express');
const { query } = require('../models/db');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const { generateApiKey } = require('../services/authService');

const VALID_SCOPES = new Set([
  'read', 'write',
  'agents:read', 'agents:write',
  'audit:read', 'audit:export',
  'webhooks:read', 'webhooks:write',
  'policies:read', 'policies:write',
  'org:read', 'org:write'
]);

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api-keys
 * Create a new API key
 */
router.post('/api-keys', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { name, scopes, expiresAt } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const parsedScopes = Array.isArray(scopes) && scopes.length > 0 ? scopes : ['read'];
    const invalid = parsedScopes.filter(s => !VALID_SCOPES.has(s));
    if (invalid.length) {
      return res.status(400).json({ error: `Invalid scopes: ${invalid.join(', ')}. Valid: ${[...VALID_SCOPES].join(', ')}` });
    }

    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        return res.status(400).json({ error: 'expiresAt must be a valid ISO date' });
      }
      if (expDate <= new Date()) {
        return res.status(400).json({ error: 'expiresAt must be in the future' });
      }
      const maxExpiry = new Date();
      maxExpiry.setFullYear(maxExpiry.getFullYear() + 2);
      if (expDate > maxExpiry) {
        return res.status(400).json({ error: 'expiresAt cannot be more than 2 years in the future' });
      }
    }

    const result = await query(
      `INSERT INTO api_keys (org_id, user_id, key_hash, key_prefix, name, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, key_prefix, scopes, last_used, expires_at, created_at`,
      [req.user.orgId, req.user.userId, keyHash, keyPrefix, name.trim(), JSON.stringify(parsedScopes), expiresAt || null]
    );

    const apiKey = result.rows[0];

    return res.status(201).json({
      id: apiKey.id,
      rawKey,
      name: apiKey.name,
      keyPrefix: apiKey.key_prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expires_at,
      createdAt: apiKey.created_at
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api-keys
 * List all active API keys for the organization
 */
router.get('/api-keys', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, key_prefix, scopes, last_used, expires_at, created_at
       FROM api_keys
       WHERE org_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.orgId]
    );

    const keys = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
      lastUsed: row.last_used,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    }));

    return res.status(200).json(keys);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api-keys/:id
 * Revoke an API key
 */
router.delete('/api-keys/:id', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
