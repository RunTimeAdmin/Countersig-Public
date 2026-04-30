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
const { computeReputation, calcSuccessRate, calcAgeFactor, calcFlagFactor } = require('../reputationScorer');
const { challengeStore } = require('../../models/challengeStore');
const { getLogger } = require('../../utils/logger');

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
    // Store nonce to prevent replay attacks (5-min TTL)
    const storeKey = `solana-nonce:${pubkey}:${nonce}`;
    await challengeStore.setChallenge(storeKey, JSON.stringify({ pubkey, nonce, timestamp }), 300);
    return { message, nonce };
  },

  async verifyOwnership(pubkey, signature, challenge) {
    try {
      // Extract nonce from challenge message (format: AGENTID-VERIFY:{pubkey}:{nonce}:{timestamp})
      const parts = challenge.split(':');
      if (parts.length < 4) throw new Error('Invalid challenge format');
      const nonce = parts[2];

      // Verify the nonce exists and hasn't been consumed
      const storeKey = `solana-nonce:${pubkey}:${nonce}`;
      const stored = await challengeStore.getChallenge(storeKey);
      if (!stored) throw new Error('Challenge expired or already used');

      // For generic Solana, challenge is a UTF-8 string that was signed
      const messageBytes = new TextEncoder().encode(challenge);
      const signatureBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(pubkey);
      const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);

      // Consume nonce on successful verification to prevent replay
      if (valid) {
        await challengeStore.deleteChallenge(storeKey);
        await challengeStore.markNonceUsed(nonce, 300);
      }

      return valid;
    } catch (err) {
      getLogger().error({ err }, '[SolanaGeneric] Signature verification error');
      return false;
    }
  },

  async getReputationData(agentId, prefetched = {}) {
    // Generic Solana reputation: based on local DB data only (no BAGS analytics)
    // Uses: action success rate, registration age, SAID trust, community flags
    return computeReputation(agentId, prefetched, {
      scoringModel: 'generic-v1',
      chainType: 'solana',
      cacheTTL: 300,
      async computeFactors(agent, actions, flagCount) {
        let score = 0;
        const breakdown = {};

        // Factor 1: Action success rate (35 pts max)
        const sr = calcSuccessRate(actions, 35);
        breakdown.successRate = { score: sr.score, max: 35 };
        score += sr.score;

        // Factor 2: Registration age (25 pts max, +1/day, cap at 25)
        const age = calcAgeFactor(agent.registered_at, 25);
        breakdown.age = { score: age.score, max: 25 };
        score += age.score;

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
        const flags = calcFlagFactor(flagCount, 15, 2);
        breakdown.communityTrust = { score: flags.score, max: 15 };
        score += flags.score;

        return { score, breakdown };
      }
    });
  }
};
