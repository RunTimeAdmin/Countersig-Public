/**
 * Reusable database query functions
 * All functions use parameterized queries for safety
 */

const { query } = require('./db');

// ============================================================================
// Agent Identity Queries
// ============================================================================

/**
 * Create a new agent identity
 * @param {Object} params - Agent data
 * @returns {Promise<Object>} - Created agent row
 */
async function createAgent({ pubkey, name, description, tokenMint, capabilitySet, creatorX, creatorWallet, isDemo = false, orgId = null, createdBy = null }) {
  const sql = `
    INSERT INTO agent_identities 
      (pubkey, name, description, token_mint, capability_set, creator_x, creator_wallet, registered_at, is_demo, org_id, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)
    RETURNING *
  `;
  const result = await query(sql, [
    pubkey, name, description, tokenMint,
    JSON.stringify(capabilitySet || []), creatorX, creatorWallet, isDemo,
    orgId, createdBy
  ]);
  return result.rows[0];
}

/**
 * Get an agent by agent_id
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Object|null>} - Agent row or null
 */
async function getAgent(agentId) {
  const result = await query('SELECT * FROM agent_identities WHERE agent_id = $1', [agentId]);
  return result.rows[0] || null;
}

/**
 * Get an agent by pubkey (for backward compatibility / ownership validation)
 * @param {string} pubkey - Agent public key
 * @returns {Promise<Object|null>} - Agent row or null
 */
async function getAgentByPubkey(pubkey, orgId = null) {
  let sql = 'SELECT * FROM agent_identities WHERE pubkey = $1';
  const params = [pubkey];
  if (orgId) {
    sql += ' AND org_id = $2';
    params.push(orgId);
  }
  sql += ' LIMIT 1';
  const result = await query(sql, params);
  return result.rows[0] || null;
}

/**
 * Get all agents owned by a pubkey
 * @param {string} pubkey - Owner public key
 * @returns {Promise<Array>} - Array of agent rows
 */
