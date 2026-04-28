/**
 * Verification Routes
 * Handles PKI challenge-response and agent metadata updates
 */

const express = require('express');
const { issueChallenge, verifyChallenge, isNonceUsed } = require('../services/pkiChallenge');
const { getAgent } = require('../models/queries');
const { authLimiter } = require('../middleware/rateLimit');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

/**
 * POST /challenge
 * Issue a PKI challenge for an agent
 */
router.post('/challenge', authenticate, authLimiter, async (req, res, next) => {
  try {
    // 1. Validate: requires agentId in body
    const { agentId } = req.body;

    if (!agentId || typeof agentId !== 'string' || agentId.length === 0) {
      return res.status(400).json({
        error: 'agentId is required and must be a non-empty string'
      });
    }

    // 2. Check agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    if (agent.credential_type && agent.credential_type !== 'crypto') {
      return res.status(400).json({
        error: `${agent.credential_type} agents do not require PKI verification`
      });
    }

    // 2.5 Verify org ownership
    if (agent.org_id !== req.user.orgId) {
      return res.status(403).json({
        error: 'Access denied: agent does not belong to your organization'
      });
    }

    // 3. Issue challenge
    const challengeData = await issueChallenge(agentId, agent.pubkey);

    // 4. Return challenge data
    return res.status(200).json(challengeData);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /response
 * Verify signed challenge response
 */
router.post('/response', authenticate, authLimiter, async (req, res, next) => {
  try {
    // 1. Validate: requires agentId, nonce, signature in body
    const { agentId, nonce, signature } = req.body;

    if (!agentId || typeof agentId !== 'string') {
      return res.status(400).json({
        error: 'agentId is required and must be a string'
      });
    }

    if (!nonce || typeof nonce !== 'string') {
      return res.status(400).json({
        error: 'nonce is required and must be a string'
      });
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        error: 'signature is required and must be a string'
      });
    }

    // 2. Get agent to retrieve pubkey for verification
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    if (agent.credential_type && agent.credential_type !== 'crypto') {
      return res.status(400).json({
        error: `${agent.credential_type} agents do not require PKI verification`
      });
    }

    // 2.5 Verify org ownership
    if (agent.org_id !== req.user.orgId) {
      return res.status(403).json({
        error: 'Access denied: agent does not belong to your organization'
      });
    }

    // 2.5. Check if nonce has already been used (replay prevention)
    const nonceUsed = await isNonceUsed(nonce);
    if (nonceUsed) {
      return res.status(409).json({
        error: 'Nonce has already been used',
        nonce
      });
    }

    // 3. Call verifyChallenge
    try {
      const result = await verifyChallenge(agentId, agent.pubkey, nonce, signature);

      // 3. If valid, return success response
      return res.status(200).json(result);

    } catch (verifyError) {
      // Handle specific error types
      if (verifyError.message.includes('not found')) {
        return res.status(404).json({
          error: 'Challenge not found or already completed'
        });
      }

      if (verifyError.message.includes('expired')) {
        return res.status(401).json({
          error: 'Challenge has expired'
        });
      }

      if (verifyError.message.includes('Invalid signature') || verifyError.message.includes('Invalid encoding')) {
        return res.status(401).json({
          error: 'Invalid signature'
        });
      }

      // Re-throw unexpected errors
      throw verifyError;
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
