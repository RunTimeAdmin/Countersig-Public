/**
 * Webhook Routes
 * CRUD for organization webhooks
 */

const express = require('express');
const crypto = require('crypto');
const { query } = require('../models/db');
const { authenticate } = require('../middleware/authenticate');
const { authorize, requireScope, ROLES } = require('../middleware/authorize');
const { orgContext } = require('../middleware/orgContext');
const { assertPublicHttpsUrl } = require('../utils/urlValidator');
const { validate } = require('../middleware/validate');
const { webhookSchema, webhookUpdateSchema } = require('../schemas');

const router = express.Router();

function maskSecret(secret) {
  if (!secret || secret.length < 8) return '****';
  return '****' + secret.slice(-4);
}

/**
 * GET /orgs/:orgId/webhooks
 * List all webhooks for the organization
 */
router.get('/orgs/:orgId/webhooks', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), requireScope('read'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM webhooks WHERE org_id = $1 ORDER BY created_at DESC',
      [req.orgId]
    );

    const sanitized = result.rows.map(w => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      secretLastFour: maskSecret(w.secret),
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }));

    return res.status(200).json(sanitized);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /orgs/:orgId/webhooks
 * Create a new webhook
 */
router.post('/orgs/:orgId/webhooks', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), validate(webhookSchema), async (req, res, next) => {
  try {
    const { url, events, secret } = req.body;

    try {
      await assertPublicHttpsUrl(url);
    } catch (err) {
      return res.status(400).json({ error: `Invalid webhook URL: ${err.message}` });
    }

    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
    const parsedEvents = Array.isArray(events) ? events : null;

    const result = await query(
      `INSERT INTO webhooks (org_id, url, events, secret)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.orgId, url.trim(), parsedEvents ? JSON.stringify(parsedEvents) : null, webhookSecret]
    );

    const webhook = result.rows[0];

    return res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      secret: webhookSecret,
      secretWarning: 'Store this secret securely. It will not be shown again.',
      secretLastFour: webhookSecret.slice(-4),
      createdAt: webhook.created_at,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /orgs/:orgId/webhooks/:webhookId
 * Update a webhook
 */
router.put('/orgs/:orgId/webhooks/:webhookId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), validate(webhookUpdateSchema), async (req, res, next) => {
  try {
    const { webhookId } = req.params;
    const { url, events, enabled } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (url !== undefined) {
      try {
        await assertPublicHttpsUrl(url);
      } catch (err) {
        return res.status(400).json({ error: `Invalid webhook URL: ${err.message}` });
      }
      updates.push(`url = $${paramIndex++}`);
      values.push(url.trim());
    }
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events array is required and must contain at least one event type' });
      }
      updates.push(`events = $${paramIndex++}`);
      values.push(JSON.stringify(events));
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(webhookId);
    values.push(req.orgId);

    const result = await query(
      `UPDATE webhooks SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND org_id = $${paramIndex++} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const webhook = result.rows[0];
    return res.status(200).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      secretLastFour: maskSecret(webhook.secret),
      createdAt: webhook.created_at,
      updatedAt: webhook.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /orgs/:orgId/webhooks/:webhookId
 * Delete a webhook
 */
router.delete('/orgs/:orgId/webhooks/:webhookId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('admin'), async (req, res, next) => {
  try {
    const { webhookId } = req.params;

    const result = await query(
      'DELETE FROM webhooks WHERE id = $1 AND org_id = $2 RETURNING id',
      [webhookId, req.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
