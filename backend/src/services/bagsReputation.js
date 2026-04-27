/**
 * BAGS Reputation Service
 * Computes a Bags-specific reputation score (0-100) using 5 factors
 */

const axios = require('axios');
const config = require('../config/index.js');
const queries = require('../models/queries.js');
const { getSAIDTrustScore } = require('./saidBinding.js');

/**
 * Compute BAGS reputation score for an agent
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Object>} - Score breakdown and total
 */
async function computeBagsScore(agentId) {
  try {
    // Get agent data for token_mint and pubkey
    const agent = await queries.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // 1. Fee Activity (30 points max)
    let feeActivityScore = 0;
    try {
      if (agent.token_mint) {
        const response = await axios.get(
          `https://public-api-v2.bags.fm/api/v1/analytics/fees/token/${agent.token_mint}`,
          { timeout: 5000 }
        );
        const totalFeesSOL = response.data?.totalFeesSOL || 0;
        feeActivityScore = Math.min(30, Math.floor(totalFeesSOL * 10));
      }
    } catch (error) {
      // API failed, score remains 0
      feeActivityScore = 0;
    }

    // 2. Success Rate (25 points max)
    let successRateScore = 0;
    try {
      const actions = await queries.getAgentActions(agentId);
      if (actions) {
        const total = actions.total || 0;
        const successful = actions.successful || 0;
        const successRate = total > 0 ? successful / total : 0;
        successRateScore = Math.floor(successRate * 25);
      }
    } catch (error) {
      successRateScore = 0;
    }

    // 3. Registration Age (20 points max)
    let ageScore = 0;
    try {
      if (agent && agent.registered_at) {
        const ageDays = Math.floor((Date.now() - new Date(agent.registered_at)) / 86400000);
        ageScore = Math.min(20, ageDays);
      }
    } catch (error) {
      ageScore = 0;
    }

    // 4. SAID Trust Score (15 points max)
    let saidTrustScore = 0;
    let saidScore = 0;
    try {
      const saidTrustData = await getSAIDTrustScore(agent.pubkey);
      saidScore = saidTrustData.score || 0;
      saidTrustScore = Math.floor((saidScore / 100) * 15);
    } catch (error) {
      // API failed, score remains 0
      saidTrustScore = 0;
    }

    // 5. Community Verification (10 points max)
    let communityScore = 10;
    try {
      const flagCount = await queries.getUnresolvedFlagCount(agentId);
      if (flagCount === 0) {
        communityScore = 10;
      } else if (flagCount === 1) {
        communityScore = 5;
      } else {
        communityScore = 0;
      }
    } catch (error) {
      communityScore = 10; // Default to full score if query fails
    }

    // Calculate total score
    const totalScore = feeActivityScore + successRateScore + ageScore + saidTrustScore + communityScore;

    // Determine label
    let label;
    if (totalScore >= 80) {
      label = 'HIGH';
    } else if (totalScore >= 60) {
      label = 'MEDIUM';
    } else if (totalScore >= 40) {
      label = 'LOW';
    } else {
      label = 'NEW AGENT';
    }

    return {
      score: totalScore,
      label: label,
      breakdown: {
        feeActivity: { score: feeActivityScore, max: 30 },
        successRate: { score: successRateScore, max: 25 },
        age: { score: ageScore, max: 20 },
        saidTrust: { score: saidTrustScore, max: 15 },
        community: { score: communityScore, max: 10 }
      },
      saidScore: saidScore
    };
  } catch (error) {
    throw new Error(`Failed to compute BAGS score: ${error.message}`);
  }
}

/**
 * Compute and store the BAGS score in the database
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Object>} - Updated agent with new score
 */
async function refreshAndStoreScore(agentId) {
  try {
    const scoreData = await computeBagsScore(agentId);
    const updatedAgent = await queries.updateBagsScore(agentId, scoreData.score);
    return {
      agent: updatedAgent,
      scoreData: scoreData
    };
  } catch (error) {
    throw new Error(`Failed to refresh and store score: ${error.message}`);
  }
}

module.exports = {
  computeBagsScore,
  refreshAndStoreScore
};
