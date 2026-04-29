/**
 * Agent Routes
 * Handles agent listing, detail retrieval, and A2A discovery
 */

const express = require('express');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { getAgent, getAgentsByOwner, listAgents, countAgents, discoverAgents, updateAgent, revokeAgent } = require('../models/queries');
const { pool } = require('../models/db');
const { logAction } = require('../services/auditService');
const { computeBagsScore } = require('../services/bagsReputation');
const { getSupportedChains } = require('../services/chainAdapters');
const { defaultLimiter, authLimiter } = require('../middleware/rateLimit');
const { optionalAuth, authenticate } = require('../middleware/authenticate');
const { requireScope } = require('../middleware/authorize');
const { orgContext } = require('../middleware/orgContext');
const { transformAgent, transformAgents, isValidSolanaAddress } = require('../utils/transform');
const { generateA2AToken, verifyA2AToken } = require('../services/authService');
const eventBus = require('../services/eventBus');
const config = require('../config');
const { validate } = require('../middleware/validate');
const { agentUpdateSchema } = require('../schemas');

const router = express.Router();

// Timestamp window for replay protection (5 minutes in milliseconds)
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

/**
 * GET /chains
 * List all supported chain types and their metadata
 */
router.get('/chains', defaultLimiter, async (req, res, next) => {
  try {
    const chains = getSupportedChains();
    return res.status(200).json({ chains, count: chains.length });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents
 * List agents with optional filters (requires authentication, scoped to org)
 */
router.get('/agents', authenticate, requireScope('read'), defaultLimiter, async (req, res, next) => {
  try {
    const { status, capability, limit, offset, includeDemo } = req.query;

    // Parse and validate pagination params
    let parsedLimit = parseInt(limit, 10) || 50;
    let parsedOffset = parseInt(offset, 10) || 0;

    // Enforce max limit
    if (parsedLimit > 100) {
      parsedLimit = 100;
    }

    const orgId = req.user.orgId;

    const agents = await listAgents({
      status,
      capability,
      limit: parsedLimit,
      offset: parsedOffset,
      includeDemo: includeDemo === 'true',
      orgId
    });

    // Get total count for pagination
    const total = await countAgents({ status, capability, includeDemo: includeDemo === 'true', orgId });

    return res.status(200).json({
      agents: transformAgents(agents),
      total,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /public/agents
 * Public registry - only shows agents with limited fields (no sensitive data)
 */
router.get('/public/agents', defaultLimiter, async (req, res, next) => {
  try {
    const { status, capability, chain, limit, offset } = req.query;

    let parsedLimit = parseInt(limit, 10) || 50;
    let parsedOffset = parseInt(offset, 10) || 0;

    if (parsedLimit > 100) {
      parsedLimit = 100;
    }

    const agents = await listAgents({
      status: status || undefined,
      capability,
      chain,
      limit: parsedLimit,
      offset: parsedOffset,
      includeDemo: false,
      orgId: null
    });

    const total = await countAgents({ status: status || undefined, capability, chain, includeDemo: false, orgId: null });

    // Transform to camelCase and return public-safe fields
    const publicAgents = transformAgents(agents).map(a => ({
      agentId: a.agentId,
      name: a.name,
      pubkey: a.pubkey,
      status: a.status,
      bagsScore: a.bagsScore,
      capabilities: a.capabilities,
      registeredAt: a.registeredAt,
      chainType: a.chainType,
      totalActions: a.totalActions
    }));

    return res.status(200).json({
      agents: publicAgents,
      total,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents/owner/:pubkey
 * Get all agents owned by a pubkey (must be defined BEFORE /:agentId route)
 */
router.get('/agents/owner/:pubkey', authenticate, requireScope('read'), defaultLimiter, async (req, res, next) => {
  try {
    const { pubkey } = req.params;

    if (!isValidSolanaAddress(pubkey)) {
      return res.status(400).json({ error: 'Invalid Solana public key format' });
    }

    const agents = await getAgentsByOwner(pubkey, req.user.orgId);

    return res.status(200).json({
      pubkey,
      agents: transformAgents(agents),
      count: agents.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /agents/verify-token
 * Public endpoint — verify an A2A token server-side
 * No auth required — allows agents without the shared secret to verify tokens
 */
router.post('/verify-token', defaultLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const decoded = await verifyA2AToken(token);
    res.json({ valid: true, payload: decoded });
  } catch (err) {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

/**
 * GET /agents/:agentId/credential
 * Returns a W3C Verifiable Credential for the agent
 */
router.get('/agents/:agentId/credential', defaultLimiter, async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await getAgent(agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Determine the DID method based on chain type
    const chainType = agent.chain_type || 'solana-bags';
    let subjectDid;
    if (chainType.startsWith('solana')) {
      // Solana agents use did:key with Ed25519 public key
      subjectDid = `did:key:${agent.pubkey}`;
    } else {
      // EVM agents use did:pkh (PKH = public key hash)
      const chainId = chainType === 'ethereum' ? '1' : chainType === 'base' ? '8453' : chainType === 'polygon' ? '137' : '1';
      subjectDid = `did:pkh:eip155:${chainId}:${agent.pubkey}`;
    }

    // Determine verification status
    const isVerified = agent.status === 'verified' && !agent.revoked_at;
    const verificationMethod = chainType.startsWith('solana') 
      ? 'did:web:agentidapp.com#ed25519-key'
      : 'did:web:agentidapp.com#secp256k1-key';

    // Build reputation data
    let reputationScore = agent.bags_score || 0;
    let reputationLabel = reputationScore >= 80 ? 'HIGH' : reputationScore >= 50 ? 'MEDIUM' : reputationScore >= 20 ? 'LOW' : 'NEW AGENT';

    const now = new Date().toISOString();
    
    const isCredentialSigned = false; // TODO: flip to true once Data Integrity Proof signing is implemented

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
        {
          'AgentIDCredential': 'https://agentidapp.com/schemas/credential/v1',
          'agentName': 'https://agentidapp.com/schemas/credential/v1#agentName',
          'chainType': 'https://agentidapp.com/schemas/credential/v1#chainType',
          'reputationScore': 'https://agentidapp.com/schemas/credential/v1#reputationScore',
          'reputationLabel': 'https://agentidapp.com/schemas/credential/v1#reputationLabel',
          'capabilities': 'https://agentidapp.com/schemas/credential/v1#capabilities',
          'verificationStatus': 'https://agentidapp.com/schemas/credential/v1#verificationStatus',
          'registeredAt': 'https://agentidapp.com/schemas/credential/v1#registeredAt',
          'lastVerified': 'https://agentidapp.com/schemas/credential/v1#lastVerified'
        }
      ],
      id: `urn:agentid:credential:${agentId}`,
      type: ['VerifiableCredential', 'AIAgentIdentityCredential'],
      issuer: {
        id: 'did:web:agentidapp.com',
        name: 'AgentID',
        url: 'https://agentidapp.com'
      },
      issuanceDate: now,
      expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h validity
      credentialSubject: {
        id: subjectDid,
        agentId: agent.agent_id,
        agentName: agent.name,
        chainType: chainType,
        publicKey: agent.pubkey,
        reputationScore: reputationScore,
        reputationLabel: reputationLabel,
        capabilities: agent.capability_set || [],
        verificationStatus: isVerified ? 'VERIFIED' : agent.revoked_at ? 'REVOKED' : 'UNVERIFIED',
        registeredAt: agent.registered_at,
        lastVerified: agent.last_verified || null
      },
      credentialStatus: {
        id: `${config.agentIdBaseUrl}/agents/${agentId}`,
        type: 'AgentIDStatusCheck2024',
        statusPurpose: 'revocation'
      },
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: chainType.startsWith('solana') ? 'eddsa-rdfc-2022' : 'ecdsa-rdfc-2019',
        created: now,
        verificationMethod: verificationMethod,
        proofPurpose: 'assertionMethod',
        // Note: In production, this would contain an actual cryptographic signature
        // For now, we include a placeholder indicating server-side signing is needed
        proofValue: 'UNSIGNED_CREDENTIAL_REQUIRES_DID_KEY_CONFIGURATION'
      },
      ...(!isCredentialSigned && {
        demo: true,
        warning: 'This credential is unsigned — Verifiable Credential signing not yet implemented'
      })
    };

    // Set appropriate content type for W3C VC
    res.setHeader('Content-Type', 'application/vc+ld+json');
    res.json(credential);
  } catch (err) {
    console.error('[VC] Credential generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate credential' });
  }
});

/**
 * POST /agents/:agentId/issue-token
 * Issue a short-lived A2A authentication token for cross-agent communication
 * Requires authentication and write scope
 */
router.post('/agents/:agentId/issue-token', authenticate, requireScope('write'), authLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    // 1. Verify agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    // 2. Verify the agent belongs to the requesting user's org (or is public)
    if (agent.org_id && agent.org_id !== req.user.orgId) {
      return res.status(403).json({
        error: 'Access denied: agent does not belong to your organization'
      });
    }

    // 3. Verify the agent's status is active/verified (not revoked or flagged)
    if (agent.status === 'revoked' || agent.status === 'flagged') {
      return res.status(403).json({
        error: `Cannot issue token for agent with status: ${agent.status}`,
        agentId,
        status: agent.status
      });
    }

    // 4. Generate short-lived A2A token (60 seconds)
    const tokenPayload = {
      sub: agentId,
      type: 'a2a',
      name: agent.name,
      pubkey: agent.pubkey,
      chain: agent.chain_type,
      caps: agent.capability_set || [],
      score: agent.bags_score
    };

    // Add OAuth-specific claims if applicable
    if (agent.credential_type && agent.credential_type !== 'crypto') {
      tokenPayload.credentialType = agent.credential_type;
      tokenPayload.externalId = agent.external_id;
      tokenPayload.provider = agent.idp_provider;
    }

    const token = await generateA2AToken(tokenPayload);

    // 5. Log the token issuance
    logAction({
      orgId: agent.org_id,
      actorId: req.user?.userId,
      actorType: 'user',
      action: 'agent.issue_a2a_token',
      resourceType: 'agent',
      resourceId: agentId,
      metadata: { agentName: agent.name }
    }).catch(() => {});

    // 6. Return token
    return res.status(200).json({
      token,
      expiresIn: 60,
      agentId,
      issuedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents/:agentId
 * Get single agent detail with reputation score
 */
router.get('/agents/:agentId', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    // Fetch reputation score
    const reputation = await computeBagsScore(agentId);

    return res.status(200).json({
      agent: transformAgent(agent),
      reputation: {
        score: reputation.score,
        label: reputation.label,
        breakdown: reputation.breakdown
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /discover
 * A2A discovery - find agents by capability (requires authentication)
 */
router.get('/discover', authenticate, requireScope('read'), defaultLimiter, async (req, res, next) => {
  try {
    const { capability } = req.query;

    // Validate capability is provided
    if (!capability) {
      return res.status(400).json({
        error: 'capability query parameter is required'
      });
    }

    const agents = await discoverAgents({ capability });

    return res.status(200).json({
      agents: transformAgents(agents),
      capability,
      count: agents.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orgs/:orgId/agents
 * List agents filtered by organization
 */
router.get('/orgs/:orgId/agents', authenticate, orgContext, requireScope('read'), defaultLimiter, async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { status, capability, limit, offset, includeDemo } = req.query;

    let parsedLimit = parseInt(limit, 10) || 50;
    let parsedOffset = parseInt(offset, 10) || 0;
    if (parsedLimit > 100) {
      parsedLimit = 100;
    }

    const agents = await listAgents({
      status,
      capability,
      limit: parsedLimit,
      offset: parsedOffset,
      includeDemo: includeDemo === 'true',
      orgId
    });

    const total = await countAgents({ status, capability, includeDemo: includeDemo === 'true', orgId });

    return res.status(200).json({
      agents: transformAgents(agents),
      total,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /agents/:agentId/update
 * Update agent metadata with signature verification
 */
router.put('/agents/:agentId/update', authenticate, requireScope('write'), authLimiter, validate(agentUpdateSchema), async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { signature, timestamp, name, tokenMint, capabilities, creatorX, description } = req.body;

    // 2. Check agent exists and get pubkey for verification
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    // 2.5 Verify org ownership
    if (agent.org_id !== req.user.orgId) {
      return res.status(403).json({
        error: 'Access denied: agent does not belong to your organization'
      });
    }

    const pubkey = agent.pubkey;

    // 3. Verify ownership: construct message and verify Ed25519 signature
    // Compute hash of the fields being updated to bind signature to payload
    const updateFieldsForHash = { name, description, capabilities, creatorX, tokenMint };
    const fieldsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(updateFieldsForHash))
      .digest('hex');

    // The expected message now includes the fields hash
    const expectedMessage = `AGENTID-UPDATE:${agentId}:${timestamp}:${fieldsHash}`;
    // Old format for backward compatibility
    const legacyMessage = `AGENTID-UPDATE:${agentId}:${timestamp}`;
    let isSignatureValid = false;

    try {
      const messageBytes = Buffer.from(expectedMessage, 'utf-8');
      const sigBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(pubkey);

      isSignatureValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);

      // New format verified — permanently disable legacy fallback for this agent
      if (isSignatureValid) {
        pool.query('UPDATE agent_identities SET legacy_signing_disabled = true WHERE agent_id = $1', [agentId]).catch(() => {});
      }

      // Backward compatibility: try legacy format if new format fails
      if (!isSignatureValid) {
        // Hard sunset for legacy signing format
        const LEGACY_DEADLINE = parseInt(process.env.LEGACY_SIGNING_DEADLINE, 10) ||
          new Date('2026-07-01').getTime(); // Default: July 1, 2026
        if (Date.now() > LEGACY_DEADLINE) {
          return res.status(400).json({
            error: 'Legacy signature format is no longer accepted. Please use the current signing format.',
            migrationGuide: 'Sign: AGENTID-UPDATE:{agentId}:{timestamp}:{fieldHash}'
          });
        }

        // Reject if legacy signing has been disabled for this agent
        if (agent.legacy_signing_disabled) {
          return res.status(401).json({ error: 'Legacy signature format no longer accepted for this agent' });
        }
        const legacyBytes = Buffer.from(legacyMessage, 'utf-8');
        isSignatureValid = nacl.sign.detached.verify(legacyBytes, sigBytes, pubkeyBytes);
        if (isSignatureValid) {
          logAction({
            orgId: agent.org_id,
            actorId: req.user?.userId,
            actorType: 'user',
            action: 'agent.legacy_signature',
            resourceType: 'agent',
            resourceId: agentId,
            metadata: { warning: 'Deprecated legacy signature format used' }
          }).catch(() => {});
        }
      }
    } catch (sigError) {
      console.error('Signature verification error:', sigError.message);
      return res.status(401).json({
        error: 'Invalid signature format'
      });
    }

    if (!isSignatureValid) {
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // 4. Check timestamp is within 5 minutes (replay protection)
    const now = Date.now();
    const timestampAge = now - timestamp;

    if (timestampAge > TIMESTAMP_WINDOW_MS) {
      return res.status(401).json({
        error: 'Timestamp too old. Request must be within 5 minutes.'
      });
    }

    if (timestamp > now + 60000) { // Allow 1 minute clock skew for future timestamps
      return res.status(401).json({
        error: 'Timestamp is in the future'
      });
    }

    // 5. Build update fields (only allowed fields)
    const updateFields = {};

    if (name !== undefined) {
      updateFields.name = name;
    }

    if (tokenMint !== undefined) {
      updateFields.tokenMint = tokenMint;
    }

    if (capabilities !== undefined) {
      updateFields.capabilitySet = capabilities;
    }

    if (creatorX !== undefined) {
      updateFields.creatorX = creatorX;
    }

    if (description !== undefined) {
      updateFields.description = description;
    }

    // Check if there are any fields to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    // 6. Update agent
    const updatedAgent = await updateAgent(agentId, updateFields, req.user.userId);

    if (!updatedAgent) {
      return res.status(500).json({
        error: 'Failed to update agent'
      });
    }

    eventBus.publish('agent.updated', {
      orgId: agent.org_id || null,
      agentId,
      updatedFields: Object.keys(updateFields)
    });

    // 7. Return updated agent
    return res.status(200).json({
      agent: transformAgent(updatedAgent)
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /agents/:agentId/revoke
 * Revoke an agent with signature verification
 */
router.post('/agents/:agentId/revoke', authenticate, requireScope('write'), authLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { pubkey, signature, message } = req.body;

    // 1. Validate required fields
    if (!pubkey || typeof pubkey !== 'string') {
      return res.status(400).json({
        error: 'pubkey is required and must be a string'
      });
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        error: 'signature is required'
      });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'message is required'
      });
    }

    // 2. Check agent exists and get pubkey for verification
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }

    // 2.5 Verify org ownership
    if (req.user.orgId && agent.org_id && agent.org_id !== req.user.orgId) {
      return res.status(403).json({ error: 'Access denied: agent does not belong to your organization' });
    }

    // 3. Check if agent is already revoked
    if (agent.revoked_at) {
      return res.status(410).json({
        error: 'Agent has already been revoked',
        agentId,
        revokedAt: agent.revoked_at
      });
    }

    // 4. Verify ownership: pubkey must match agent's registered owner
    if (agent.pubkey !== pubkey) {
      return res.status(403).json({
        error: 'Only the agent owner can revoke this agent'
      });
    }

    // 5. Parse message to extract timestamp
    // Expected format: AGENTID-REVOKE:{agentId}:{timestamp}
    const messageParts = message.split(':');
    if (messageParts.length !== 3 || messageParts[0] !== 'AGENTID-REVOKE') {
      return res.status(400).json({
        error: 'Invalid message format. Expected: AGENTID-REVOKE:{agentId}:{timestamp}'
      });
    }

    const messageAgentId = messageParts[1];
    const timestamp = parseInt(messageParts[2], 10);

    // Verify agentId in message matches
    if (messageAgentId !== agentId) {
      return res.status(400).json({
        error: 'Agent ID in message does not match URL parameter'
      });
    }

    // 6. Check timestamp is within valid window (replay protection)
    const now = Date.now();
    const timestampAge = now - timestamp;

    if (isNaN(timestamp) || timestampAge > TIMESTAMP_WINDOW_MS) {
      return res.status(401).json({
        error: 'Timestamp too old. Request must be within 5 minutes.'
      });
    }

    if (timestamp > now + 60000) { // Allow 1 minute clock skew for future timestamps
      return res.status(401).json({
        error: 'Timestamp is in the future'
      });
    }

    // 7. Verify Ed25519 signature
    let isSignatureValid = false;

    try {
      const messageBytes = Buffer.from(message, 'utf-8');
      const sigBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(pubkey);

      isSignatureValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
    } catch (sigError) {
      console.error('Signature verification error:', sigError.message);
      return res.status(401).json({
        error: 'Invalid signature format'
      });
    }

    if (!isSignatureValid) {
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // 8. Revoke the agent
    const revokedAgent = await revokeAgent(agentId);

    if (!revokedAgent) {
      return res.status(500).json({
        error: 'Failed to revoke agent'
      });
    }

    eventBus.publish('agent.revoked', {
      orgId: agent.org_id || null,
      agentId,
      revokedBy: req.user?.userId || null
    });

    // 9. Return success response
    return res.status(200).json({
      success: true,
      message: 'Agent revoked successfully',
      agent: transformAgent(revokedAgent),
      revokedAt: revokedAgent.revoked_at
    });

  } catch (error) {
    next(error);
  }
});


module.exports = router;
