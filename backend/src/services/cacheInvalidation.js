'use strict';

/**
 * Cache Invalidation Service
 * Extracted from badgeBuilder to break circular dependency with queries.js
 */

const { deleteCache } = require('../models/redis');

/**
 * Invalidate all agent caches (badge and reputation)
 * @param {string} agentId - Agent UUID
 * @returns {Promise<boolean>}
 */
async function invalidateAgentCaches(agentId) {
  try {
    await deleteCache(`badge:${agentId}`);
    await deleteCache(`reputation:${agentId}`);
    return true;
  } catch (err) {
    console.error('Agent cache invalidation error:', err.message);
    return false;
  }
}

module.exports = {
  invalidateAgentCaches
};
