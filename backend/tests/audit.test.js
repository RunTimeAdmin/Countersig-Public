/**
 * Audit Service Tests
 * Tests for calculateRiskScore, logAction, verifyAuditChain, and exportAuditLogs
 */

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('../src/models/db', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn().mockResolvedValue(mockClient) }
}));

const crypto = require('crypto');
const stableStringify = require('safe-stable-stringify');
const { query } = require('../src/models/db');
const {
  calculateRiskScore,
  logAction,
  verifyAuditChain,
  exportAuditLogs
} = require('../src/services/auditService');

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.query.mockClear();
  mockClient.release.mockClear();
});

describe('Audit Service', () => {
  describe('calculateRiskScore', () => {
    it('should return correct base scores for known actions', () => {
      expect(calculateRiskScore('register')).toBe(10);
      expect(calculateRiskScore('revoke')).toBe(80);
      expect(calculateRiskScore('login')).toBe(5);
      expect(calculateRiskScore('delete')).toBe(90);
      expect(calculateRiskScore('create_api_key')).toBe(30);
    });

    it('should return 10 for unknown actions', () => {
      expect(calculateRiskScore('unknown_action')).toBe(10);
      expect(calculateRiskScore('random_thing')).toBe(10);
    });

    it('should apply 1.5x multiplier for off-hours', () => {
      expect(calculateRiskScore('register', { offHours: true })).toBe(15);
      expect(calculateRiskScore('login', { offHours: true })).toBe(8);
    });

    it('should cap at 100', () => {
      expect(calculateRiskScore('revoke', { offHours: true })).toBe(100);
      expect(calculateRiskScore('bulk_revoke', { offHours: true })).toBe(100);
      expect(calculateRiskScore('delete', { offHours: true })).toBe(100);
    });
  });

  describe('logAction', () => {
    it('should insert a record with correct fields', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // no previous entry
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          org_id: 'org1',
          action: 'login',
          prev_hash: '0'.repeat(64),
          entry_hash: 'abc123'
        }]
      }); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await logAction({
        orgId: 'org1',
        actorId: 'u1',
        actorType: 'user',
        action: 'login',
        resourceType: 'session',
        resourceId: 's1'
      });

      expect(mockClient.query).toHaveBeenCalledTimes(4);
      expect(result).toHaveProperty('org_id', 'org1');
      expect(result).toHaveProperty('action', 'login');
    });

    it('should compute entry_hash from prev_hash', async () => {
      const prevHashHex = 'a'.repeat(64);

      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ entry_hash: prevHashHex }]
      }); // SELECT prev_hash
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, entry_hash: 'newhash', prev_hash: prevHashHex }]
      }); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

      await logAction({ orgId: 'org1', action: 'login' });

      const insertCall = mockClient.query.mock.calls[2];
      expect(insertCall[1][9]).toBe(prevHashHex); // prev_hash parameter
      expect(insertCall[1][10]).toMatch(/^[a-f0-9]{64}$/); // entry_hash is 64-char hex
    });

    it("should use '0'.repeat(64) as prev_hash when no previous entry", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT no rows
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, prev_hash: '0'.repeat(64) }]
      }); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

      await logAction({ orgId: 'org1', action: 'login' });

      const insertCall = mockClient.query.mock.calls[2];
      expect(insertCall[1][9]).toBe('0'.repeat(64));
    });
  });

  describe('verifyAuditChain', () => {
    function computeExpectedHash(prevHash, entry) {
      const hashPayload = stableStringify({
        org_id: entry.org_id || null,
        actor_id: entry.actor_id || null,
        actor_type: entry.actor_type || null,
        action: entry.action || null,
        resource_type: entry.resource_type || null,
        resource_id: entry.resource_id || null,
        changes: entry.changes || null,
        metadata: entry.metadata || null,
        risk_score: entry.risk_score || 0,
        timestamp: entry.created_at ? new Date(entry.created_at).toISOString() : null
      });
      return crypto.createHash('sha256').update(prevHash + hashPayload, 'utf8').digest('hex');
    }

    it('should return valid for a valid chain', async () => {
      const entries = [
        {
          id: 1,
          action: 'login',
          resource_id: 'r1',
          actor_id: 'u1',
          prev_hash: '0'.repeat(64),
          entry_hash: computeExpectedHash('0'.repeat(64), {
            action: 'login',
            resource_id: 'r1',
            actor_id: 'u1',
            created_at: '2024-01-01T00:00:00.000Z'
          }),
          created_at: new Date('2024-01-01T00:00:00.000Z')
        },
        {
          id: 2,
          action: 'logout',
          resource_id: 'r1',
          actor_id: 'u1',
          prev_hash: computeExpectedHash('0'.repeat(64), {
            action: 'login',
            resource_id: 'r1',
            actor_id: 'u1',
            created_at: '2024-01-01T00:00:00.000Z'
          }),
          entry_hash: computeExpectedHash(
            computeExpectedHash('0'.repeat(64), {
              action: 'login',
              resource_id: 'r1',
              actor_id: 'u1',
              created_at: '2024-01-01T00:00:00.000Z'
            }),
            {
              action: 'logout',
              resource_id: 'r1',
              actor_id: 'u1',
              created_at: '2024-01-01T01:00:00.000Z'
            }
          ),
          created_at: new Date('2024-01-01T01:00:00.000Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: entries });
      const result = await verifyAuditChain('org1');
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(2);
      expect(result.firstInvalidEntry).toBeNull();
    });

    it('should return invalid for a tampered chain (bad entry_hash)', async () => {
      const entries = [
        {
          id: 1,
          action: 'login',
          resource_id: 'r1',
          actor_id: 'u1',
          prev_hash: '0'.repeat(64),
          entry_hash: 'tamperedhash000000000000000000000000000000000000000000000000',
          created_at: new Date('2024-01-01T00:00:00.000Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: entries });
      const result = await verifyAuditChain('org1');
      expect(result.valid).toBe(false);
      expect(result.firstInvalidEntry).toBe(1);
    });

    it('should return invalid for a broken prev_hash link', async () => {
      const entries = [
        {
          id: 1,
          action: 'login',
          resource_id: 'r1',
          actor_id: 'u1',
          prev_hash: '0'.repeat(64),
          entry_hash: computeExpectedHash('0'.repeat(64), {
            action: 'login',
            resource_id: 'r1',
            actor_id: 'u1',
            created_at: '2024-01-01T00:00:00.000Z'
          }),
          created_at: new Date('2024-01-01T00:00:00.000Z')
        },
        {
          id: 2,
          action: 'logout',
          resource_id: 'r1',
          actor_id: 'u1',
          prev_hash: 'broken000000000000000000000000000000000000000000000000000000',
          entry_hash: 'irrelevant',
          created_at: new Date('2024-01-01T01:00:00.000Z')
        }
      ];

      mockClient.query.mockResolvedValue({ rows: entries });
      const result = await verifyAuditChain('org1');
      expect(result.valid).toBe(false);
      expect(result.firstInvalidEntry).toBe(2);
    });

    it('should return valid for empty chain', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const result = await verifyAuditChain('org1');
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(0);
    });
  });

  describe('exportAuditLogs', () => {
    const sampleLogs = [
      {
        id: 1,
        action: 'login',
        actor_id: 'u1',
        actor_type: 'user',
        resource_type: 'session',
        resource_id: 's1',
        risk_score: 5,
        created_at: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        action: 'revoke',
        actor_id: 'u2',
        actor_type: 'admin',
        resource_type: 'agent',
        resource_id: 'a1',
        risk_score: 80,
        created_at: '2024-01-02T00:00:00.000Z'
      }
    ];

    it('JSON format should return array', async () => {
      query.mockResolvedValue({ rows: sampleLogs });
      const result = await exportAuditLogs({ orgId: 'org1', format: 'json' });
      const parsed = JSON.parse(result.data);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].action).toBe('login');
    });

    it('CSV format should have proper headers and rows', async () => {
      query.mockResolvedValue({ rows: sampleLogs });
      const result = await exportAuditLogs({ orgId: 'org1', format: 'csv' });
      const lines = result.data.split('\n');
      expect(lines[0]).toBe('id,action,actor_id,actor_type,resource_type,resource_id,risk_score,created_at');
      expect(lines[1]).toContain('login');
      expect(lines[1]).toContain('u1');
      expect(lines[2]).toContain('revoke');
      expect(lines[2]).toContain('u2');
    });

    it('CSV should escape values with commas or quotes', async () => {
      query.mockResolvedValue({
        rows: [
          {
            id: 1,
            action: 'create,update',
            actor_id: 'u1"test',
            actor_type: 'user',
            resource_type: 'session',
            resource_id: 's1',
            risk_score: 5,
            created_at: '2024-01-01T00:00:00.000Z'
          }
        ]
      });
      const result = await exportAuditLogs({ orgId: 'org1', format: 'csv' });
      const lines = result.data.split('\n');
      expect(lines[1]).toContain('"create,update"');
      expect(lines[1]).toContain('"u1""test"');
    });
  });
});
