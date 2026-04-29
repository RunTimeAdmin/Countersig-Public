/**
 * Agent Heartbeat Routes
 * Handles agent health monitoring via heartbeat signals
 */

const express = require('express');
const router = express.Router();
const { query } = require('../models/db');
const { authenticate } = require('../middleware/authenticate');
const { requireScope } = require('../middleware/authorize');
const { getLogger } = require('../utils/logger');

/**
 * POST /agents/:agentId/heartbeat — Agent sends heartbeat
 * Updates last_heartbeat timestamp and marks agent as healthy
 */
router.post('/agents/:agentId/heartbeat',
  authenticate,
  requireScope('write'),
  async (req, res, next) => {
    try {
      const { agentId } = req.params;
      const { metadata } = req.body; // optional runtime info

      // Verify the agent exists and is not deleted
      const agent = await query(
        'SELECT agent_id, org_id FROM agent_identities WHERE agent_id = $1 AND deleted_at IS NULL',
        [agentId]
      );

      if (!agent.rows.length) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Verify the agent belongs to the user's org
      if (req.user?.orgId && agent.rows[0].org_id !== req.user.orgId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update heartbeat
      await query(
        `UPDATE agent_identities 
         SET last_heartbeat = NOW(), health_status = 'healthy', updated_at = NOW()
         WHERE agent_id = $1`,
        [agentId]
      );

      const logger = getLogger();
      logger.info({ agentId, metadata }, 'Agent heartbeat received');

      res.json({
        status: 'ok',
        next_expected: 120,  // seconds until next expected heartbeat
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
