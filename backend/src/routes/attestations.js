/**
 * Attestation Routes
 * Handles action attestations and flagging of suspicious behavior
 */

const express = require('express');
const {
  getAgent,
  incrementActions,
  createFlag,
  getFlags,
  getUnresolvedFlagCount,
  updateAgentStatus
} = require('../models/queries');
const { refreshAndStoreScore } = require('../services/bagsReputation');
const { defaultLimiter, authLimiter } = require('../middleware/rateLimit');
const { transformAgent, isValidSolanaAddress } = require('../utils/transform');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

const router = express.Router();

/**
 * POST /agents/:agentId/attest
 * Record a successful/failed action
 */
router.post('/agents/:agentId/attest', authLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { success, action } = req.body;

    // Validate success is boolean
    if (typeof success !== 'boolean') {
      return res.status(400).json({
        error: 'success is required and must be a boolean'
      });
    }

    // Check agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    // Increment action counters
    const updatedAgent = await incrementActions(agentId, success);

    // If success, refresh and store the BAGS score
    if (success) {
      try {
        await refreshAndStoreScore(agentId);
      } catch (scoreError) {
        // Log but don't fail the request
        console.warn('Failed to refresh score after successful action:', scoreError.message);
      }
    }

    const transformedAgent = transformAgent(updatedAgent);
    return res.status(200).json({
      agentId,
      pubkey: agent.pubkey,
      success,
      action: action || null,
      totalActions: transformedAgent.totalActions,
      successfulActions: transformedAgent.successfulActions,
      failedActions: transformedAgent.failedActions,
      bagsScore: transformedAgent.bagsScore
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /agents/:agentId/flag
 * Flag suspicious behavior with cryptographic proof-of-ownership
 */
router.post('/agents/:agentId/flag', authLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { reporterPubkey, signature, timestamp, reason, evidence } = req.body;

    // Validate required fields
    if (!reporterPubkey || typeof reporterPubkey !== 'string') {
      return res.status(400).json({
        error: 'reporterPubkey is required and must be a string'
      });
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        error: 'signature is required and must be a string'
      });
    }

    if (!timestamp || typeof timestamp !== 'number') {
      return res.status(400).json({
        error: 'timestamp is required and must be a number'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'reason is required and must be a non-empty string'
      });
    }

    // Validate reporterPubkey is a valid Solana address
    if (!isValidSolanaAddress(reporterPubkey)) {
      return res.status(400).json({
        error: 'reporterPubkey must be a valid Solana address'
      });
    }

    // Check timestamp is within 5 minutes (300000ms) for replay protection
    const now = Date.now();
    const timeDiff = Math.abs(now - timestamp);
    if (timeDiff > 300000) {
      return res.status(400).json({
        error: 'Timestamp is too old or too far in the future. Must be within 5 minutes of current time.'
      });
    }

    // Check agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    // Construct the message to verify (uses agentId instead of pubkey)
    const message = `AGENTID-FLAG:${agentId}:${reporterPubkey}:${timestamp}`;

    // Verify the Ed25519 signature
    let isValid = false;
    try {
      const messageBytes = Buffer.from(message, 'utf8');
      const sigBytes = bs58.decode(signature);
      const reporterKeyBytes = bs58.decode(reporterPubkey);

      isValid = nacl.sign.detached.verify(messageBytes, sigBytes, reporterKeyBytes);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid signature format'
      });
    }

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid reporter signature'
      });
    }

    // Create the flag
    const flag = await createFlag({
      agentId,
      pubkey: agent.pubkey,
      reporterPubkey,
      reason,
      evidence: evidence || null
    });

    // Check if unresolved flags >= 3, auto-update status to 'flagged'
    const unresolvedCount = await getUnresolvedFlagCount(agentId);
    if (unresolvedCount >= 3 && agent.status !== 'flagged') {
      await updateAgentStatus(agentId, 'flagged', `Auto-flagged: ${unresolvedCount} unresolved flags`);
    }

    return res.status(201).json({
      flag,
      agentId,
      unresolved_flags: unresolvedCount,
      auto_flagged: unresolvedCount >= 3 && agent.status !== 'flagged'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents/:agentId/attestations
 * Return agent action stats
 */
router.get('/agents/:agentId/attestations', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    const transformedAgent = transformAgent(agent);
    return res.status(200).json({
      agentId,
      pubkey: agent.pubkey,
      totalActions: transformedAgent.totalActions,
      successfulActions: transformedAgent.successfulActions,
      failedActions: transformedAgent.failedActions,
      bagsScore: transformedAgent.bagsScore
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents/:agentId/flags
 * Return flags for an agent
 */
router.get('/agents/:agentId/flags', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    // Check agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    const flags = await getFlags(agentId);

    return res.status(200).json({
      agentId,
      pubkey: agent.pubkey,
      flags,
      count: flags.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
