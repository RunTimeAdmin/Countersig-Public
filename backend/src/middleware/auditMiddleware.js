/**
 * Audit Middleware
 * Automatically logs mutating requests (POST, PUT, DELETE)
 * after the response is sent.
 */

const { logAction } = require('../services/auditService');

const SENSITIVE_FIELDS = new Set([
  'rawKey', 'password', 'password_hash', 'secret',
  'refreshToken', 'accessToken', 'token', 'key_hash'
]);

function scrub(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : scrub(v);
  }
  return out;
}

/**
 * Map of HTTP method + path to action names
 */
const ACTION_MAP = {
  'POST /register': 'register',
  'POST /auth/register': 'user_register',
  'POST /auth/login': 'login',
  'PUT /agents': 'update',
  'DELETE /agents': 'revoke',
  'POST /api-keys': 'create_api_key',
  'DELETE /api-keys': 'revoke_api_key',
  'POST /orgs': 'create_org',
  'PUT /orgs': 'update_org',
  'POST /verify': 'verify'
};

/**
 * Resolve the action name from the request method and path
 * by trying exact match then progressively shorter prefixes.
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {string} - Action name
 */
function resolveAction(method, path) {
  const exactKey = `${method} ${path}`;
  if (ACTION_MAP[exactKey]) {
    return ACTION_MAP[exactKey];
  }

  let testPath = path;
  while (testPath.includes('/')) {
    testPath = testPath.replace(/\/[^/]*$/, '');
    const key = `${method} ${testPath}`;
    if (ACTION_MAP[key]) {
      return ACTION_MAP[key];
    }
  }

  return 'unknown';
}

/**
 * Extract the resource ID from request params
 * @param {Object} params - req.params
 * @returns {string|null}
 */
function extractResourceId(params) {
  if (!params) {
    return null;
  }
  return params.agentId || params.id || params.orgId || null;
}

/**
 * Determine the resource type from the request path
 * @param {string} path - Request path
 * @returns {string|null}
 */
function extractResourceType(path) {
  if (path.includes('/agents')) {
    return 'agent';
  }
  if (path.includes('/api-keys')) {
    return 'api_key';
  }
  if (path.includes('/orgs')) {
    return 'organization';
  }
  if (path.includes('/auth')) {
    return 'user';
  }
  if (path.includes('/verify')) {
    return 'verification';
  }
  if (path.includes('/register')) {
    return 'agent';
  }
  return null;
}

/**
 * Audit middleware — logs mutating requests after response is sent
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function auditMiddleware(req, res, next) {
  // Only audit mutating methods
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);
  let responseBody = null;

  // Override res.json to capture the response body
  res.json = function json(body) {
    responseBody = body;
    return originalJson(body);
  };

  const originalSend = res.send.bind(res);
  res.send = function send(body) {
    responseBody = responseBody || body;
    return originalSend(body);
  };

  // Log after the response finishes
  res.on('finish', () => {
    // Fire and forget — do not block the response
    (async () => {
      try {
        const action = resolveAction(req.method, req.path);
        const actorId = req.user ? req.user.id || req.user.userId || null : null;
        const orgId = req.user ? req.user.orgId || null : null;
        const resourceId = extractResourceId(req.params);
        const resourceType = extractResourceType(req.path);

        const hour = new Date().getUTCHours();
        const offHours = hour < 6 || hour >= 22;

        const metadata = {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          offHours
        };

        // Only log if we have an org context; otherwise this is a public/unauthenticated route
        if (orgId) {
          await logAction({
            orgId,
            actorId,
            actorType: req.user ? req.user.role || 'user' : 'anonymous',
            action,
            resourceType,
            resourceId,
            changes: scrub(responseBody),
            metadata
          });
        }
      } catch (err) {
        console.error('Audit middleware logging error:', err.message);
      }
    })();
  });

  next();
}

module.exports = { auditMiddleware };
