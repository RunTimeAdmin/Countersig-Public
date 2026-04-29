/**
 * SolanaBAGS Chain Adapter
 * Wraps the existing BAGS-specific auth and reputation logic
 * Delegates to bagsAuthVerifier and bagsReputation to avoid duplication
 */

const nacl = require('tweetnacl');
const bs58 = require('bs58');
const axios = require('axios');
const config = require('../../config');
const queries = require('../../models/agentQueries');
const { getCache, setCache } = require('../../models/redis');

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1/agent/v2';

module.exports = {
  getChainMeta() {
    return {
      name: 'Solana (BAGS)',
      chainId: 'solana-mainnet',
      addressFormat: 'base58',
      signingAlgo: 'Ed25519'
    };
  },

  async validateAddress(address) {
    try {
      const decoded = bs58.decode(address);
      return decoded.length === 32;
    } catch {
      return false;
    }
  },

  // BAGS-specific: initiate auth challenge with BAGS API
  async initChallenge(pubkey) {
    const response = await axios.post(
      `${BAGS_API_BASE}/auth/init`,
      { address: pubkey },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.bagsApiKey
        },
        timeout: 10000
      }
    );

    if (!response.data || typeof response.data.message === 'undefined') {
      throw new Error('Invalid response from BAGS auth API');
    }

    return {
      message: response.data.message,
      nonce: response.data.nonce
    };
  },

  async verifyOwnership(pubkey, signature, challenge) {
    // BAGS signatures: message is base58-encoded bytes
    try {
      const messageBytes = bs58.decode(challenge);
      const signatureBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(pubkey);
      return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    } catch (err) {
      console.error('[SolanaBAGS] Signature verification error:', err.message);
      return false;
    }
  },

  async getReputationData(agentId, prefetched = {}) {
    // Delegate to the existing computeBagsScore (already has caching & prefetching)
    const { computeBagsScore } = require('../bagsReputation');
    return computeBagsScore(agentId, prefetched);
  }
};