async function getAgentsByOwner(pubkey, orgId = null) {
  let sql = 'SELECT * FROM agent_identities WHERE pubkey = $1 AND revoked_at IS NULL';
  const params = [pubkey];
  if (orgId) {
    sql += ' AND org_id = $2';
    params.push(orgId);
  }
  sql += ' ORDER BY registered_at DESC';
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Count agents owned by a pubkey
 * @param {string} pubkey - Owner public key
 * @returns {Promise<number>} - Count of agents
 */
async function countAgentsByOwner(pubkey) {
  const result = await query(
    'SELECT COUNT(*) as count FROM agent_identities WHERE pubkey = $1 AND revoked_at IS NULL',
    [pubkey]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Update agent fields dynamically
 * @param {string} agentId - Agent UUID
 * @param {Object} fields - Fields to update
 * @returns {Promise<Object|null>} - Updated agent row
 */
async function updateAgent(agentId, fields, updatedBy = null) {
  const allowedFields = [
    'name', 'description', 'token_mint', 'said_registered',
    'said_trust_score', 'capability_set', 'creator_x', 'creator_wallet',
    'status', 'flag_reason', 'bags_score'
  ];

  const updates = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(fields)) {
    const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(dbField)) {
      updates.push(`${dbField} = $${paramIndex}`);
      values.push(key === 'capabilitySet' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (updates.length === 0 && !updatedBy) return null;

  if (updatedBy) {
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(updatedBy);
  }

  updates.push(`updated_at = NOW()`);

  values.push(agentId);
  const sql = `UPDATE agent_identities SET ${updates.join(', ')} WHERE agent_id = $${paramIndex} RETURNING *`;
  const result = await query(sql, values);
  return result.rows[0] || null;
}

/**
 * List agents with optional filters
 * @param {Object} params - Filter parameters
 * @returns {Promise<Array>} - Array of agent rows
 */
async function listAgents({ status, capability, limit = 20, offset = 0, includeDemo = false, orgId = null } = {}) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  if (capability) {
    conditions.push(`capability_set @> $${paramIndex}::jsonb`);
    values.push(JSON.stringify([capability]));
    paramIndex++;
  }

  if (orgId) {
    conditions.push(`org_id = $${paramIndex}`);
    values.push(orgId);
    paramIndex++;
  }

  // Filter out demo agents by default
  if (!includeDemo) {
    conditions.push(`is_demo = false`);
  }

  // Filter out revoked agents
  conditions.push(`revoked_at IS NULL`);

  values.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM agent_identities
    ${whereClause}
    ORDER BY bags_score DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await query(sql, values);
  return result.rows;
}

/**
 * Update agent status
 * @param {string} agentId - Agent UUID
 * @param {string} status - New status
 * @param {string} flagReason - Optional flag reason
 * @returns {Promise<Object|null>} - Updated agent row
 */
async function updateAgentStatus(agentId, status, flagReason = null) {
  const sql = `
    UPDATE agent_identities 
    SET status = $1, flag_reason = $2 
    WHERE agent_id = $3 
    RETURNING *
  `;
  const result = await query(sql, [status, flagReason, agentId]);
  return result.rows[0] || null;
}

/**
 * Update last_verified timestamp
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Object|null>} - Updated agent row
 */
async function updateLastVerified(agentId) {
  const sql = `
    UPDATE agent_identities 
    SET last_verified = NOW() 
    WHERE agent_id = $1 
    RETURNING *
  `;
  const result = await query(sql, [agentId]);
  return result.rows[0] || null;
}

/**
 * Update BAGS score
 * @param {string} agentId - Agent UUID
 * @param {number} score - New BAGS score
 * @returns {Promise<Object|null>} - Updated agent row
 */
async function updateBagsScore(agentId, score) {
  const sql = `
    UPDATE agent_identities 
    SET bags_score = $1 
    WHERE agent_id = $2 
    RETURNING *
  `;
  const result = await query(sql, [score, agentId]);
  return result.rows[0] || null;
}

/**
 * Increment action counters
 * @param {string} agentId - Agent UUID
 * @param {boolean} success - Whether action was successful
 * @returns {Promise<Object|null>} - Updated agent row
 */
async function incrementActions(agentId, success) {
  const sql = `
    UPDATE agent_identities 
    SET 
      successful_actions = successful_actions + CASE WHEN $1 THEN 1 ELSE 0 END,
      failed_actions = failed_actions + CASE WHEN $1 THEN 0 ELSE 1 END
    WHERE agent_id = $2 
    RETURNING *
  `;
  const result = await query(sql, [success, agentId]);
  return result.rows[0] || null;
}

/**
 * Get agent action statistics
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Object>} - Action stats { total, successful, failed }
 */
async function getAgentActions(agentId) {
  const sql = `
    SELECT successful_actions, failed_actions 
    FROM agent_identities 
    WHERE agent_id = $1
  `;
  const result = await query(sql, [agentId]);
  if (!result.rows[0]) return null;
  
  const row = result.rows[0];
  const successful = parseInt(row.successful_actions, 10) || 0;
  const failed = parseInt(row.failed_actions, 10) || 0;
  return {
    total: successful + failed,
    successful: successful,
    failed: failed
  };
}

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
  return result.rows[0] || null;
}

// ============================================================================
// Discovery Queries
// ============================================================================

/**
 * Discover agents by capability
 * @param {Object} params - Discovery parameters
 * @returns {Promise<Array>} - Array of verified agent rows
 */
async function discoverAgents({ capability, limit = 20, orgId = null } = {}) {
  const conditions = ["status = 'verified'", "revoked_at IS NULL"];
  const values = [];
  let paramIndex = 1;

  if (orgId) {
    conditions.push(`org_id = $${paramIndex++}`);
    values.push(orgId);
  }

  if (capability) {
    conditions.push(`capability_set @> $${paramIndex++}::jsonb`);
    values.push(JSON.stringify([capability]));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const sql = `
    SELECT * FROM agent_identities
    ${whereClause}
    ORDER BY bags_score DESC
    LIMIT $${paramIndex++}
  `;
  values.push(limit);

  const result = await query(sql, values);
  return result.rows;
}

/**
 * Revoke an agent
 * @param {string} agentId - Agent UUID
 * @returns {Promise<Object|null>} - Updated agent row or null
 */
async function revokeAgent(agentId) {
  const sql = `
    UPDATE agent_identities
    SET revoked_at = NOW(), status = 'revoked'
    WHERE agent_id = $1 AND revoked_at IS NULL
    RETURNING *
  `;
  const result = await query(sql, [agentId]);
  return result.rows[0] || null;
}

async function countAgents({ status, capability, includeDemo = false, orgId = null } = {}) {
  let queryStr = 'SELECT COUNT(*) FROM agent_identities WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    queryStr += ` AND status = $${paramIndex++}`;
    params.push(status);
  }
  if (capability) {
    queryStr += ` AND capability_set @> $${paramIndex++}::jsonb`;
    params.push(JSON.stringify([capability]));
  }
  if (orgId) {
    queryStr += ` AND org_id = $${paramIndex++}`;
    params.push(orgId);
  }

  // Filter out demo agents by default
  if (!includeDemo) {
    queryStr += ` AND is_demo = false`;
  }

  // Filter out revoked agents
  queryStr += ` AND revoked_at IS NULL`;

  const result = await query(queryStr, params);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Cleanup demo agents older than 24 hours
 * @returns {Promise<number>} - Number of deleted agents
 */
async function cleanupDemoAgents() {
  const sql = `
    DELETE FROM agent_identities 
    WHERE is_demo = true 
      AND registered_at < NOW() - INTERVAL '24 hours'
    RETURNING agent_id
  `;
  const result = await query(sql);
  return result.rows.length;
}

module.exports = {
  // Agent Identity queries
  createAgent,
  getAgent,
  getAgentByPubkey,
  getAgentsByOwner,
  countAgentsByOwner,
  updateAgent,
  listAgents,
  countAgents,
  updateAgentStatus,
  updateLastVerified,
  updateBagsScore,
  incrementActions,
  getAgentActions,
  cleanupDemoAgents,
  revokeAgent,
  
  // Verification queries
  createVerification,
  getVerification,
  completeVerification,
  
  // Flag queries
  createFlag,
  getFlags,
  getUnresolvedFlagCount,
  resolveFlag,
  
  // Discovery queries
  discoverAgents
};
