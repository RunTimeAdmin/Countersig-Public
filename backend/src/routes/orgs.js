/**
 * Organization Routes
 * CRUD and membership management for organizations with RBAC
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize, requireScope, ROLES } = require('../middleware/authorize');
const { orgContext } = require('../middleware/orgContext');
const { validate } = require('../middleware/validate');
const { identityProviderSchema } = require('../schemas');
const { NotFoundError, AuthorizationError, ConflictError } = require('../utils/errors');
const {
  getOrganization,
  updateOrganization,
  getOrgMembers,
  updateMemberRole,
  removeMember,
  createInvite,
  getOrgStats,
  getOrgIdPs,
  getOrgIdP,
  createOrgIdP,
  updateOrgIdP,
  deleteOrgIdP
} = require('../models/orgQueries');

const { query } = require('../models/db');

const router = express.Router();

const ALLOWED_REGIONS = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];

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
router.get('/orgs/:orgId', authenticate, orgContext, requireScope('read'), async (req, res, next) => {
  try {
    const org = await getOrganization(req.orgId);
    if (!org) {
      return next(new NotFoundError('Organization'));
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
router.put('/orgs/:orgId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;
    const org = await updateOrganization(req.orgId, { name, description, settings });
    if (!org) {
      return next(new NotFoundError('Organization'));
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
router.get('/orgs/:orgId/members', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), requireScope('read'), async (req, res, next) => {
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
router.put('/orgs/:orgId/members/:userId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
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
      return next(new NotFoundError('Member', userId));
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
router.delete('/orgs/:orgId/members/:userId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from the organization' });
    }

    const removed = await removeMember(req.orgId, userId);
    if (!removed) {
      return next(new NotFoundError('Member', userId));
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
router.post('/orgs/:orgId/invite', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedRole = role || ROLES.MEMBER;
    const inviterLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const inviteeLevel = ROLE_HIERARCHY[normalizedRole] || 0;

    if (inviteeLevel > inviterLevel) {
      return next(new AuthorizationError('Cannot invite a user with higher privileges than your own'));
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
router.get('/orgs/:orgId/stats', authenticate, orgContext, requireScope('read'), async (req, res, next) => {
  try {
    const stats = await getOrgStats(req.orgId);
    return res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ── Identity Provider Management ──

/**
 * GET /orgs/:orgId/identity-providers
 * List all configured identity providers for the organization
 */
router.get('/orgs/:orgId/identity-providers', authenticate, orgContext, authorize(ROLES.MANAGER, ROLES.ADMIN), requireScope('read'), async (req, res, next) => {
  try {
    const idps = await getOrgIdPs(req.orgId);
    return res.json({ identityProviders: idps });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /orgs/:orgId/identity-providers
 * Add a new identity provider configuration
 */
router.post('/orgs/:orgId/identity-providers', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), validate(identityProviderSchema), async (req, res, next) => {
  try {
    const { providerType, issuerUrl, clientId, allowedAudiences, claimMappings, enabled } = req.body;

    const idp = await createOrgIdP({
      orgId: req.orgId,
      providerType,
      issuerUrl,
      clientId,
      allowedAudiences: allowedAudiences || [],
      claimMappings: claimMappings || {},
      enabled: enabled !== false,
    });

    return res.status(201).json({ identityProvider: idp });
  } catch (error) {
    if (error.code === '23505') {
      return next(new ConflictError('Identity provider with this issuer URL already configured for this organization'));
    }
    next(error);
  }
});

/**
 * PUT /orgs/:orgId/identity-providers/:idpId
 * Update an identity provider configuration
 */
router.put('/orgs/:orgId/identity-providers/:idpId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { idpId } = req.params;
    const { providerType, issuerUrl, clientId, allowedAudiences, claimMappings, enabled } = req.body;

    if (issuerUrl) {
      try { new URL(issuerUrl); } catch {
        return res.status(400).json({ error: 'issuerUrl must be a valid URL' });
      }
    }

    const idp = await updateOrgIdP(idpId, req.orgId, {
      providerType, issuerUrl, clientId, allowedAudiences, claimMappings, enabled,
    });

    if (!idp) {
      return next(new NotFoundError('Identity provider', idpId));
    }

    return res.json({ identityProvider: idp });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /orgs/:orgId/identity-providers/:idpId
 * Remove an identity provider configuration
 */
router.delete('/orgs/:orgId/identity-providers/:idpId', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { idpId } = req.params;
    const deleted = await deleteOrgIdP(idpId, req.orgId);

    if (!deleted) {
      return next(new NotFoundError('Identity provider', idpId));
    }

    return res.json({ deleted: true, identityProvider: deleted });
  } catch (error) {
    next(error);
  }
});

// ── Data Residency & Compliance ──

/**
 * PUT /orgs/:orgId/compliance
 * Update compliance flags and data region (admin only)
 */
router.put('/orgs/:orgId/compliance', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('write'), async (req, res, next) => {
  try {
    const { compliance_flags, data_region } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (compliance_flags !== undefined) {
      updates.push(`compliance_flags = $${paramIndex++}`);
      values.push(JSON.stringify(compliance_flags));
    }

    if (data_region !== undefined) {
      if (!ALLOWED_REGIONS.includes(data_region)) {
        return res.status(400).json({
          error: 'Invalid data region',
          allowed: ALLOWED_REGIONS
        });
      }
      updates.push(`data_region = $${paramIndex++}`);
      values.push(data_region);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.orgId);

    const result = await query(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return next(new NotFoundError('Organization'));
    }

    res.json({
      id: result.rows[0].id,
      data_region: result.rows[0].data_region,
      compliance_flags: result.rows[0].compliance_flags,
      updated_at: result.rows[0].updated_at
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
