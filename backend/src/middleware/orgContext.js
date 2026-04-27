/**
 * Organization Context Middleware
 * Ensures tenant isolation by verifying the user's organization access
 */

/**
 * Attach org context to the request and enforce tenant isolation.
 * If the route has an :orgId param, verify it matches the authenticated user's org.
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next
 */
function orgContext(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const paramOrgId = req.params.orgId;

    if (paramOrgId && paramOrgId !== req.user.orgId) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    req.orgId = paramOrgId || req.user.orgId;
    return next();
  } catch (error) {
    next(error);
  }
}

module.exports = { orgContext };
