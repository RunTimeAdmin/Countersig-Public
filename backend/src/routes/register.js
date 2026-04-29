/**
 * Registration Routes
 * Handles agent registration with Bags auth and SAID binding
 */

const express = require('express');
const { verifyBagsSignature } = require('../services/bagsAuthVerifier');
const { getChainAdapter, getSupportedChains } = require('../services/chainAdapters');
const { registerWithSAID } = require('../services/saidBinding');
const { authenticate } = require('../middleware/authenticate');
const { createAgent, getAgentByPubkey, getAgentByExternalId } = require('../models/queries');
const authManager = require('../auth/authManager');
const { registrationLimiter } = require('../middleware/rateLimit');
const { redis } = require('../models/redis');
const { transformAgent, isValidSolanaAddress } = require('../utils/transform');
const eventBus = require('../services/eventBus');

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

  if (pubkey.length < 32 || pubkey.length > 130) {
    return { error: 'pubkey must be between 32 and 130 characters', status: 400 };
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

  // Validate capabilities if provided
  if (body.capabilities !== undefined) {
    if (!Array.isArray(body.capabilities)) {
      return { error: 'capabilities must be an array', status: 400 };
    }
    if (body.capabilities.length > 50) {
      return { error: 'capabilities must not exceed 50 items', status: 400 };
    }
    for (const cap of body.capabilities) {
      if (typeof cap !== 'string') {
        return { error: 'all capabilities must be strings', status: 400 };
      }
      if (cap.length > 64) {
        return { error: 'each capability must not exceed 64 characters', status: 400 };
      }
    }
  }

  return null;
}

/**
 * POST /register
 * Full agent registration flow
 */
router.post('/register', authenticate, registrationLimiter, async (req, res, next) => {
  try {
    const { credential_type = 'crypto' } = req.body;

    if (credential_type === 'crypto') {
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
        description,
        chainType
      } = req.body;

      // Determine chain type (default to solana-bags for backward compatibility)
      const resolvedChainType = chainType || 'solana-bags';

      // Validate chain type is supported
      try {
        authManager.getStrategy('crypto');
      } catch (err) {
        return res.status(400).json({ error: err.message });
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

      // 3. Verify credentials via AuthManager
      const { valid, identity } = await authManager.validateAgentCredentials('crypto', {
        pubkey,
        signature,
        message,
        chainType: resolvedChainType
      });
      if (!valid) {
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

      // 5. Validate demo permission BEFORE incurring rate limit
      const isDemo = req.body.isDemo === true;
      if (isDemo && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create demo agents' });
      }

      // 6. Per-pubkey throttling: max 5 registrations per pubkey per 24 hours (atomic INCR+EXPIRE)
      const orgId = req.orgId || req.user?.orgId || 'default';
      const pubkeyThrottleKey = `reg:pubkey:${orgId}:${pubkey}`;
      const luaScript = `
        local v = redis.call('INCR', KEYS[1])
        if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
        return v
      `;
      const regCount = await redis.eval(luaScript, 1, pubkeyThrottleKey, 86400);
      if (regCount > 5) {
        return res.status(429).json({ error: 'Too many registrations for this public key. Maximum 5 per 24 hours.' });
      }

      try {
        // 5. Attempt SAID binding (non-blocking, only for Solana chain types)
        const timestamp = Date.now();
        let saidStatus = { registered: false, error: null };

        if (resolvedChainType.startsWith('solana')) {
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
        }

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
          createdBy: req.user.userId,
          chainType: resolvedChainType
        });

        eventBus.publish('agent.registered', {
          orgId: agent.org_id || null,
          agentId: agent.agent_id,
          pubkey: agent.pubkey,
          name: agent.name,
          credentialType: agent.credential_type || 'CRYPTOGRAPHIC'
        });

        // 7. Return created agent with SAID status
        return res.status(201).json({
          agent: transformAgent(agent),
          agentId: agent.agent_id,
          said: saidStatus
        });
      } catch (err) {
        // Decrement rate limit counter on registration failure so legitimate retries aren't blocked
        try {
          await redis.decr(pubkeyThrottleKey);
        } catch (decrErr) {
          console.warn('Failed to decrement registration rate limit:', decrErr.message);
        }
        throw err;
      }

    } else if (credential_type === 'oauth2' || credential_type === 'entra_id') {
      const { token, name: agentName, description, capabilities = [] } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token is required for OAuth2 registration' });
      }
      if (!agentName || agentName.length < 1 || agentName.length > 255) {
        return res.status(400).json({ error: 'Agent name is required (1-255 characters)' });
      }

      // Validate capabilities
      if (!Array.isArray(capabilities) || capabilities.length > 50) {
        return res.status(400).json({ error: 'Capabilities must be an array of max 50 items' });
      }

      const authConfig = require('../auth/authConfig');
      const strategyConfig = authConfig.getStrategyConfig(credential_type);

      const result = await authManager.registerAgent(credential_type, {
        token,
        allowedIssuers: strategyConfig?.allowedIssuers || [],
        expectedAudience: strategyConfig?.allowedAudiences || undefined,
      });

      if (!result.verified || !result.identity) {
        return res.status(401).json({ error: 'External token validation failed' });
      }

      const { externalId, provider, email, name: claimName } = result.identity;

      // Check for duplicate by external ID
      const existingAgent = await getAgentByExternalId(externalId, provider, req.user.orgId);
      if (existingAgent) {
        return res.status(409).json({ error: 'Agent with this external identity already exists', agentId: existingAgent.agent_id });
      }

      // Create agent record
      const agent = await createAgent({
        pubkey: externalId,
        name: agentName,
        description: description || null,
        capabilitySet: capabilities,
        orgId: req.user.orgId,
        createdBy: req.user.userId,
        chainType: credential_type,
        credentialType: credential_type,
        externalId,
        idpProvider: provider,
      });

      eventBus.publish('agent.registered', {
        orgId: agent.org_id || null,
        agentId: agent.agent_id,
        pubkey: agent.pubkey,
        name: agent.name,
        credentialType: agent.credential_type || credential_type.toUpperCase()
      });

      return res.status(201).json({
        agent,
        agentId: agent.agent_id,
        credentialType: credential_type,
        provider,
      });
    } else {
      return res.status(400).json({ error: 'Unsupported credential type' });
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
