/**
 * Express error handling middleware
 * Catches errors, logs them, and returns appropriate JSON responses
 */

'use strict';

const config = require('../config');
const { AppError } = require('../utils/errors');

/**
 * Global error handler middleware
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Log the error
  console.error('Error:', {
    message: err.message,
    code: err.code || 'UNKNOWN',
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // If it's an operational AppError, use its properties
  if (err instanceof AppError) {
    const response = {
      error: err.message,
      code: err.code,
      status: err.statusCode
    };
    if (err.details) response.details = err.details;
    if (err.resource) response.resource = err.resource;
    if (err.retryAfter) response.retryAfter = err.retryAfter;
    if (config.nodeEnv === 'development') {
      response.stack = err.stack;
    }
    return res.status(err.statusCode).json(response);
  }

  // For non-operational errors (programming bugs, unknown errors)
  const status = err.status || err.statusCode || 500;
  const errorResponse = {
    error: status === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    code: 'INTERNAL_ERROR',
    status: status
  };

  if (config.nodeEnv === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  res.status(status).json(errorResponse);
}

module.exports = errorHandler;
