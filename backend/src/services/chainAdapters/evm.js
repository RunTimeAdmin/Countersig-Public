/**
 * EVM Chain Adapter (Ethereum / Base / Polygon)
 * Supports SECP256K1 signature verification via ethers.js
 */

const crypto = require('crypto');
const { getAgent, getAgentActions } = require('../../models/agentQueries');
const { getUnresolvedFlagCount } = require('../../models/flagQueries');
const { getCache, setCache } = require('../../models/redis');

// Dynamic import for ethers (installed but may not be available yet)
let ethers;
try {
  ethers = require('ethers');
} catch {
  console.warn('[EVM Adapter] ethers.js not installed. EVM chain support disabled. Run: npm install ethers');
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
      if (!ethers) throw new Error('ethers.js not installed. EVM verification unavailable.');
      try {
        // EIP-191 personal_sign verification
        const recoveredAddress = ethers.verifyMessage(challenge, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
      } catch (err) {
        console.error(`[${chainConfig.name}] Signature verification error:`, err.message);
        return false;
      }
    },

    async getReputationData(agentId, prefetched = {}) {
      // EVM reputation: based on local DB data + optional block explorer data
      const agent = prefetched.agent || await getAgent(agentId);
      if (!agent) return { score: 0, label: 'UNKNOWN', breakdown: {} };

      // Check cache
      const cacheKey = `reputation:${agentId}`;
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const actions = prefetched.actions || await getAgentActions(agentId);
      const flagCount = await getUnresolvedFlagCount(agentId);

      let score = 0;
      const breakdown = {};

      // Factor 1: Action success rate (30 pts max)
      const totalActions = (actions?.successful || 0) + (actions?.failed || 0);
      if (totalActions > 0) {
        const successRate = actions.successful / totalActions;
        breakdown.successRate = { score: Math.min(30, Math.floor(successRate * 30)), max: 30 };
      } else {
        breakdown.successRate = { score: 0, max: 30 };
      }
      score += breakdown.successRate.score;

      // Factor 2: Registration age (20 pts max)
      const ageInDays = Math.floor((Date.now() - new Date(agent.registered_at).getTime()) / (1000 * 60 * 60 * 24));
      breakdown.age = { score: Math.min(20, ageInDays), max: 20 };
      score += breakdown.age.score;

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
        console.warn(`[${chainConfig.name}] Block explorer API error:`, err.message);
      }
      score += breakdown.onChainActivity.score;

      // Factor 4: Community trust (20 pts max, zeroed at 2+ unresolved flags)
      breakdown.communityTrust = { score: flagCount >= 2 ? 0 : 20, max: 20 };
      score += breakdown.communityTrust.score;

      const label = score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : score >= 20 ? 'LOW' : 'NEW AGENT';

      const result = { score, label, breakdown };

      // Cache with 300-second TTL
      await setCache(cacheKey, result, 300);

      return result;
    }
  };
}

module.exports = {
  ethereum: createEVMAdapter('ethereum'),
  base: createEVMAdapter('base'),
  polygon: createEVMAdapter('polygon'),
  createEVMAdapter // Export factory for custom EVM chains
};
