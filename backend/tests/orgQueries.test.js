/**
 * Organization Queries Tests
 * Tests for getOrganization, getOrgMembers, updateMemberRole, and getOrgStats
 */

jest.mock('../src/models/db', () => ({
  query: jest.fn()
}));

const { query } = require('../src/models/db');
const {
  getOrganization,
  getOrgMembers,
  updateMemberRole,
  getOrgStats
} = require('../src/models/orgQueries');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Org Queries', () => {
  describe('getOrganization', () => {
    it('should query with correct org_id', async () => {
      query.mockResolvedValue({ rows: [{ id: 'org1', name: 'Test Org' }] });
      const result = await getOrganization('org1');
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        ['org1']
      );
      expect(result).toEqual({ id: 'org1', name: 'Test Org' });
    });

    it('should return null for non-existent org', async () => {
      query.mockResolvedValue({ rows: [] });
      const result = await getOrganization('org999');
      expect(result).toBeNull();
    });
  });

  describe('getOrgMembers', () => {
    it('should query with org_id and exclude deleted users', async () => {
      query.mockResolvedValue({ rows: [{ id: 'u1', email: 'a@b.com' }] });
      await getOrgMembers('org1');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE org_id = $1 AND deleted_at IS NULL'),
        ['org1']
      );
    });

    it('should return rows from query', async () => {
      const members = [
        { id: 'u1', email: 'a@b.com', name: 'Alice', role: 'admin' },
        { id: 'u2', email: 'b@c.com', name: 'Bob', role: 'member' }
      ];
      query.mockResolvedValue({ rows: members });
      const result = await getOrgMembers('org1');
      expect(result).toEqual(members);
      expect(result).toHaveLength(2);
    });
  });

  describe('updateMemberRole', () => {
    it('should reject invalid roles', async () => {
      await expect(updateMemberRole('org1', 'u1', 'hacker')).rejects.toThrow('Invalid role');
      await expect(updateMemberRole('org1', 'u1', 'superadmin')).rejects.toThrow('Invalid role');
    });

    it('should accept valid roles', async () => {
      query.mockResolvedValue({ rows: [{ id: 'u1', role: 'manager' }] });
      await updateMemberRole('org1', 'u1', 'manager');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role = $3 WHERE id = $2 AND org_id = $1 AND deleted_at IS NULL'),
        ['org1', 'u1', 'manager']
      );
    });

    it('should update with correct parameters', async () => {
      query.mockResolvedValue({ rows: [{ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'viewer' }] });
      const result = await updateMemberRole('org1', 'u1', 'viewer');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role = $3 WHERE id = $2 AND org_id = $1 AND deleted_at IS NULL'),
        ['org1', 'u1', 'viewer']
      );
      expect(result).toEqual({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'viewer' });
    });

    it('should return null when user not found', async () => {
      query.mockResolvedValue({ rows: [] });
      const result = await updateMemberRole('org1', 'u999', 'member');
      expect(result).toBeNull();
    });
  });

  describe('getOrgStats', () => {
    it('should return correct counts from query results', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_agents: '10',
          verified_agents: '5',
          flagged_agents: '2',
          revoked_agents: '1'
        }]
      });
      query.mockResolvedValueOnce({
        rows: [{ total_users: '3' }]
      });

      const result = await getOrgStats('org1');

      expect(result).toEqual({
        totalAgents: 10,
        verifiedAgents: 5,
        flaggedAgents: 2,
        revokedAgents: 1,
        totalUsers: 3
      });
    });

    it('should handle zero counts', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_agents: '0',
          verified_agents: '0',
          flagged_agents: '0',
          revoked_agents: '0'
        }]
      });
      query.mockResolvedValueOnce({
        rows: [{ total_users: '0' }]
      });

      const result = await getOrgStats('org1');

      expect(result).toEqual({
        totalAgents: 0,
        verifiedAgents: 0,
        flaggedAgents: 0,
        revokedAgents: 0,
        totalUsers: 0
      });
    });

    it('should handle null counts gracefully', async () => {
      query.mockResolvedValueOnce({
        rows: [{}]
      });
      query.mockResolvedValueOnce({
        rows: [{}]
      });

      const result = await getOrgStats('org1');

      expect(result).toEqual({
        totalAgents: 0,
        verifiedAgents: 0,
        flaggedAgents: 0,
        revokedAgents: 0,
        totalUsers: 0
      });
    });
  });
});
