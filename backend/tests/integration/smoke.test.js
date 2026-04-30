/**
 * Integration smoke tests — lightweight HTTP-level checks via supertest.
 * Complements routes.test.js with additional endpoint coverage.
 *
 * All DB/Redis dependencies are mocked so these run without infrastructure.
 * For full end-to-end tests against real services, use the CI services block.
 */

// ── Environment ──────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.BAGS_API_KEY = 'test-bags-key';
process.env.NODE_ENV = 'test';

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

describe('Smoke Tests', () => {
  // ---- Health --------------------------------------------------------
  describe('GET /health', () => {
    test('returns 200 with status field', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe('ok');
    });
  });

  // ---- OpenAPI spec --------------------------------------------------
  describe('GET /openapi.yaml', () => {
    test('returns 200 with YAML content type', async () => {
      const res = await request(app).get('/openapi.yaml');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/yaml|text/);
    });
  });

  // ---- Swagger docs --------------------------------------------------
  describe('GET /docs', () => {
    test('returns 200 with HTML', async () => {
      const res = await request(app).get('/docs');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });
  });

  // ---- 404 for unknown routes ----------------------------------------
  describe('Unknown route', () => {
    test('returns 404 JSON for undefined paths', async () => {
      const res = await request(app).get('/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
    });
  });

  // ---- Auth endpoints (no credentials) --------------------------------
  describe('POST /auth/login', () => {
    test('returns 400 or 401 without credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('X-Requested-With', 'Countersig')
        .send({});
      expect([400, 401, 422]).toContain(res.status);
    });
  });

  // ---- Register (no body) ---------------------------------------------
  describe('POST /register', () => {
    test('returns 400 or 422 without valid payload', async () => {
      const res = await request(app)
        .post('/register')
        .set('X-Requested-With', 'Countersig')
        .send({});
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ---- v1 prefix routing ----------------------------------------------
  describe('GET /v1/health (404 — health is not under v1)', () => {
    test('v1 router does not expose /health', async () => {
      const res = await request(app).get('/v1/health');
      // /health is mounted on root, not v1Router, so /v1/health should 404
      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/agents', () => {
    test('returns 200 via versioned prefix', async () => {
      const { query } = require('../../src/models/db');
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/v1/agents');
      expect(res.status).toBe(200);
    });
  });

  // ---- Metrics (no secret configured) ---------------------------------
  describe('GET /metrics', () => {
    test('returns 200 when no METRICS_SECRET is set', async () => {
      delete process.env.METRICS_SECRET;
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text/);
    });
  });
});
