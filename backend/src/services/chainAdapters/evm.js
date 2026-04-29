/**
 * EVM Chain Adapter (Ethereum / Base / Polygon)
 * Supports SECP256K1 signature verification via ethers.js
 */

const crypto = require('crypto');
const { computeReputation, calcSuccessRate, calcAgeFactor, calcFlagFactor } = require('../reputationScorer');
const { logger } = require('../../utils/logger');

// Eager dependency check — fail fast if ethers is missing
let ethers;
try {
  ethers = require('ethers');
} catch (err) {
  logger.error('ethers package is required for EVM chain adapters. Install with: npm install ethers');
  // Don't throw — allow server to start, but EVM operations will fail gracefully
}

// Chain-specific configurations
const CHAIN_CONFIGS = {
  ethereum: {
    name: 'Ethereum',
    chainId: '1',
    explorerApi: 'https://api.etherscan.io/api',
    explorerKeyEnv: 'ETHERSCAN_API_KEY'
  },
  base: {
    name: 'Base',
    chainId: '8453',
    explorerApi: 'https://api.basescan.org/api',
    explorerKeyEnv: 'BASESCAN_API_KEY'
  },
  polygon: {
    name: 'Polygon',
    chainId: '137',
    explorerApi: 'https://api.polygonscan.com/api',
    explorerKeyEnv: 'POLYGONSCAN_API_KEY'
  }
};

function createEVMAdapter(chainKey) {
  const chainConfig = CHAIN_CONFIGS[chainKey];

  return {
    getChainMeta() {
      return {
        name: chainConfig.name,
        chainId: chainConfig.chainId,
        addressFormat: 'hex',
        signingAlgo: 'SECP256K1'
      };
    },

    async validateAddress(address) {
      if (!ethers) return false;
      try {
        return ethers.isAddress(address);
      } catch {
        return false;
      }
    },

    async initChallenge(address) {
      const nonce = crypto.randomBytes(32).toString('hex');
      const timestamp = Date.now();
      const message = `AGENTID-VERIFY:${address}:${nonce}:${timestamp}`;
      return { message, nonce };
    },

    async verifyOwnership(address, signature, challenge) {
      if (!ethers) throw new Error('EVM operations require the ethers package');
      try {
        // EIP-191 personal_sign verification
        const recoveredAddress = ethers.verifyMessage(challenge, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
      } catch (err) {
        logger.error({ err, chain: chainConfig.name }, 'EVM signature verification error');
        return false;
      }
    },

    async getReputationData(agentId, prefetched = {}) {
      // EVM reputation: based on local DB data + optional block explorer data
      return computeReputation(agentId, prefetched, {
        scoringModel: 'evm-v1',
        chainType: chainConfig.name.toLowerCase(),
        cacheTTL: 300,
        async computeFactors(agent, actions, flagCount) {
          let score = 0;
          const breakdown = {};

          // Factor 1: Action success rate (30 pts max)
          const sr = calcSuccessRate(actions, 30);
          breakdown.successRate = { score: sr.score, max: 30 };
          score += sr.score;

          // Factor 2: Registration age (20 pts max)
          const age = calcAgeFactor(agent.registered_at, 20);
          breakdown.age = { score: age.score, max: 20 };
          score += age.score;

          // Factor 3: On-chain activity via block explorer (30 pts max)
          breakdown.onChainActivity = { score: 0, max: 30 };
          try {
            const apiKey = process.env[chainConfig.explorerKeyEnv];
            if (apiKey && agent.pubkey) {
              const axios = require('axios');
              const resp = await axios.get(chainConfig.explorerApi, {
                params: {
                  module: 'account',
                  action: 'txlist',
                  address: agent.pubkey,
                  startblock: 0,
                  endblock: 99999999,
                  page: 1,
                  offset: 100,
                  sort: 'desc',
                  apikey: apiKey
                },
                timeout: 5000
              });
              if (resp.data?.status === '1' && Array.isArray(resp.data.result)) {
                const txCount = resp.data.result.length;
                breakdown.onChainActivity.score = Math.min(30, Math.floor(txCount * 0.3));
              }
            }
          } catch (err) {
            logger.warn({ err, chain: chainConfig.name }, 'Block explorer API error');
          }
          score += breakdown.onChainActivity.score;

          // Factor 4: Community trust (20 pts max, zeroed at 2+ unresolved flags)
          const flags = calcFlagFactor(flagCount, 20, 2);
          breakdown.communityTrust = { score: flags.score, max: 20 };
          score += flags.score;

          return { score, breakdown };
        }
      });
    }
  };
}

module.exports = {
  ethereum: createEVMAdapter('ethereum'),
  base: createEVMAdapter('base'),
  polygon: createEVMAdapter('polygon'),
  createEVMAdapter // Export factory for custom EVM chains
};
