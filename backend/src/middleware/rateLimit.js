/**
 * Rate limiting middleware configuration
 * Uses express-rate-limit for request throttling
 */

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redis } = require('../models/redis');

// Default rate limit: 100 requests per 15 minutes per IP
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;

// Stricter rate limit for auth endpoints: 20 requests per 15 minutes
const AUTH_MAX_REQUESTS = 20;

// Registration rate limit: 5 requests per 15 minutes
const REGISTRATION_MAX_REQUESTS = 5;

/**
 * Creates a configurable rate limiter
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Custom error message
 * @returns {Function} Express middleware
 */
// Create a fresh Redis-backed store per limiter (required by express-rate-limit v7+)
function createRedisStore(prefix) {
  try {
    return new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: prefix,
    });
  } catch (err) {
    console.warn('Redis rate limit store unavailable, falling back to memory store:', err.message);
    return undefined;
  }
}

function createLimiter(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = options.max || DEFAULT_MAX_REQUESTS;
  const message = options.message || 'Too many requests, please try again later.';
  const prefix = options.prefix || 'rl:default:';

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      status: 429
    },
    store: createRedisStore(prefix),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json(options.message);
    }
  });
}

// Default limiter: 100 requests per 15 minutes
const defaultLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: DEFAULT_MAX_REQUESTS,
  prefix: 'rl:default:'
});

// Strict limiter for auth endpoints: 20 requests per 15 minutes
const authLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: AUTH_MAX_REQUESTS,
  prefix: 'rl:auth:',
  message: 'Too many authentication attempts, please try again later.'
});

// Registration limiter: 5 requests per 15 minutes
const registrationLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: REGISTRATION_MAX_REQUESTS,
  prefix: 'rl:register:',
  message: 'Too many registration attempts, please try again later.'
});

module.exports = {
  createLimiter,
  defaultLimiter,
  authLimiter,
  registrationLimiter
};
