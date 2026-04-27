/**
 * Reputation Routes
 * Returns full reputation breakdown for agents
 */

const express = require('express');
const { computeBagsScore } = require('../services/bagsReputation');
const { getAgent } = require('../models/queries');
const { defaultLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * GET /reputation/:agentId
 * Returns full reputation breakdown
 */
router.get('/reputation/:agentId', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    // Check agent exists first
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    const reputation = await computeBagsScore(agentId);

    return res.status(200).json({
      agentId,
      pubkey: agent.pubkey,
      score: reputation.score,
      label: reputation.label,
      breakdown: reputation.breakdown
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
