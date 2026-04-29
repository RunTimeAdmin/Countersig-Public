/**
 * Trust Score Propagation Service
 * Computes trust scores using a simplified PageRank algorithm
 * over the attestation graph stored in trust_edges.
 */

const { query } = require('../models/db');
const { getCache, setCache } = require('../models/redis');
const { getLogger } = require('../utils/logger');

/**
 * Record a trust edge when an agent attests another agent.
 * Uses UPSERT to avoid duplicates — updates weight on re-attestation.
 * @param {string} sourceAgentId - The attesting agent's ID
 * @param {string} targetAgentId - The attested agent's ID
 * @param {string} edgeType - Type of edge ('attestation' or 'flag')
 */
async function recordTrustEdge(sourceAgentId, targetAgentId, edgeType = 'attestation') {
  const logger = getLogger();
  try {
    await query(
      `INSERT INTO trust_edges (source_agent_id, target_agent_id, edge_type, weight)
       VALUES ($1, $2, $3, 1.0)
       ON CONFLICT (source_agent_id, target_agent_id, edge_type) 
       DO UPDATE SET weight = trust_edges.weight + 0.1, created_at = NOW()`,
      [sourceAgentId, targetAgentId, edgeType]
    );
    logger.debug({ sourceAgentId, targetAgentId, edgeType }, 'Trust edge recorded');
  } catch (err) {
    logger.error({ err, sourceAgentId, targetAgentId }, 'Failed to record trust edge');
  }
}

/**
 * Compute trust scores using simplified PageRank.
 * - Damping factor: 0.85
 * - Iterations: 10
 * - Normalizes final scores to 0-100 scale
 */
async function computeTrustScores() {
  const logger = getLogger();
  try {
    // Fetch all trust edges
    const edgesResult = await query('SELECT source_agent_id, target_agent_id, weight FROM trust_edges');
    const edges = edgesResult.rows;

    if (edges.length === 0) {
      logger.debug('No trust edges found, skipping trust score computation');
      return;
    }

    // Collect all unique agent IDs
    const agentIds = new Set();
    edges.forEach(e => {
      agentIds.add(e.source_agent_id);
      agentIds.add(e.target_agent_id);
    });

    // Initialize scores
    const scores = {};
    const N = agentIds.size;
    for (const id of agentIds) {
      scores[id] = 1.0 / N;
    }

    // Build adjacency: outDegree and inbound edges
    const outDegree = {};
    const inbound = {}; // target -> [{source, weight}]

    for (const id of agentIds) {
      outDegree[id] = 0;
      inbound[id] = [];
    }

    for (const edge of edges) {
      outDegree[edge.source_agent_id] = (outDegree[edge.source_agent_id] || 0) + edge.weight;
      inbound[edge.target_agent_id] = inbound[edge.target_agent_id] || [];
      inbound[edge.target_agent_id].push({ source: edge.source_agent_id, weight: edge.weight });
    }

    // PageRank iterations
    const DAMPING = 0.85;
    const ITERATIONS = 10;

    for (let i = 0; i < ITERATIONS; i++) {
      const newScores = {};
      for (const id of agentIds) {
        let sum = 0;
        for (const { source, weight } of (inbound[id] || [])) {
          const sourceDeg = outDegree[source] || 1;
          sum += (weight * scores[source]) / sourceDeg;
        }
        newScores[id] = (1 - DAMPING) / N + DAMPING * sum;
      }
      Object.assign(scores, newScores);
    }

    // Normalize to 0-100 scale
    const values = Object.values(scores);
    const maxScore = Math.max(...values);
    const minScore = Math.min(...values);
    const range = maxScore - minScore || 1;

    // Batch update agent_identities
    const updates = [];
    for (const [agentId, score] of Object.entries(scores)) {
      const normalized = Math.round(((score - minScore) / range) * 100 * 100) / 100; // 2 decimal places
      updates.push(query(
        'UPDATE agent_identities SET trust_score = $1 WHERE agent_id = $2',
        [normalized, agentId]
      ));
    }

    await Promise.all(updates);
    logger.info({ agentCount: N, edgeCount: edges.length }, 'Trust scores computed and updated');
  } catch (err) {
    logger.error({ err }, 'Trust score computation failed');
  }
}

module.exports = { recordTrustEdge, computeTrustScores };
