'use strict';

/**
 * Verification Queries
 * PKI challenge-response verification database operations
 */

const { query } = require('./db');

// ============================================================================
// Verification Queries
// ============================================================================

/**
 * Create a new verification challenge
 * @param {Object} params - Verification data
 * @returns {Promise<Object>} - Created verification row
 */
async function createVerification({ agentId, pubkey, nonce, challenge, expiresAt }) {
  const sql = `
    INSERT INTO agent_verifications 
      (agent_id, pubkey, nonce, challenge, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await query(sql, [agentId, pubkey, nonce, challenge, expiresAt]);
  return result.rows[0];
}

/**
 * Get a pending verification by agent_id and nonce
 * @param {string} agentId - Agent UUID
 * @param {string} nonce - Verification nonce
 * @returns {Promise<Object|null>} - Verification row or null
 */
async function getVerification(agentId, nonce) {
  const sql = `
    SELECT * FROM agent_verifications 
    WHERE agent_id = $1 
      AND nonce = $2 
      AND completed = false 
      AND expires_at > NOW()
  `;
  const result = await query(sql, [agentId, nonce]);
  return result.rows[0] || null;
}

/**
 * Mark a verification as completed
 * @param {string} nonce - Verification nonce
 * @returns {Promise<Object|null>} - Updated verification row
 */
async function completeVerification(nonce) {
  const sql = `
    UPDATE agent_verifications 
    SET completed = true 
    WHERE nonce = $1 
    RETURNING *
  `;
  const result = await query(sql, [nonce]);
  return result.rows[0] || null;
}

module.exports = {
  createVerification,
  getVerification,
  completeVerification
};
