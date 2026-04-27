/**
 * SAID Binding Service
 * Registers/binds agents in the SAID Identity Gateway
 */

const axios = require('axios');
const config = require('../config/index.js');

/**
 * Register an agent with the SAID Identity Gateway
 * @param {Object} params - Agent registration data
 * @param {string} params.pubkey - Agent public key
 * @param {number} params.timestamp - Registration timestamp
 * @param {string} params.signature - Registration signature
 * @param {string} params.name - Agent name
 * @param {string} params.description - Agent description
 * @param {Array<string>} params.capabilities - Agent capabilities
 * @param {string} params.tokenMint - Token mint address
 * @returns {Promise<Object|null>} - SAID response data or null if unavailable
 */
async function registerWithSAID({ pubkey, timestamp, signature, name, description, capabilities, tokenMint }) {
  try {
    const payload = {
      pubkey,
      timestamp,
      signature,
      name,
      description,
      capabilities,
      bags_binding: {
        tokenMint,
        bags_wallet: pubkey,
        agentid_registered_at: new Date().toISOString(),
        capability_set: capabilities
      }
    };

    const response = await axios.post(
      `${config.saidGatewayUrl}/agents/register`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return response.data;
  } catch (error) {
    console.warn('SAID registration unavailable:', error.message);
    return null;
  }
}

/**
 * Get trust score for an agent from SAID
 * @param {string} pubkey - Agent public key
 * @returns {Promise<{score: number, label: string}>} - Trust score and label
 */
async function getSAIDTrustScore(pubkey) {
  try {
    const response = await axios.get(
      `${config.saidGatewayUrl}/agents/${pubkey}`,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Extract trust score from response
    const trustScore = response.data?.trust_score;
    if (trustScore !== undefined) {
      return {
        score: trustScore,
        label: response.data?.trust_label || 'UNKNOWN'
      };
    }

    return { score: 0, label: 'UNKNOWN' };
  } catch (error) {
    console.warn('SAID trust score unavailable:', error.message);
    return { score: 0, label: 'UNKNOWN' };
  }
}

/**
 * Discover agents by capability from SAID
 * @param {string} capability - Capability to search for
 * @returns {Promise<Array>} - Array of agents with the capability
 */
async function discoverSAIDAgents(capability) {
  try {
    const response = await axios.get(
      `${config.saidGatewayUrl}/discover`,
      {
        params: { capability },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return response.data?.agents || [];
  } catch (error) {
    console.warn('SAID discovery unavailable:', error.message);
    return [];
  }
}

module.exports = {
  registerWithSAID,
  getSAIDTrustScore,
  discoverSAIDAgents
};
