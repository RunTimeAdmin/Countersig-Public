/**
 * Solana Generic Chain Adapter
 * For non-BAGS Solana agents — Ed25519 verification without BAGS API dependency
 *
 * Solana Generic Scoring Weights (total: 100)
 *
 * NOTE: Scoring weights vary by chain adapter. Scores are NOT directly comparable
 * across different chains. A score of 75 on solana-generic may represent different
 * trust characteristics than 75 on bags-chain. Badge labels (HIGH/MEDIUM/LOW)
 * use the same thresholds but underlying factor weights differ.
 *
 * See also: bagsReputation adapter for alternative weight distribution.
 */

const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { getAgent, getAgentActions } = require('../../models/agentQueries');
const { getUnresolvedFlagCount } = require('../../models/flagQueries');
const { getCache, setCache } = require('../../models/redis');

module.exports = {
  getChainMeta() {
    return {
      name: 'Solana',
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

  // Generic Solana: challenge is generated locally, not via BAGS API
  async initChallenge(pubkey) {
    const nonce = require('crypto').randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const message = `AGENTID-VERIFY:${pubkey}:${nonce}:${timestamp}`;
    return { message, nonce };
  },

  async verifyOwnership(pubkey, signature, challenge) {
    try {
      // For generic Solana, challenge is a UTF-8 string that was signed
      const messageBytes = new TextEncoder().encode(challenge);
      const signatureBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(pubkey);
      return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    } catch (err) {
      console.error('[SolanaGeneric] Signature verification error:', err.message);
      return false;
    }
  },

  async getReputationData(agentId, prefetched = {}) {
    // Generic Solana reputation: based on local DB data only (no BAGS analytics)
    // Uses: action success rate, registration age, SAID trust, community flags
    const agent = prefetched.agent || await getAgent(agentId);
    if (!agent) return { score: 0, label: 'UNKNOWN', breakdown: {} };

    const actions = prefetched.actions || await getAgentActions(agentId);
    const flagCount = await getUnresolvedFlagCount(agentId);

    // Check cache
    const cacheKey = `reputation:${agentId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    // 4-factor scoring (no BAGS fee data)
    let score = 0;
    const breakdown = {};

    // Factor 1: Action success rate (35 pts max)
    const totalActions = (actions?.successful || 0) + (actions?.failed || 0);
    if (totalActions > 0) {
      const successRate = actions.successful / totalActions;
      breakdown.successRate = { score: Math.min(35, Math.floor(successRate * 35)), max: 35 };
    } else {
      breakdown.successRate = { score: 0, max: 35 };
    }
    score += breakdown.successRate.score;

    // Factor 2: Registration age (25 pts max, +1/day, cap at 25)
    const ageInDays = Math.floor((Date.now() - new Date(agent.registered_at).getTime()) / (1000 * 60 * 60 * 24));
    breakdown.age = { score: Math.min(25, ageInDays), max: 25 };
    score += breakdown.age.score;

    // Factor 3: SAID trust score (25 pts max)
    try {
      const { getSAIDTrustScore } = require('../saidBinding');
      const saidData = await getSAIDTrustScore(agent.pubkey);
      breakdown.saidTrust = { score: Math.min(25, Math.floor((saidData.score || 0) * 0.25)), max: 25 };
    } catch {
      breakdown.saidTrust = { score: 0, max: 25 };
    }
    score += breakdown.saidTrust.score;

    // Factor 4: Community flags (15 pts max, zeroed at 2+ unresolved)
    breakdown.communityTrust = { score: flagCount >= 2 ? 0 : 15, max: 15 };
    score += breakdown.communityTrust.score;

    const label = score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : score >= 20 ? 'LOW' : 'NEW AGENT';

    const result = { score, label, breakdown };

    // Cache with 300-second TTL
    await setCache(cacheKey, result, 300);

    return result;
  }
};
