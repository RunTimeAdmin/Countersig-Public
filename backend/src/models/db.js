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

// Circuit breaker state
let circuitState = 'CLOSED';  // CLOSED = normal, OPEN = failing fast, HALF_OPEN = testing
let failureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 5;         // Open circuit after 5 consecutive failures
const RECOVERY_TIMEOUT = 30000;      // Try again after 30 seconds
const CIRCUIT_BREAKER_ENABLED = process.env.DB_CIRCUIT_BREAKER !== 'false';

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

  // Circuit breaker — fail fast when database is known to be unavailable
  if (CIRCUIT_BREAKER_ENABLED && circuitState === 'OPEN') {
    if (Date.now() - lastFailureTime > RECOVERY_TIMEOUT) {
      circuitState = 'HALF_OPEN';
      logger.info('DB circuit breaker entering HALF_OPEN state');
    } else {
      throw Object.assign(new Error('Database circuit breaker is OPEN — failing fast'), {
        statusCode: 503,
        code: 'DB_CIRCUIT_OPEN'
      });
    }
  }

  const p = getPool();
  if (p.waitingCount > 5) {
    logger.warn({
      waiting: p.waitingCount,
      idle: p.idleCount,
      total: p.totalCount,
      max: p.options.max
    }, 'DB pool pressure');
  }

  try {
    const result = await p.query(text, params);

    // Success — reset circuit breaker
    if (circuitState !== 'CLOSED') {
      logger.info('DB circuit breaker CLOSED — database recovered');
      circuitState = 'CLOSED';
      failureCount = 0;
    }

    return result;
  } catch (error) {
    // Determine if this is a connection/availability error (not a query logic error)
    const isConnectionError = error.code === 'ECONNREFUSED'
      || error.code === 'ENOTFOUND'
      || error.code === 'ETIMEDOUT'
      || error.code === '57P01'  // admin_shutdown
      || error.code === '57P02'  // crash_shutdown
      || error.code === '57P03'  // cannot_connect_now
      || error.message?.includes('Connection terminated')
      || error.message?.includes('timeout');

    if (CIRCUIT_BREAKER_ENABLED && isConnectionError) {
      failureCount++;
      lastFailureTime = Date.now();
      if (failureCount >= FAILURE_THRESHOLD) {
        circuitState = 'OPEN';
        logger.error({ failureCount }, 'DB circuit breaker OPEN — database unavailable');
      }
    }

    logger.error({ err: error, query: text.substring(0, 100) }, 'Database query error');
    throw error;
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

/**
 * Get circuit breaker state for health checks
 * @returns {Object} Circuit breaker state info
 */
function getCircuitState() {
  return { state: circuitState, failureCount, lastFailureTime: lastFailureTime || null };
}

module.exports = {
  get pool() { return getPool(); },
  query,
  setMockQuery,
  getPoolMetrics,
  getCircuitState
};
