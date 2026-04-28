'use strict';

const { AuthStrategy } = require('./base');
const { getChainAdapter } = require('../../services/chainAdapters');
const { issueChallenge } = require('../../services/pkiChallenge');

class CryptographicAuthStrategy extends AuthStrategy {
  get name() {
    return 'crypto';
  }

  /**
   * Validate ownership via chain-specific signature verification.
   * @param {Object} payload
   * @param {string} payload.pubkey
   * @param {string} payload.signature
   * @param {string} payload.message
   * @param {string} payload.chainType - e.g. 'solana-bags', 'ethereum'
   * @returns {Promise<{valid: boolean, identity: Object}>}
   */
  async validateCredentials({ pubkey, signature, message, chainType = 'solana-bags' }) {
    let adapter;
    try {
      adapter = getChainAdapter(chainType);
    } catch {
      throw new Error(`Unsupported chain type: ${chainType}`);
    }

    const isValid = await adapter.validateAddress(pubkey);
    if (!isValid) {
      return { valid: false, identity: null };
    }

    const verified = await adapter.verifyOwnership(pubkey, signature, message);
    return {
      valid: verified,
      identity: verified ? { pubkey, chainType, credentialType: 'crypto' } : null,
    };
  }

  /**
   * Issue a PKI challenge for agent verification.
   * Delegates to chain adapter's initChallenge if available, otherwise uses local pkiChallenge.
   * @param {Object} params
   * @param {string} params.pubkey
   * @param {string} params.chainType
   * @param {string} [params.agentId] - Required for local challenge issuance
   * @returns {Promise<Object>} Challenge data
   */
  async getRegistrationChallenge({ pubkey, chainType = 'solana-bags', agentId }) {
    let adapter;
    try {
      adapter = getChainAdapter(chainType);
    } catch {
      throw new Error(`Unsupported chain type: ${chainType}`);
    }

    // Some adapters (BAGS) have their own challenge init
    if (typeof adapter.initChallenge === 'function') {
      return adapter.initChallenge(pubkey);
    }

    // Fall back to local PKI challenge (requires agentId)
    if (agentId) {
      return issueChallenge(agentId, pubkey);
    }

    // No challenge available without agentId or adapter support
    return null;
  }

  /**
   * Verify a registration payload (signature against challenge).
   * @param {Object} params
   * @param {string} params.pubkey
   * @param {string} params.signature
   * @param {string} params.message
   * @param {string} params.nonce
   * @param {string} params.chainType
   * @returns {Promise<{verified: boolean, identity: Object}>}
   */
  async verifyRegistration({ pubkey, signature, message, nonce, chainType = 'solana-bags' }) {
    let adapter;
    try {
      adapter = getChainAdapter(chainType);
    } catch {
      throw new Error(`Unsupported chain type: ${chainType}`);
    }

    // Validate address format
    const validAddress = await adapter.validateAddress(pubkey);
    if (!validAddress) {
      return { verified: false, identity: null };
    }

    // Verify nonce is embedded in the message (replay prevention)
    if (nonce && !message.includes(nonce)) {
      return { verified: false, identity: null };
    }

    // Verify signature
    const verified = await adapter.verifyOwnership(pubkey, signature, message);
    return {
      verified,
      identity: verified
        ? { pubkey, chainType, credentialType: 'crypto' }
        : null,
    };
  }
}

module.exports = { CryptographicAuthStrategy };
