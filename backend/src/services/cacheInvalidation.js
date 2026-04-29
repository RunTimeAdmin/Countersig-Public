'use strict';

/**
 * Cache Invalidation Service
 * Extracted from badgeBuilder to break circular dependency with queries.js
 */

const { deleteCache, deleteCacheMulti } = require('../models/redis');
const { logger } = require('../utils/logger');

/**
 * Invalidate all agent caches (badge and reputation)
 * @param {string} agentId - Agent UUID
 * @returns {Promise<boolean>}
 */
async function invalidateAgentCaches(agentId) {
  try {
    await deleteCacheMulti([
      `badge:${agentId}`,
      `reputation:${agentId}`
    ]);
    return true;
  } catch (err) {
    logger.error({ err, agentId }, 'Agent cache invalidation error');
    return false;
  }
}

module.exports = {
  invalidateAgentCaches
};
