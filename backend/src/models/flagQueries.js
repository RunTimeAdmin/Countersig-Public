'use strict';

/**
 * Flag Queries
 * Trust flagging and flag resolution database operations
 */

const { query } = require('./db');
const { invalidateAgentCaches } = require('../services/cacheInvalidation');
const eventBus = require('../services/eventBus');

// ============================================================================
// Flag Queries
// ============================================================================

/**
 * Create a new flag report
 * @param {Object} params - Flag data
 * @returns {Promise<Object>} - Created flag row
 */
async function createFlag({ agentId, pubkey, reporterPubkey, reason, evidence }) {
  const sql = `
    INSERT INTO agent_flags 
      (agent_id, pubkey, reporter_pubkey, reason, evidence)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await query(sql, [
    agentId, pubkey, reporterPubkey, reason, 
    evidence ? JSON.stringify(evidence) : null
  ]);
  await invalidateAgentCaches(agentId);
  eventBus.publish('agent:flagged', { agentId });
  return result.rows[0];
}

/**
 * Get all flags for an agent
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Array>} - Array of flag rows
 */
async function getFlags(agentId) {
  const result = await query(
    'SELECT * FROM agent_flags WHERE agent_id = $1 ORDER BY created_at DESC',
    [agentId]
  );
  return result.rows;
}

/**
 * Get count of unresolved flags for an agent
 * @param {string} agentId - Agent UUID
 * @returns {Promise<number>} - Count of unresolved flags
 */
async function getUnresolvedFlagCount(agentId) {
  const result = await query(
    'SELECT COUNT(*) as count FROM agent_flags WHERE agent_id = $1 AND resolved = false',
    [agentId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Resolve a flag
 * @param {number} id - Flag ID
 * @returns {Promise<Object|null>} - Updated flag row
 */
async function resolveFlag(id) {
  const sql = `
    UPDATE agent_flags 
    SET resolved = true 
    WHERE id = $1 
    RETURNING *
  `;
  const result = await query(sql, [id]);
  if (result.rows[0]) {
    const agentId = result.rows[0].agent_id;
    await invalidateAgentCaches(agentId);
    eventBus.publish('agent:flagged', { agentId });
  }
  return result.rows[0] || null;
}

module.exports = {
  createFlag,
  getFlags,
  getUnresolvedFlagCount,
  resolveFlag
};
