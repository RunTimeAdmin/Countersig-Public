/**
 * Rate limiting middleware configuration
 * Uses express-rate-limit for request throttling
 */

const rateLimit = require('express-rate-limit');

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
function createLimiter(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = options.max || DEFAULT_MAX_REQUESTS;
  const message = options.message || 'Too many requests, please try again later.';

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      status: 429
    },
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
  max: DEFAULT_MAX_REQUESTS
});

// Strict limiter for auth endpoints: 20 requests per 15 minutes
const authLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: AUTH_MAX_REQUESTS,
  message: 'Too many authentication attempts, please try again later.'
});

// Registration limiter: 5 requests per 15 minutes
const registrationLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: REGISTRATION_MAX_REQUESTS,
  message: 'Too many registration attempts, please try again later.'
});

module.exports = {
  createLimiter,
  defaultLimiter,
  authLimiter,
  registrationLimiter
};
