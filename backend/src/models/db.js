/**
 * PostgreSQL connection pool
 * Uses the 'pg' package for database connectivity
 * Lazy initialization for testability
 */

const { Pool } = require('pg');
const config = require('../config');
const { logger } = require('../utils/logger');

let pool = null;
let mockQueryFn = null;

/**
 * Set a mock query function for testing
 * @param {Function} fn - Mock query function
 */
function setMockQuery(fn) {
  mockQueryFn = fn;
}

/**
 * Get or create the database pool (lazy initialization)
 * @returns {Pool} PostgreSQL pool instance
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS, 10) || 5000,
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10) || 30000,
      // Enable SSL only when explicitly requested via DB_SSL=true env var
      // Docker PostgreSQL typically doesn't support SSL; hosted databases (e.g. Supabase, RDS) do
      ...(process.env.DB_SSL === 'true' && {
        ssl: {
          rejectUnauthorized: process.env.DB_CA_CERT ? true : false,
          ca: process.env.DB_CA_CERT ? Buffer.from(process.env.DB_CA_CERT, 'base64') : undefined
        }
      })
    });

    // Handle connection errors - log but don't crash
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error');
    });
  }
  return pool;
}

/**
 * Execute a SQL query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
async function query(text, params) {
  // Use mock if in test mode and mock is set
  if (config.nodeEnv === 'test' && mockQueryFn) {
    return mockQueryFn(text, params);
  }
  
  try {
    const p = getPool();
    if (p.waitingCount > 5) {
      logger.warn({
        waiting: p.waitingCount,
        idle: p.idleCount,
        total: p.totalCount,
        max: p.options.max
      }, 'DB pool pressure');
    }
    const result = await p.query(text, params);
    return result;
  } catch (err) {
    logger.error({ err }, 'Database query error');
    throw err;
  }
}

/**
 * Get pool health metrics
 * @returns {Object|null} Pool metrics or null if pool not initialized
 */
function getPoolMetrics() {
  if (!pool) return null;
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

module.exports = {
  get pool() { return getPool(); },
  query,
  setMockQuery,
  getPoolMetrics
};
