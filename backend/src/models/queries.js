'use strict';

/**
 * Barrel re-export for backward compatibility.
 * New code should import directly from domain modules:
 *   - ./agentQueries
 *   - ./verificationQueries
 *   - ./flagQueries
 *   - ../services/cacheInvalidation
 */

const agentQueries = require('./agentQueries');
const verificationQueries = require('./verificationQueries');
const flagQueries = require('./flagQueries');

module.exports = {
  ...agentQueries,
  ...verificationQueries,
  ...flagQueries,
};
