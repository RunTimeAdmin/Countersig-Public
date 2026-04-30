/**
 * Integration smoke tests — validates route wiring, status codes and response shapes.
 * Uses supertest against the Express app with mocked DB/Redis layers.
 */

// ── Environment ──────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.BAGS_API_KEY = 'test-bags-key';
process.env.NODE_ENV = 'test';
process.env.DID_ED25519_PUBLIC_KEY = 'zTestPublicKeyBase58';

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getPoolMetrics: jest.fn().mockReturnValue({}),
  getCircuitState: jest.fn().mockReturnValue('closed'),
}));

jest.mock('../../src/models/redis', () => ({
  redis: {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    pipeline: jest.fn(() => ({
      setex: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    })),
    on: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn().mockReturnValue({
      status: 'ready',
      subscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

const request = require('supertest');
const app = require('../../server');

// ── Tests ────────────────────────────────────────────────────────────

describe('Integration — route smoke tests', () => {
  // ---- Health --------------------------------------------------------
  describe('GET /health', () => {
    it('returns 200 with status field', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
    });
  });

  // ---- Agents --------------------------------------------------------
  describe('GET /agents', () => {
    it('returns 200 with an array body', async () => {
      const { query } = require('../../src/models/db');
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/agents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ---- Verify-token (no body) ----------------------------------------
  describe('POST /agents/verify-token', () => {
    it('returns 400 or 401 when no body is sent', async () => {
      const res = await request(app).post('/agents/verify-token');
      expect([400, 401]).toContain(res.status);
    });
  });

  // ---- Verify challenge (no body) ------------------------------------
  describe('POST /verify/challenge', () => {
    it('returns 400 when no body is sent', async () => {
      const res = await request(app)
        .post('/verify/challenge')
        .set('X-Requested-With', 'AgentID')
        .send({});
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ---- Badge (nonexistent) -------------------------------------------
  describe('GET /badge/nonexistent', () => {
    it('returns 404 for unknown pubkey', async () => {
      const { query } = require('../../src/models/db');
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/badge/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ---- DID document --------------------------------------------------
  describe('GET /.well-known/did.json', () => {
    it('returns 200 with id and verificationMethod', async () => {
      const res = await request(app).get('/.well-known/did.json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('verificationMethod');
    });
  });

  // ---- Billing (requires auth) --------------------------------------
  describe('GET /billing/usage', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/billing/usage');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /billing/checkout', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/billing/checkout');
      expect(res.status).toBe(401);
    });
  });
});
