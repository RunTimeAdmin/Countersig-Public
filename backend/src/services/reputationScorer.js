'use strict';

/**
 * Shared reputation scoring framework.
 * Eliminates duplication across chain adapters by extracting the common
 * cache → prefetch → compute → label → assemble → cache pipeline.
 *
 * Each chain adapter provides a `computeFactors` callback that returns
 * the chain-specific scoring breakdown.
 */

const { getAgent, getAgentActions } = require('../models/agentQueries');
const { getUnresolvedFlagCount } = require('../models/flagQueries');
const { getCache, setCache } = require('../models/redis');

/**
 * Run the shared reputation scoring pipeline.
 *
 * @param {string} agentId
 * @param {object} prefetched - Optional pre-fetched data { agent, actions }
 * @param {object} options
 * @param {string} options.scoringModel - e.g. 'generic-v1', 'evm-v1'
 * @param {string} options.chainType - e.g. 'solana', 'evm'
 * @param {number} [options.cacheTTL=300] - Cache TTL in seconds
 * @param {function} options.computeFactors - async (agent, actions, flagCount) => { score, breakdown }
 * @returns {Promise<object>} Reputation result
 */
async function computeReputation(agentId, prefetched = {}, options) {
  const { scoringModel, chainType, cacheTTL = 300, computeFactors } = options;

  // 1. Cache check
  const cacheKey = `reputation:${agentId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  // 2. Prefetch common data
  const agent = prefetched.agent || await getAgent(agentId);
  if (!agent) {
    return { agentId, score: 0, label: 'UNKNOWN', error: 'Agent not found' };
  }
  const actions = prefetched.actions || await getAgentActions(agentId);
  const flagCount = await getUnresolvedFlagCount(agentId);

  // 3. Compute chain-specific factors
  const { score, breakdown } = await computeFactors(agent, actions, flagCount);

  // 4. Assign label (shared thresholds)
  const label = score >= 80 ? 'HIGH'
    : score >= 50 ? 'MEDIUM'
    : score >= 20 ? 'LOW'
    : 'NEW AGENT';

  // 5. Assemble result
  const result = {
    agentId,
    score: Math.min(Math.max(Math.round(score), 0), 100),
    label,
    breakdown,
    scoringModel,
    chainType,
    lastUpdated: new Date().toISOString(),
  };

  // 6. Cache result
  await setCache(cacheKey, result, cacheTTL);

  return result;
}

/**
 * Common scoring factor: success rate.
 * Computes total from successful + failed (matching existing adapter logic).
 *
 * @param {object} actions - { successful, failed } or { total, successful }
 * @param {number} maxPoints - Maximum points for this factor
 * @returns {{ score: number, total: number, successful: number, rate: number }}
 */
function calcSuccessRate(actions, maxPoints) {
  const successful = actions?.successful || 0;
  const failed = actions?.failed || 0;
  const total = successful + failed;
  if (total === 0) return { score: 0, total: 0, successful: 0, rate: 0 };
  const rate = successful / total;
  return {
    score: Math.min(maxPoints, Math.floor(rate * maxPoints)),
    total,
    successful,
    rate: Math.round(rate * 100),
  };
}

/**
 * Common scoring factor: agent age (+1 point per day, capped at maxPoints).
 *
 * @param {string|Date} createdAt - Agent creation date
 * @param {number} maxPoints - Maximum points for this factor
 * @returns {{ score: number, days: number }}
 */
function calcAgeFactor(createdAt, maxPoints) {
  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return { score: Math.min(days, maxPoints), days };
}

/**
 * Common scoring factor: community trust based on unresolved flags.
 *
 * @param {number} flagCount - Number of unresolved flags
 * @param {number} maxPoints - Maximum points for this factor
 * @param {number} [threshold=2] - Flag count at which score drops to 0
 * @returns {{ score: number, flagCount: number }}
 */
function calcFlagFactor(flagCount, maxPoints, threshold = 2) {
  return {
    score: flagCount >= threshold ? 0 : maxPoints,
    flagCount,
  };
}

module.exports = {
  computeReputation,
  calcSuccessRate,
  calcAgeFactor,
  calcFlagFactor,
};
