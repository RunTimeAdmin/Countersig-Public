/**
 * Registration Routes
 * Handles agent registration with Bags auth and SAID binding
 */

const express = require('express');
const { verifyBagsSignature } = require('../services/bagsAuthVerifier');
const { registerWithSAID } = require('../services/saidBinding');
const { authenticate } = require('../middleware/authenticate');
const { createAgent, getAgentByPubkey } = require('../models/queries');
const { registrationLimiter } = require('../middleware/rateLimit');
const { redis } = require('../models/redis');
const { transformAgent, isValidSolanaAddress } = require('../utils/transform');

const router = express.Router();

/**
 * Validate registration input
 * @param {Object} body - Request body
 * @returns {Object|null} - Validation error or null if valid
 */
function validateRegistrationInput(body) {
  const { pubkey, name, signature, message, nonce } = body;

  // Check required fields
  if (!pubkey || typeof pubkey !== 'string' || pubkey.length === 0) {
    return { error: 'pubkey is required and must be a non-empty string', status: 400 };
  }

  if (pubkey.length < 32 || pubkey.length > 88) {
    return { error: 'pubkey must be between 32 and 88 characters', status: 400 };
  }

  if (!name || typeof name !== 'string' || name.length === 0) {
    return { error: 'name is required and must be a non-empty string', status: 400 };
  }

  if (name.length > 255) {
    return { error: 'name must not exceed 255 characters', status: 400 };
  }

  if (!signature || typeof signature !== 'string') {
    return { error: 'signature is required', status: 400 };
  }

  if (!message || typeof message !== 'string') {
    return { error: 'message is required', status: 400 };
  }

  if (!nonce || typeof nonce !== 'string') {
    return { error: 'nonce is required', status: 400 };
  }

  return null;
}

/**
 * POST /register
 * Full agent registration flow
 */
router.post('/register', authenticate, registrationLimiter, async (req, res, next) => {
  try {
    // 1. Validate request body
    const validationError = validateRegistrationInput(req.body);
    if (validationError) {
      return res.status(validationError.status).json({
        error: validationError.error
      });
    }

    const {
      pubkey,
      name,
      signature,
      message,
      nonce,
      tokenMint,
      capabilities,
      creatorX,
      creatorWallet,
      description
    } = req.body;

    if (!isValidSolanaAddress(pubkey)) {
      return res.status(400).json({ error: 'Invalid Solana public key format' });
    }

    // 2. Verify the nonce is present in the message (prevents replay of arbitrary signatures)
    // The message is base58-encoded, so we need to decode it first to check for nonce
    let messagePlain = message;
    try {
      const bs58 = require('bs58');
      const decodedBytes = bs58.decode(message);
      messagePlain = Buffer.from(decodedBytes).toString('utf8');
    } catch (e) {
      // Message is not base58 encoded, use as-is (plaintext)
    }
    
    if (!messagePlain.includes(nonce)) {
      return res.status(400).json({
        error: 'Message must contain the nonce'
      });
    }

    // 3. Verify the Bags signature
    const isSignatureValid = verifyBagsSignature(message, signature, pubkey);
    if (!isSignatureValid) {
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // 4. Check if agent with same pubkey and name already exists
    const existingAgents = await getAgentByPubkey(pubkey);
    if (existingAgents && existingAgents.name === name) {
      return res.status(409).json({
        error: 'Agent with this pubkey and name already registered',
        pubkey,
        name
      });
    }

    // 5. Per-pubkey throttling: max 5 registrations per pubkey per 24 hours (atomic INCR+EXPIRE)
    const pubkeyThrottleKey = `reg:pubkey:${pubkey}`;
    const luaScript = `
      local v = redis.call('INCR', KEYS[1])
      if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      return v
    `;
    const regCount = await redis.eval(luaScript, 1, pubkeyThrottleKey, 86400);
    if (regCount > 5) {
      return res.status(429).json({ error: 'Too many registrations for this public key. Maximum 5 per 24 hours.' });
    }

    // 5. Attempt SAID binding (non-blocking)
    const timestamp = Date.now();
    let saidStatus = { registered: false, error: null };

    try {
      const saidResult = await registerWithSAID({
        pubkey,
        timestamp,
        signature,
        name,
        description,
        capabilities: capabilities || [],
        tokenMint
      });

      if (saidResult) {
        saidStatus = { registered: true, data: saidResult };
      } else {
        saidStatus = { registered: false, error: 'SAID registration returned null' };
      }
    } catch (saidError) {
      // Log warning but continue with registration
      console.warn('SAID binding failed during registration:', saidError.message);
      saidStatus = { registered: false, error: saidError.message };
    }

    // 6. Check if this is a demo agent
    const isDemo = req.body.isDemo === true; // explicit boolean, not name-based

    // 7. Store agent record
    const agent = await createAgent({
      pubkey,
      name,
      description,
      tokenMint,
      bagsApiKeyId: null, // Will be set later if needed
      capabilitySet: capabilities || [],
      creatorX,
      creatorWallet,
      isDemo,
      orgId: req.user.orgId,
      createdBy: req.user.userId
    });

    // 7. Return created agent with SAID status
    return res.status(201).json({
      agent: transformAgent(agent),
      agentId: agent.agent_id,
      said: saidStatus
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
