/**
 * Authorization Middleware
 * Role-based access control using a hierarchy of roles
 */

const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1
};

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

/**
 * Middleware factory that checks if the user's role
 * meets or exceeds the minimum required role level.
 * @param {...string} allowedRoles - One or more allowed roles
 * @returns {Function} Express middleware
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!ROLE_HIERARCHY.hasOwnProperty(req.user.role)) {
        console.warn(`[authorize] Unknown role encountered: ${req.user.role} for user ${req.user.userId}`);
      }
      const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const minRequiredLevel = Math.min(
        ...allowedRoles.map(role => ROLE_HIERARCHY[role] || Infinity)
      );

      if (userRoleLevel >= minRequiredLevel) {
        return next();
      }

      return res.status(403).json({ error: 'Insufficient permissions' });
    } catch (error) {
      next(error);
    }
  };
}

function requireScope(...requiredScopes) {
  return (req, res, next) => {
    // JWT-authenticated users (not API keys) bypass scope checks — they use role-based auth
    if (!req.user?.isApiKey) return next();

    // Check if user has at least one of the required scopes, or wildcard '*'
    const userScopes = req.user.scopes || [];
    if (userScopes.includes('*')) return next();

    const hasScope = requiredScopes.some(scope => userScopes.includes(scope));
    if (!hasScope) {
      return res.status(403).json({
        error: `API key missing required scope. Required: ${requiredScopes.join(' or ')}`
      });
    }
    next();
  };
}

module.exports = { authorize, requireScope, ROLES };
