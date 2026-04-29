'use strict';

const pino = require('pino');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
    }
  }),
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.ip,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

/**
 * Get a child logger with request context from AsyncLocalStorage.
 * Falls back to base logger if no request context.
 */
function getLogger() {
  const store = asyncLocalStorage.getStore();
  if (store && store.logger) return store.logger;
  return logger;
}

/**
 * Get the current request ID from AsyncLocalStorage.
 */
function getRequestId() {
  const store = asyncLocalStorage.getStore();
  return store ? store.requestId : null;
}

module.exports = { logger, getLogger, getRequestId, asyncLocalStorage };
