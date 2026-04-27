/**
 * Audit Service
 * Provides tamper-evident audit logging with hash chaining,
 * risk scoring, querying, export, and chain verification.
 */

const crypto = require('crypto');
const { query, pool } = require('../models/db');

/**
 * Base risk scores for known actions
 */
const BASE_RISK_SCORES = {
  register: 10,
  update: 20,
  verify: 15,
  revoke: 80,
  flag: 50,
  bulk_revoke: 95,
  delete: 90,
  login: 5,
  create_api_key: 30,
  revoke_api_key: 40,
  create_org: 10,
  update_org: 25,
  invite_user: 20
};

/**
 * Calculate risk score for an action
 * @param {string} action - Action name
 * @param {Object} metadata - Additional metadata
 * @returns {number} - Risk score (0-100)
 */
function calculateRiskScore(action, metadata) {
  const baseScore = BASE_RISK_SCORES[action] || 10;

  if (metadata && metadata.offHours) {
    return Math.min(Math.round(baseScore * 1.5), 100);
  }

  return baseScore;
}

/**
 * Compute SHA-256 hash of a string
 * @param {string} data - Input string
 * @returns {string} - Hex digest
 */
function computeHash(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Log an audited action with tamper-evident hash chaining
 * @param {Object} params - Log parameters
 * @returns {Promise<Object>} - Created log entry
 */
async function logAction({
  orgId,
  actorId,
  actorType,
  action,
  resourceType,
  resourceId,
  changes,
  metadata
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    // 1. Get previous hash for this org
    const prevResult = await client.query(
      'SELECT entry_hash FROM audit_logs WHERE org_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [orgId]
    );

    const prevHash = prevResult.rows.length > 0
      ? prevResult.rows[0].entry_hash
      : '0'.repeat(64);

    // 2. Build hash payload
    const timestamp = new Date().toISOString();
    const hashPayload = JSON.stringify({
      action,
      resource_id: resourceId,
      actor_id: actorId,
      timestamp
    });

    // 3. Compute entry hash
    const entryHash = computeHash(prevHash + hashPayload);

    // 4. Compute risk score
    const riskScore = calculateRiskScore(action, metadata);

    // 5. Insert into audit_logs
    const insertResult = await client.query(
      `INSERT INTO audit_logs (
        org_id, actor_id, actor_type, action, resource_type, resource_id,
        changes, metadata, risk_score, prev_hash, entry_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        orgId,
        actorId || null,
        actorType || null,
        action,
        resourceType || null,
        resourceId || null,
        changes ? JSON.stringify(changes) : null,
        metadata ? JSON.stringify(metadata) : null,
        riskScore,
        prevHash,
        entryHash,
        timestamp
      ]
    );

    await client.query('COMMIT');
    return insertResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get paginated audit logs with optional filters
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Logs and pagination info
 */
async function getAuditLogs({
  orgId,
  page = 1,
  limit = 50,
  action,
  actorId,
  resourceId,
  startDate,
  endDate
}) {
  const conditions = ['org_id = $1'];
  const params = [orgId];
  let paramIndex = 1;

  if (action) {
    paramIndex += 1;
    conditions.push(`action = $${paramIndex}`);
    params.push(action);
  }

  if (actorId) {
    paramIndex += 1;
    conditions.push(`actor_id = $${paramIndex}`);
    params.push(actorId);
  }

  if (resourceId) {
    paramIndex += 1;
    conditions.push(`resource_id = $${paramIndex}`);
    params.push(resourceId);
  }

  if (startDate) {
    paramIndex += 1;
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(startDate);
  }

  if (endDate) {
    paramIndex += 1;
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(endDate);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM audit_logs WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated logs
  paramIndex += 1;
  const offset = (page - 1) * limit;
  const paginatedParams = [...params, limit, offset];

  const logsResult = await query(
    `SELECT * FROM audit_logs
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    paginatedParams
  );

  return {
    logs: logsResult.rows,
    total,
    page,
    limit
  };
}

/**
 * Export audit logs in CSV or JSON format
 * @param {Object} params - Export parameters
 * @returns {Promise<Object>} - Data, content type, and filename
 */
async function exportAuditLogs({ orgId, format = 'json', startDate, endDate }) {
  const conditions = ['org_id = $1'];
  const params = [orgId];
  let paramIndex = 1;

  if (startDate) {
    paramIndex += 1;
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(startDate);
  }

  if (endDate) {
    paramIndex += 1;
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(endDate);
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT id, action, actor_id, actor_type, resource_type, resource_id,
            risk_score, created_at
     FROM audit_logs
     WHERE ${whereClause}
     ORDER BY created_at DESC`,
    params
  );

  const logs = result.rows;

  if (format === 'csv') {
    const headers = [
      'id',
      'action',
      'actor_id',
      'actor_type',
      'resource_type',
      'resource_id',
      'risk_score',
      'created_at'
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [
      headers.join(','),
      ...logs.map((row) =>
        headers.map((h) => escapeCsv(row[h])).join(',')
      )
    ];

    return {
      data: lines.join('\n'),
      contentType: 'text/csv',
      filename: `audit-log-${orgId}-${new Date().toISOString().split('T')[0]}.csv`
    };
  }

  // Default JSON
  return {
    data: JSON.stringify(logs, null, 2),
    contentType: 'application/json',
    filename: `audit-log-${orgId}-${new Date().toISOString().split('T')[0]}.json`
  };
}

/**
 * Verify the integrity of the audit hash chain for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} - Verification result
 */
async function verifyAuditChain(orgId) {
  const result = await query(
    'SELECT * FROM audit_logs WHERE org_id = $1 ORDER BY id ASC',
    [orgId]
  );

  const entries = result.rows;
  const totalEntries = entries.length;

  if (totalEntries === 0) {
    return { valid: true, totalEntries: 0, firstInvalidEntry: null };
  }

  let expectedPrevHash = '0'.repeat(64);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];

    // Verify prev_hash links correctly
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries,
        firstInvalidEntry: entry.id
      };
    }

    // Recompute entry hash
    const hashPayload = JSON.stringify({
      action: entry.action,
      resource_id: entry.resource_id,
      actor_id: entry.actor_id,
      timestamp: new Date(entry.created_at).toISOString()
    });

    const expectedEntryHash = computeHash(entry.prev_hash + hashPayload);

    if (entry.entry_hash !== expectedEntryHash) {
      return {
        valid: false,
        totalEntries,
        firstInvalidEntry: entry.id
      };
    }

    expectedPrevHash = entry.entry_hash;
  }

  return {
    valid: true,
    totalEntries,
    firstInvalidEntry: null
  };
}

module.exports = {
  logAction,
  calculateRiskScore,
  getAuditLogs,
  exportAuditLogs,
  verifyAuditChain
};
