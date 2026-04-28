/**
 * Policy Engine Tests
 * Tests for evaluateCondition, evaluateEvent, and executeAction
 */

jest.mock('../src/models/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/services/eventBus', () => ({
  publish: jest.fn()
}));

jest.mock('../src/services/badgeBuilder', () => ({ invalidateAgentCaches: jest.fn() }));

const { query } = require('../src/models/db');
const eventBus = require('../src/services/eventBus');
const { evaluateCondition, evaluateEvent, executeAction } = require('../src/services/policyEngine');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Policy Engine', () => {
  describe('evaluateCondition', () => {
    it('should match event_type condition', () => {
      const event = { type: 'agent.flagged' };
      expect(evaluateCondition({ event_type: 'agent.flagged' }, event)).toBe(true);
    });

    it('should not match different event types', () => {
      const event = { type: 'agent.verified' };
      expect(evaluateCondition({ event_type: 'agent.flagged' }, event)).toBe(false);
    });

    it('should evaluate numeric < comparison as true', () => {
      const event = { data: { bags_score: 30 } };
      expect(evaluateCondition({ field: 'bags_score', op: '<', value: 50 }, event)).toBe(true);
    });

    it('should evaluate numeric > comparison as false', () => {
      const event = { data: { bags_score: 30 } };
      expect(evaluateCondition({ field: 'bags_score', op: '>', value: 50 }, event)).toBe(false);
    });

    it('should evaluate == comparison as true when matching', () => {
      const event = { data: { status: 'flagged' } };
      expect(evaluateCondition({ field: 'status', op: '==', value: 'flagged' }, event)).toBe(true);
    });

    it('should evaluate == comparison as false when not matching', () => {
      const event = { data: { status: 'verified' } };
      expect(evaluateCondition({ field: 'status', op: '==', value: 'flagged' }, event)).toBe(false);
    });

    it('should evaluate contains for string', () => {
      const event = { data: { capabilities: 'algorithmic_trading' } };
      expect(evaluateCondition({ field: 'capabilities', op: 'contains', value: 'trading' }, event)).toBe(true);
    });

    it('should evaluate contains for array', () => {
      const event = { data: { capabilities: ['trading', 'analysis'] } };
      expect(evaluateCondition({ field: 'capabilities', op: 'contains', value: 'trading' }, event)).toBe(true);
    });

    it('should return false for missing fields', () => {
      const event = { data: {} };
      expect(evaluateCondition({ field: 'missing', op: '==', value: 'x' }, event)).toBe(false);
    });

    it('should return false for invalid condition object', () => {
      expect(evaluateCondition(null, { type: 'test' })).toBe(false);
      expect(evaluateCondition('string', { type: 'test' })).toBe(false);
    });

    it('should evaluate <= operator', () => {
      const event = { data: { score: 50 } };
      expect(evaluateCondition({ field: 'score', op: '<=', value: 50 }, event)).toBe(true);
      expect(evaluateCondition({ field: 'score', op: '<=', value: 49 }, event)).toBe(false);
    });

    it('should evaluate >= operator', () => {
      const event = { data: { score: 50 } };
      expect(evaluateCondition({ field: 'score', op: '>=', value: 50 }, event)).toBe(true);
      expect(evaluateCondition({ field: 'score', op: '>=', value: 51 }, event)).toBe(false);
    });

    it('should evaluate != operator', () => {
      const event = { data: { status: 'active' } };
      expect(evaluateCondition({ field: 'status', op: '!=', value: 'flagged' }, event)).toBe(true);
      expect(evaluateCondition({ field: 'status', op: '!=', value: 'active' }, event)).toBe(false);
    });
  });

  describe('evaluateEvent', () => {
    it('should return triggered rules when conditions match', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Flag Low Score', action: 'notify', condition: { field: 'bags_score', op: '<', value: 50 } }
        ]
      });

      const event = { type: 'agent.scored', data: { orgId: 'org1', agentId: 'a1', bags_score: 30 } };
      const result = await evaluateEvent(event);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe(1);
      expect(result[0].executed).toBe(true);
    });

    it('should return empty array when no conditions match', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Flag Low Score', action: 'notify', condition: { field: 'bags_score', op: '<', value: 50 } }
        ]
      });

      const event = { type: 'agent.scored', data: { orgId: 'org1', agentId: 'a1', bags_score: 80 } };
      const result = await evaluateEvent(event);

      expect(result).toHaveLength(0);
    });

    it('should skip disabled rules', async () => {
      query.mockResolvedValue({
        rows: [] // query filters enabled = true
      });

      const event = { type: 'agent.scored', data: { orgId: 'org1', agentId: 'a1' } };
      const result = await evaluateEvent(event);

      expect(result).toHaveLength(0);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM policy_rules WHERE org_id = $1 AND enabled = true',
        ['org1']
      );
    });

    it('should return empty array when no orgId in event', async () => {
      const event = { type: 'agent.scored', data: {} };
      const result = await evaluateEvent(event);
      expect(result).toHaveLength(0);
      expect(query).not.toHaveBeenCalled();
    });

    it('should return empty array when event data is missing', async () => {
      const event = { type: 'agent.scored' };
      const result = await evaluateEvent(event);
      expect(result).toHaveLength(0);
      expect(query).not.toHaveBeenCalled();
    });

    it('should handle multiple matching rules', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Flag Low Score', action: 'notify', condition: { field: 'bags_score', op: '<', value: 50 } },
          { id: 2, name: 'Flag Very Low', action: 'notify', condition: { field: 'bags_score', op: '<', value: 30 } }
        ]
      });

      const event = { type: 'agent.scored', data: { orgId: 'org1', agentId: 'a1', bags_score: 20 } };
      const result = await evaluateEvent(event);

      expect(result).toHaveLength(2);
    });
  });

  describe('executeAction', () => {
    it('should execute notify action via eventBus', async () => {
      const rule = { id: 1, name: 'Test', action: 'notify' };
      const event = { type: 'agent.flagged', data: { orgId: 'org1', agentId: 'a1' } };

      const result = await executeAction(rule, event);

      expect(result.executed).toBe(true);
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should execute revoke action via query', async () => {
      query.mockResolvedValue({ rows: [] });
      const rule = { id: 1, name: 'Test', action: 'revoke' };
      const event = { type: 'agent.flagged', data: { orgId: 'org1', agentId: 'a1' } };

      const result = await executeAction(rule, event);

      expect(result.executed).toBe(true);
      expect(query).toHaveBeenCalledWith(
        "UPDATE agent_identities SET status = 'revoked', revoked_at = NOW() WHERE agent_id = $1",
        ['a1']
      );
    });

    it('should execute disable action via query', async () => {
      query.mockResolvedValue({ rows: [] });
      const rule = { id: 1, name: 'Test', action: 'disable' };
      const event = { type: 'agent.flagged', data: { orgId: 'org1', agentId: 'a1' } };

      const result = await executeAction(rule, event);

      expect(result.executed).toBe(true);
      expect(query).toHaveBeenCalledWith(
        "UPDATE agent_identities SET status = 'disabled' WHERE agent_id = $1",
        ['a1']
      );
    });

    it('should execute flag action via query', async () => {
      query.mockResolvedValue({ rows: [{ pubkey: 'pk1' }] });
      const rule = { id: 1, name: 'Test', action: 'flag' };
      const event = { type: 'agent.flagged', data: { orgId: 'org1', agentId: 'a1' } };

      const result = await executeAction(rule, event);

      expect(result.executed).toBe(true);
    });

    it('should mark unknown actions as not executed', async () => {
      const rule = { id: 1, name: 'Test', action: 'unknown' };
      const event = { type: 'agent.flagged', data: {} };

      const result = await executeAction(rule, event);

      expect(result.executed).toBe(false);
    });

    it('should handle query errors gracefully', async () => {
      query.mockRejectedValue(new Error('DB error'));
      const rule = { id: 1, name: 'Test', action: 'revoke' };
      const event = { type: 'agent.flagged', data: { orgId: 'org1', agentId: 'a1' } };

      const result = await executeAction(rule, event);

      expect(result.executed).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
});
