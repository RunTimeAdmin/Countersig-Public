/**
 * Zod Validation Middleware
 * Provides reusable request body validation using Zod schemas.
 */

const { ValidationError } = require('../utils/errors');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
