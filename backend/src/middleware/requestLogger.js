'use strict';

const crypto = require('crypto');
const { logger, asyncLocalStorage } = require('../utils/logger');

/**
 * Middleware that:
 * 1. Generates a unique request ID (or uses X-Request-ID header)
 * 2. Creates a child logger with request context
 * 3. Stores both in AsyncLocalStorage
 * 4. Logs request start/finish with timing
 */
function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const startTime = Date.now();

  // Set response header
  res.setHeader('X-Request-ID', requestId);

  // Attach request ID to req for backward compatibility
  req.id = requestId;

  // Create child logger with request context
  const childLogger = logger.child({ requestId });

  // Log request start
  childLogger.info({ req }, 'request started');

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    childLogger.info({
      res,
      duration,
    }, 'request completed');
  });

  // Run remainder of request in AsyncLocalStorage context
  asyncLocalStorage.run({ requestId, logger: childLogger }, () => {
    next();
  });
}

module.exports = requestLogger;
