/**
 * PostgreSQL connection pool
 * Uses the 'pg' package for database connectivity
 * Lazy initialization for testability
 */

const { Pool } = require('pg');
const config = require('../config');

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
      // Additional pool configuration for production stability
      ...(config.nodeEnv === 'production' && {
        ssl: {
          rejectUnauthorized: false
        }
      })
    });

    // Handle connection errors - log but don't crash
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err.message);
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
    const result = await getPool().query(text, params);
    return result;
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
}

module.exports = {
  get pool() { return getPool(); },
  query,
  setMockQuery
};
