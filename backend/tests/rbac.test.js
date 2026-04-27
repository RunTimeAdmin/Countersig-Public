/**
 * RBAC Middleware Tests
 * Tests for authorize middleware and orgContext middleware
 */

const { authorize, ROLES } = require('../src/middleware/authorize');
const { orgContext } = require('../src/middleware/orgContext');

const mockReq = (overrides = {}) => ({
  user: { userId: 'u1', orgId: 'org1', role: 'admin' },
  params: {},
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RBAC Middleware', () => {
  describe('authorize middleware', () => {
    it('should call next() when user has required role', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'admin' } });
      const res = mockRes();
      authorize('admin')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when user lacks required role', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'viewer' } });
      const res = mockRes();
      authorize('admin')(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });

    it('should return 401 when no user on request', () => {
      const req = mockReq({ user: undefined });
      const res = mockRes();
      authorize('admin')(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should allow admin to access all role levels', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'admin' } });
      const res = mockRes();

      authorize('viewer')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();
      authorize('member')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();
      authorize('manager')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow manager to access member/viewer levels', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'manager' } });
      const res = mockRes();

      authorize('member')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();
      authorize('viewer')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny viewer from manager-level access', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'viewer' } });
      const res = mockRes();
      authorize('manager')(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });

    it('should allow member to access viewer-level access', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'member' } });
      const res = mockRes();
      authorize('viewer')(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny member from manager-level access', () => {
      const req = mockReq({ user: { userId: 'u1', orgId: 'org1', role: 'member' } });
      const res = mockRes();
      authorize('manager')(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('orgContext middleware', () => {
    it('should set req.orgId from params when matching', () => {
      const req = mockReq({ params: { orgId: 'org1' } });
      const res = mockRes();
      orgContext(req, res, mockNext);
      expect(req.orgId).toBe('org1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when orgId does not match user org', () => {
      const req = mockReq({ params: { orgId: 'org2' } });
      const res = mockRes();
      orgContext(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied to this organization' });
    });

    it('should use req.user.orgId when no params.orgId', () => {
      const req = mockReq();
      const res = mockRes();
      orgContext(req, res, mockNext);
      expect(req.orgId).toBe('org1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when no user on request', () => {
      const req = mockReq({ user: undefined });
      const res = mockRes();
      orgContext(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });
});
