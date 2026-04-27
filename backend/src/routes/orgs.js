/**
 * Organization Routes
 * CRUD and membership management for organizations with RBAC
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const { orgContext } = require('../middleware/orgContext');
const {
  getOrganization,
  updateOrganization,
  getOrgMembers,
  updateMemberRole,
  removeMember,
  createInvite,
  getOrgStats
} = require('../models/orgQueries');

const router = express.Router();

const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1
};

/**
 * GET /orgs/:orgId
 * Get organization details
 */
router.get('/orgs/:orgId', authenticate, orgContext, async (req, res, next) => {
  try {
    const org = await getOrganization(req.orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    return res.json(org);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /orgs/:orgId
 * Update organization (admin only)
 */
router.put('/orgs/:orgId', authenticate, orgContext, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;
    const org = await updateOrganization(req.orgId, { name, description, settings });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    return res.json(org);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orgs/:orgId/members
 * List organization members (manager or admin)
 */
router.get('/orgs/:orgId/members', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), async (req, res, next) => {
  try {
    const members = await getOrgMembers(req.orgId);
    return res.json(members);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /orgs/:orgId/members/:userId
 * Update member role (admin only)
 */
router.put('/orgs/:orgId/members/:userId', authenticate, orgContext, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const member = await updateMemberRole(req.orgId, userId, role);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.json(member);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /orgs/:orgId/members/:userId
 * Remove member from organization (admin only)
 */
router.delete('/orgs/:orgId/members/:userId', authenticate, orgContext, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from the organization' });
    }

    const removed = await removeMember(req.orgId, userId);
    if (!removed) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /orgs/:orgId/invite
 * Invite a new user to the organization (admin or manager)
 */
router.post('/orgs/:orgId/invite', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedRole = role || ROLES.MEMBER;
    const inviterLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const inviteeLevel = ROLE_HIERARCHY[normalizedRole] || 0;

    if (inviteeLevel > inviterLevel) {
      return res.status(403).json({ error: 'Cannot invite a user with higher privileges than your own' });
    }

    await createInvite(req.orgId, email, normalizedRole, req.user.userId);

    return res.status(201).json({ success: true, message: 'User invited' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orgs/:orgId/stats
 * Get organization statistics
 */
router.get('/orgs/:orgId/stats', authenticate, orgContext, async (req, res, next) => {
  try {
    const stats = await getOrgStats(req.orgId);
    return res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
