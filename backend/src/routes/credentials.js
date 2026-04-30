/**
 * Credential Verification Routes
 * Public endpoint for verifying W3C Verifiable Credentials issued by Countersig
 */

const express = require('express');
const router = express.Router();
const { query } = require('../models/db');
const { verifyCredentialSignature } = require('../services/authService');
const { getLogger } = require('../utils/logger');

const logger = getLogger('credentials');

/**
 * POST /credentials/verify
 * Public endpoint — verify a W3C Verifiable Credential
 */
router.post('/credentials/verify', async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'credential is required' });
    }

    const checks = {
      signature: false,
      expiration: false,
      issuer: false,
      revocation: false
    };

    // 1. Check issuer
    const issuer = credential.issuer?.id || credential.issuer;
    checks.issuer = issuer === 'did:web:countersig.com';

    // 2. Check expiration
    if (credential.expirationDate) {
      checks.expiration = new Date(credential.expirationDate) > new Date();
    } else {
      // No expiration means it doesn't expire — pass the check
      checks.expiration = true;
    }

    // 3. Verify signature
    if (credential.proof?.proofValue &&
        credential.proof.proofValue !== 'UNSIGNED_CREDENTIAL_REQUIRES_DID_KEY_CONFIGURATION') {
      try {
        const { proof, ...credentialWithoutProof } = credential;
        checks.signature = await verifyCredentialSignature(
          proof.proofValue,
          credentialWithoutProof
        );
      } catch (err) {
        logger.warn({ err: err.message }, 'Credential signature verification failed');
        checks.signature = false;
      }
    }

    // 4. Check revocation status
    const agentId = credential.credentialSubject?.agentId;
    if (agentId) {
      try {
        const result = await query(
          'SELECT status, revoked_at FROM agent_identities WHERE agent_id = $1 AND deleted_at IS NULL',
          [agentId]
        );
        if (result.rows.length) {
          checks.revocation = result.rows[0].status !== 'revoked' && !result.rows[0].revoked_at;
        } else {
          // Agent not found — can't confirm revocation status
          checks.revocation = false;
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Revocation check DB error');
        checks.revocation = false;
      }
    }

    const verified = Object.values(checks).every(Boolean);

    res.json({
      verified,
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
