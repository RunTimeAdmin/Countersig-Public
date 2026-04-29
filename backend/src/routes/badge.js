/**
 * Badge Routes
 * Returns trust badge JSON and SVG for agents
 */

const express = require('express');
const { getBadgeJSON, getBadgeSVG } = require('../services/badgeBuilder');
const { defaultLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * GET /badge/:agentId
 * Returns trust badge JSON
 */
router.get('/badge/:agentId', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const badgeData = await getBadgeJSON(agentId);

    return res.status(200).json(badgeData);
  } catch (error) {
    if (error.message.includes('Agent not found')) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId: req.params.agentId
      });
    }
    next(error);
  }
});

/**
 * GET /badge/:agentId/svg
 * Returns trust badge SVG
 */
router.get('/badge/:agentId/svg', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const svg = await getBadgeSVG(agentId);

    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (error) {
    if (error.message.includes('Agent not found')) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId: req.params.agentId
      });
    }
    next(error);
  }
});

module.exports = router;
