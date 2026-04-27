/**
 * Organization Queries
 * Database operations for organizations, members, and org-level stats
 */

const { query, pool } = require('./db');
const crypto = require('crypto');

const VALID_ROLES = ['admin', 'manager', 'member', 'viewer'];

/**
 * Get organization by ID (excluding soft-deleted)
 * @param {string} orgId - Organization UUID
 * @returns {Promise<Object|null>}
 */
async function getOrganization(orgId) {
  const result = await query(
    'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
    [orgId]
  );
  return result.rows[0] || null;
}

/**
 * Update organization fields dynamically
 * @param {string} orgId - Organization UUID
 * @param {Object} fields - { name, description, settings }
 * @returns {Promise<Object|null>}
 */
async function updateOrganization(orgId, { name, description, settings }) {
  const updates = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(name);
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    values.push(description);
  }
  if (settings !== undefined) {
    updates.push(`settings = $${idx++}`);
    values.push(JSON.stringify(settings));
  }

  if (updates.length === 0) {
    return getOrganization(orgId);
  }

  updates.push(`updated_at = NOW()`);
  values.push(orgId);

  const result = await query(
    `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Soft delete an organization
 * @param {string} orgId - Organization UUID
 * @returns {Promise<boolean>}
 */
async function deleteOrganization(orgId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE organizations SET deleted_at = NOW() WHERE id = $1', [orgId]);
    await client.query('UPDATE users SET deleted_at = NOW() WHERE org_id = $1 AND deleted_at IS NULL', [orgId]);
    await client.query('UPDATE agent_identities SET deleted_at = NOW() WHERE org_id = $1 AND deleted_at IS NULL', [orgId]);
    await client.query('UPDATE api_keys SET revoked_at = NOW() WHERE org_id = $1 AND revoked_at IS NULL', [orgId]);
    await client.query('UPDATE webhooks SET enabled = false WHERE org_id = $1', [orgId]);
    await client.query('UPDATE policy_rules SET enabled = false WHERE org_id = $1', [orgId]);
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get all active members of an organization
 * @param {string} orgId - Organization UUID
 * @returns {Promise<Array>}
 */
async function getOrgMembers(orgId) {
  const result = await query(
    `SELECT id, email, name, role, last_login, created_at
     FROM users
     WHERE org_id = $1 AND deleted_at IS NULL
     ORDER BY created_at`,
    [orgId]
  );
  return result.rows;
}

/**
 * Get a single organization member
 * @param {string} orgId - Organization UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>}
 */
async function getOrgMember(orgId, userId) {
  const result = await query(
    `SELECT id, email, name, role, last_login, created_at
     FROM users
     WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [userId, orgId]
  );
  return result.rows[0] || null;
}

/**
 * Update a member's role
 * @param {string} orgId - Organization UUID
 * @param {string} userId - User UUID
 * @param {string} newRole - New role value
 * @returns {Promise<Object|null>}
 */
async function updateMemberRole(orgId, userId, newRole) {
  if (!VALID_ROLES.includes(newRole)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const result = await query(
    'UPDATE users SET role = $3 WHERE id = $2 AND org_id = $1 AND deleted_at IS NULL RETURNING id, email, name, role, last_login, created_at',
    [orgId, userId, newRole]
  );
  return result.rows[0] || null;
}

/**
 * Soft remove a member from an organization
 * @param {string} orgId - Organization UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function removeMember(orgId, userId) {
  const result = await query(
    'UPDATE users SET deleted_at = NOW() WHERE id = $2 AND org_id = $1 AND deleted_at IS NULL',
    [orgId, userId]
  );
  return result.rowCount > 0;
}

/**
 * Create an invited user with a temporary password hash
 * @param {string} orgId - Organization UUID
 * @param {string} email - Invitee email
 * @param {string} role - Role to assign
 * @param {string} invitedBy - Inviter user ID
 * @returns {Promise<Object>}
 */
async function createInvite(orgId, email, role, invitedBy) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const tempPasswordHash = crypto.randomBytes(32).toString('hex');
  const name = email.split('@')[0];

  const result = await query(
    `INSERT INTO users (email, password_hash, name, org_id, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, role, created_at`,
    [email.toLowerCase().trim(), tempPasswordHash, name, orgId, role]
  );

  return result.rows[0];
}

/**
 * Get organization-level statistics
 * @param {string} orgId - Organization UUID
 * @returns {Promise<Object>}
 */
async function getOrgStats(orgId) {
  const agentsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_agents,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND verified_at IS NOT NULL) AS verified_agents,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND flags > 0) AS flagged_agents,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND revoked_at IS NOT NULL) AS revoked_agents
     FROM agent_identities
     WHERE org_id = $1`,
    [orgId]
  );

  const usersResult = await query(
    'SELECT COUNT(*) AS total_users FROM users WHERE org_id = $1 AND deleted_at IS NULL',
    [orgId]
  );

  const stats = agentsResult.rows[0] || {};
  return {
    totalAgents: parseInt(stats.total_agents, 10) || 0,
    verifiedAgents: parseInt(stats.verified_agents, 10) || 0,
    flaggedAgents: parseInt(stats.flagged_agents, 10) || 0,
    revokedAgents: parseInt(stats.revoked_agents, 10) || 0,
    totalUsers: parseInt(usersResult.rows[0].total_users, 10) || 0
  };
}

module.exports = {
  getOrganization,
  updateOrganization,
  deleteOrganization,
  getOrgMembers,
  getOrgMember,
  updateMemberRole,
  removeMember,
  createInvite,
  getOrgStats
};
