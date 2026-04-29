/**
 * Registration Routes
 * Handles agent registration with Bags auth and SAID binding
 */

const express = require('express');
const { verifyBagsSignature } = require('../services/bagsAuthVerifier');
const { getChainAdapter, getSupportedChains } = require('../services/chainAdapters');
const { registerWithSAID } = require('../services/saidBinding');
const { authenticate } = require('../middleware/authenticate');
const { createAgent, getAgentByPubkey, getAgentByExternalId } = require('../models/agentQueries');
const authManager = require('../auth/authManager');
const { registrationLimiter } = require('../middleware/rateLimit');
const { redis } = require('../models/redis');
const { transformAgent, isValidSolanaAddress } = require('../utils/transform');
const eventBus = require('../services/eventBus');
const { cryptoRegistrationSchema, oauthRegistrationSchema } = require('../schemas');
const { meterEvent } = require('../middleware/billingMeter');
const { enforceQuota } = require('../middleware/quotaEnforcement');

const router = express.Router();

// Atomic INCR+EXPIRE Lua script for rate limiting (shared by crypto and OAuth branches)
const luaScript = `
  local v = redis.call('INCR', KEYS[1])
  if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return v
`;

/**
 * POST /register
 * Full agent registration flow
 */
router.post('/register', authenticate, enforceQuota('attestation'), meterEvent('attestation'), registrationLimiter, async (req, res, next) => {
  try {
    const { credential_type = 'crypto' } = req.body;

    if (credential_type === 'crypto') {
      // Zod validation
      const parsed = cryptoRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      req.body = parsed.data;

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
      // Zod validation
      const parsed = oauthRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      req.body = parsed.data;

      const { token, name: agentName, description, capabilities = [] } = req.body;

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

      // Per-identity throttle for OAuth/Entra registrations
      const oauthThrottleKey = `reg:oauth:${req.orgId || req.user?.orgId || 'default'}:${externalId}`;
      const oauthRegCount = await redis.eval(
        luaScript,
        1,
        oauthThrottleKey,
        86400
      );
      if (oauthRegCount > 5) {
        return res.status(429).json({ error: 'Too many registrations for this identity. Try again in 24 hours.' });
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
