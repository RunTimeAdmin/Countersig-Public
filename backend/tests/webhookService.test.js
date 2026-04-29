'use strict';

const crypto = require('crypto');

// Mock BullMQ
const mockQueueAdd = jest.fn().mockResolvedValue({});
const mockQueueClose = jest.fn().mockResolvedValue();
const mockWorkerClose = jest.fn().mockResolvedValue();
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: mockWorkerClose
  }))
}));

// Mock database
const mockQuery = jest.fn();
jest.mock('../src/models/db', () => ({
  query: mockQuery,
  pool: { query: mockQuery }
}));

// Mock eventBus
const mockEventBusOn = jest.fn();
jest.mock('../src/services/eventBus', () => ({
  on: mockEventBusOn,
  publish: jest.fn()
}));

// Mock urlValidator
jest.mock('../src/utils/urlValidator', () => ({
  assertPublicHttpsUrl: jest.fn().mockResolvedValue({ url: 'https://example.com', resolvedAddresses: ['93.184.216.34'] })
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  getLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() })
}));

// Mock config
jest.mock('../src/config', () => ({
  redisHost: 'localhost',
  redisPort: 6379,
  redisPassword: undefined
}));

// Mock axios (unused in unit tests but required by module)
jest.mock('axios');

const { deliverWebhook, deliverWithRetry, processEventWebhooks, initWebhookListeners, recordDelivery, closeWebhookQueue } = require('../src/services/webhookService');

describe('webhookService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('deliverWebhook()', () => {
    it('should add a job to the BullMQ queue with correct parameters', async () => {
      const url = 'https://example.com/hook';
      const payload = { event: 'agent:created', data: {} };
      const headers = { 'X-Custom': 'value' };

      await deliverWebhook(url, payload, headers);

      expect(mockQueueAdd).toHaveBeenCalledWith('deliver', { url, payload, headers, transformTemplate: null });
    });

    it('should default headers to empty object', async () => {
      await deliverWebhook('https://example.com/hook', { test: true });

      expect(mockQueueAdd).toHaveBeenCalledWith('deliver', {
        url: 'https://example.com/hook',
        payload: { test: true },
        headers: {},
        transformTemplate: null
      });
    });
  });

  describe('deliverWithRetry()', () => {
    const webhook = { url: 'https://example.com/hook', secret: 'test-secret' };
    const event = {
      type: 'agent:updated',
      data: { agentId: '123' },
      timestamp: '2026-01-01',
      id: 'evt-1'
    };

    it('should enqueue delivery with correct HMAC signature', async () => {
      const result = await deliverWithRetry(webhook, event);

      expect(result).toEqual({ success: true, statusCode: null, error: null });
      expect(mockQueueAdd).toHaveBeenCalledTimes(1);

      const callArgs = mockQueueAdd.mock.calls[0];
      expect(callArgs[0]).toBe('deliver');

      const { url, payload, headers } = callArgs[1];
      expect(url).toBe('https://example.com/hook');
      expect(payload).toEqual({
        event: 'agent:updated',
        data: { agentId: '123' },
        timestamp: '2026-01-01',
        id: 'evt-1'
      });
      expect(headers['X-AgentID-Event']).toBe('agent:updated');

      // Verify HMAC correctness independently
      const expectedBody = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', 'test-secret')
        .update(expectedBody)
        .digest('hex');
      expect(headers['X-AgentID-Signature']).toBe(expectedSignature);
    });

    it('should return success even before actual delivery completes', async () => {
      const result = await deliverWithRetry(webhook, event);
      expect(result.success).toBe(true);
      expect(result.statusCode).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('processEventWebhooks()', () => {
    it('should return 0 when event has no orgId', async () => {
      const event = { type: 'agent:created', data: {} };
      const count = await processEventWebhooks(event);
      expect(count).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return 0 when no webhooks match the event type', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'wh-1', org_id: 'org-1', events: ['agent:deleted'], url: 'https://a.com', secret: 's' }
        ]
      });

      const event = { type: 'agent:created', data: { orgId: 'org-1' } };
      const count = await processEventWebhooks(event);
      expect(count).toBe(0);
    });

    it('should return count of matching webhooks and enqueue delivery', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'wh-1', org_id: 'org-1', events: ['agent:created'], url: 'https://a.com', secret: 's1' },
          { id: 'wh-2', org_id: 'org-1', events: ['agent:deleted'], url: 'https://b.com', secret: 's2' }
        ]
      });

      const event = { type: 'agent:created', data: { orgId: 'org-1' }, id: 'e1', timestamp: 'now' };
      const count = await processEventWebhooks(event);
      expect(count).toBe(1);

      // Wait for async delivery to fire
      await new Promise(resolve => setImmediate(resolve));
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it('should return 0 on database error (graceful)', async () => {
      mockQuery.mockRejectedValue(new Error('DB connection lost'));

      const event = { type: 'agent:created', data: { orgId: 'org-1' } };
      const count = await processEventWebhooks(event);
      expect(count).toBe(0);
    });
  });

  describe('initWebhookListeners()', () => {
    it('should register a wildcard listener on eventBus', () => {
      initWebhookListeners();
      expect(mockEventBusOn).toHaveBeenCalledWith('*', expect.any(Function));
    });
  });

  describe('recordDelivery()', () => {
    it('should insert correct values into database', async () => {
      mockQuery.mockResolvedValue({});

      await recordDelivery('wh-1', 'evt-1', 'agent:created', 1, true, 200, 'OK', null);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_deliveries'),
        ['wh-1', 'evt-1', 'agent:created', 1, true, 200, 'OK', null]
      );
    });

    it('should truncate long strings to 500 chars', async () => {
      mockQuery.mockResolvedValue({});
      const longString = 'x'.repeat(1000);

      await recordDelivery('wh-1', 'evt-1', 'agent:created', 1, false, 500, longString, longString);

      const args = mockQuery.mock.calls[0][1];
      expect(args[6]).toHaveLength(500);
      expect(args[7]).toHaveLength(500);
    });

    it('should not throw on database error (fire-and-forget)', async () => {
      mockQuery.mockRejectedValue(new Error('DB write failed'));

      await expect(
        recordDelivery('wh-1', 'evt-1', 'agent:created', 1, true, 200, null, null)
      ).resolves.toBeUndefined();
    });
  });

  describe('closeWebhookQueue()', () => {
    it('should close both worker and queue', async () => {
      await closeWebhookQueue();
      expect(mockWorkerClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
    });
  });
});
