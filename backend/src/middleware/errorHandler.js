/**
 * Express error handling middleware
 * Catches errors, logs them, and returns appropriate JSON responses
 */

const config = require('../config');

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
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const status = err.status || err.statusCode || 500;

  // Build error response
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    status: status
  };

  // Include stack trace in development mode
  if (config.nodeEnv === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  res.status(status).json(errorResponse);
}

module.exports = errorHandler;
