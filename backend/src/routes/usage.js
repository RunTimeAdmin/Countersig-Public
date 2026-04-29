/**
 * Usage Routes
 * GET /orgs/:orgId/usage        — Current period usage summary
 * GET /orgs/:orgId/usage/history — Daily usage for last 30 days
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { getPlanLimits, getOrgUsage } = require('../middleware/planEnforcement');
const { query } = require('../models/db');

// GET /orgs/:orgId/usage — Current period usage
router.get('/orgs/:orgId/usage',
  authenticate,
  authorize('viewer'),
  async (req, res, next) => {
    try {
      const { orgId } = req.params;

      // Verify org access
      if (req.user?.orgId && req.user.orgId !== orgId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get org's plan
      const orgResult = await query('SELECT plan FROM organizations WHERE id = $1', [orgId]);
      if (!orgResult.rows.length) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      const planId = orgResult.rows[0].plan || 'free';

      const [limits, usage] = await Promise.all([
        getPlanLimits(planId),
        getOrgUsage(orgId)
      ]);

      res.json({
        plan: planId,
        period: new Date().toISOString().slice(0, 10),
        usage: {
          agents: {
            current: usage.agentCount,
            max: limits?.max_agents || 5,
            percentage: Math.round((usage.agentCount / (limits?.max_agents || 5)) * 100)
          },
          api_calls_today: {
            current: usage.apiCalls,
            max: limits?.max_api_calls_daily || 100,
            percentage: Math.round((usage.apiCalls / (limits?.max_api_calls_daily || 100)) * 100)
          },
          webhooks: {
            current: usage.webhookCount,
            max: limits?.max_webhooks || 2,
            percentage: Math.round((usage.webhookCount / (limits?.max_webhooks || 2)) * 100)
          }
        },
        limits: limits || {},
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /orgs/:orgId/usage/history — Daily usage for last 30 days
router.get('/orgs/:orgId/usage/history',
  authenticate,
  authorize('viewer'),
  async (req, res, next) => {
    try {
      const { orgId } = req.params;

      if (req.user?.orgId && req.user.orgId !== orgId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await query(
        `SELECT 
          DATE(recorded_at) as date,
          metric,
          SUM(count) as total
        FROM usage_events 
        WHERE org_id = $1 AND recorded_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(recorded_at), metric
        ORDER BY date DESC`,
        [orgId]
      );

      res.json({
        orgId,
        period: '30d',
        history: result.rows,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
