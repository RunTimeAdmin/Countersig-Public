'use strict';

/**
 * Cache Invalidation Service
 * Extracted from badgeBuilder to break circular dependency with queries.js
 *
 * Supports both direct calls (for immediate local invalidation) and
 * event-driven invalidation via the EventBus (for cross-instance propagation).
 */

const { deleteCache, deleteCacheMulti } = require('../models/redis');
const { logger, getLogger } = require('../utils/logger');

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

/**
 * Initialize event-driven cache invalidation listeners.
 * Subscribes to agent mutation events on the EventBus so that cache is
 * invalidated automatically whenever an agent is updated, revoked, flagged,
 * or has its score recalculated — including events originating from other
 * server instances via Redis pub/sub.
 */
function init() {
  const log = getLogger();
  const eventBus = require('./eventBus');

  eventBus.on('agent:updated', (event) => {
    const agentId = event && event.data && event.data.agentId;
    if (!agentId) return;
    log.debug({ agentId }, 'Cache invalidation triggered by agent:updated');
    invalidateAgentCaches(agentId);
  });

  eventBus.on('agent:revoked', (event) => {
    const agentId = event && event.data && event.data.agentId;
    if (!agentId) return;
    log.debug({ agentId }, 'Cache invalidation triggered by agent:revoked');
    invalidateAgentCaches(agentId);
  });

  eventBus.on('agent:flagged', (event) => {
    const agentId = event && event.data && event.data.agentId;
    if (!agentId) return;
    log.debug({ agentId }, 'Cache invalidation triggered by agent:flagged');
    invalidateAgentCaches(agentId);
  });

  eventBus.on('agent:score_updated', (event) => {
    const agentId = event && event.data && event.data.agentId;
    if (!agentId) return;
    log.debug({ agentId }, 'Cache invalidation triggered by agent:score_updated');
    invalidateAgentCaches(agentId);
  });

  log.info('Cache invalidation event listeners initialized');
}

module.exports = {
  invalidateAgentCaches,
  init
};
