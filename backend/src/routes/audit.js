/**
 * Audit Routes
 * Provides endpoints for querying, exporting, and verifying audit logs
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize, requireScope, ROLES } = require('../middleware/authorize');
const { orgContext } = require('../middleware/orgContext');
const { AuthorizationError } = require('../utils/errors');
const {
  getAuditLogs,
  exportAuditLogs,
  verifyAuditChain
} = require('../services/auditService');

const router = express.Router();

/**
 * GET /orgs/:orgId/audit
 * List audit logs with pagination and filtering
 */
router.get('/orgs/:orgId/audit', authenticate, orgContext, requireScope('read'), async (req, res, next) => {
  try {
    const orgId = req.orgId;

    // Parse and validate pagination
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 50;

    if (page < 1) {
      page = 1;
    }

    if (limit > 200) {
      limit = 200;
    }
    if (limit < 1) {
      limit = 1;
    }

    const result = await getAuditLogs({
      orgId,
      page,
      limit,
      action: req.query.action || undefined,
      actorId: req.query.actorId || undefined,
      resourceId: req.query.resourceId || undefined,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orgs/:orgId/audit/export
 * Export audit logs as JSON or CSV
 */
router.get('/orgs/:orgId/audit/export', authenticate, orgContext, requireScope('read'), async (req, res, next) => {
  try {
    const orgId = req.orgId;

    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const result = await exportAuditLogs({
      orgId,
      format,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    return res.status(200).send(result.data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /orgs/:orgId/audit/verify
 * Verify the integrity of the audit hash chain (admin only)
 */
router.get('/orgs/:orgId/audit/verify', authenticate, orgContext, authorize(ROLES.ADMIN), requireScope('read'), async (req, res, next) => {
  try {
    const orgId = req.orgId;

    const result = await verifyAuditChain(orgId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
