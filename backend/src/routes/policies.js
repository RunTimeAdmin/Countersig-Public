/**
 * Policy Rules Routes
 * CRUD for organization policy rules
 */

const express = require('express');
const { query } = require('../models/db');
const { authenticate } = require('../middleware/authenticate');
const { authorize, requireScope, ROLES } = require('../middleware/authorize');
const { orgContext } = require('../middleware/orgContext');

const router = express.Router();

const VALID_ACTIONS = ['revoke', 'flag', 'notify', 'disable'];
const VALID_OPERATORS = ['<', '>', '<=', '>=', '==', '!=', 'contains'];

/**
 * GET /orgs/:orgId/policies
 * List all policy rules for the organization
 */
router.get('/orgs/:orgId/policies', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), requireScope('read'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM policy_rules WHERE org_id = $1 ORDER BY created_at DESC',
      [req.orgId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /orgs/:orgId/policies
 * Create a new policy rule
 */
router.post('/orgs/:orgId/policies', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { name, condition, action, enabled } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Policy name is required' });
    }

    if (!condition || typeof condition !== 'object') {
      return res.status(400).json({ error: 'Condition must be an object' });
    }

    if (!condition.field && !condition.event_type) {
      return res.status(400).json({ error: "Condition must have 'field' or 'event_type'" });
    }

    if (condition.field && !VALID_OPERATORS.includes(condition.op)) {
      return res.status(400).json({ error: `Condition operator must be one of: ${VALID_OPERATORS.join(', ')}` });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    const result = await query(
      `INSERT INTO policy_rules (org_id, name, condition, action, enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.orgId, name.trim(), JSON.stringify(condition), action, enabled !== false]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /orgs/:orgId/policies/:policyId
 * Update a policy rule
 */
router.put('/orgs/:orgId/policies/:policyId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { policyId } = req.params;
    const { name, condition, action, enabled } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (condition !== undefined) {
      if (typeof condition !== 'object') {
        return res.status(400).json({ error: 'Condition must be an object' });
      }
      updates.push(`condition = $${paramIndex++}`);
      values.push(JSON.stringify(condition));
    }
    if (action !== undefined) {
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` });
      }
      updates.push(`action = $${paramIndex++}`);
      values.push(action);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(policyId);
    values.push(req.orgId);

    const result = await query(
      `UPDATE policy_rules SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND org_id = $${paramIndex++} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy rule not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /orgs/:orgId/policies/:policyId
 * Delete a policy rule
 */
router.delete('/orgs/:orgId/policies/:policyId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('admin'), async (req, res, next) => {
  try {
    const { policyId } = req.params;

    const result = await query(
      'DELETE FROM policy_rules WHERE id = $1 AND org_id = $2 RETURNING id',
      [policyId, req.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy rule not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
