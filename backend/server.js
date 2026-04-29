require('dotenv').config();

const { logger, getLogger } = require('./src/utils/logger');
const requestLogger = require('./src/middleware/requestLogger');

// Required environment variables - server will not start without these
const required = ['DATABASE_URL', 'BAGS_API_KEY', 'REDIS_URL', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.fatal({ missing }, 'Missing required environment variables. Copy .env.example to .env and configure.');
  process.exit(1);
}

// Recommended environment variables - warn but allow startup
const recommended = ['CORS_ORIGIN', 'AGENTID_BASE_URL'];
const missingRecommended = recommended.filter(key => !process.env[key]);
if (missingRecommended.length > 0) {
  logger.warn({ missing: missingRecommended }, 'Missing recommended environment variables (using defaults)');
}

if (process.env.NODE_ENV === 'production' && !process.env.DID_ED25519_PUBLIC_KEY) {
  logger.warn('DID_ED25519_PUBLIC_KEY not set — /.well-known/did.json will return 503');
}

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./src/config');
const { timingSafeEqual } = require('./src/utils/crypto');
const errorHandler = require('./src/middleware/errorHandler');
const { metricsMiddleware, register } = require('./src/middleware/metricsMiddleware');
const { defaultLimiter } = require('./src/middleware/rateLimit');
const { auditMiddleware } = require('./src/middleware/auditMiddleware');
const { usageMiddleware } = require('./src/middleware/usageMiddleware');
const { dataResidencyMiddleware } = require('./src/middleware/dataResidency');
const { planEnforcement } = require('./src/middleware/planEnforcement');
const { cleanupDemoAgents } = require('./src/models/agentQueries');
const { redis } = require('./src/models/redis');
const axios = require('axios');

// Import route modules
const registerRoutes = require('./src/routes/register');
const verifyRoutes = require('./src/routes/verify');
const badgeRoutes = require('./src/routes/badge');
const reputationRoutes = require('./src/routes/reputation');
const agentsRoutes = require('./src/routes/agents');
const attestationRoutes = require('./src/routes/attestations');
const widgetRoutes = require('./src/routes/widget');
const authRoutes = require('./src/routes/auth');
const apiKeyRoutes = require('./src/routes/apikeys');
const orgRoutes = require('./src/routes/orgs');
const auditRoutes = require('./src/routes/audit');
const policyRoutes = require('./src/routes/policies');
const webhookRoutes = require('./src/routes/webhooks');
const heartbeatRoutes = require('./src/routes/heartbeat');
const credentialRoutes = require('./src/routes/credentials');
const usageRoutes = require('./src/routes/usage');

const app = express();

// Trust proxy headers from Nginx reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));

// CORS middleware
const corsOrigins = config.corsOrigin;
app.use(cors({
  origin: corsOrigins.includes('*')
    ? '*'
    : function (origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID + structured request logging
app.use(requestLogger);

// Prometheus request metrics
app.use(metricsMiddleware);

// Prometheus metrics endpoint (protected by METRICS_SECRET)
app.get('/metrics', async (req, res) => {
  const secret = process.env.METRICS_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Serve OpenAPI spec
app.get('/openapi.yaml', (req, res) => {
  const specPath = path.join(__dirname, 'openapi.yaml');
  if (fs.existsSync(specPath)) {
    res.type('text/yaml').sendFile(specPath);
  } else {
    res.status(404).json({ error: 'OpenAPI spec not found' });
  }
});

// Swagger UI (CDN-based, zero dependencies)
app.get('/docs', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>AgentID API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui' });</script>
</body></html>`);
});

// Health check route
app.get('/health', async (req, res) => {
  // Detailed health check requires secret header (constant-time compare)
  const HEALTH_SECRET = process.env.HEALTH_DETAIL_SECRET;
  const provided = req.headers['x-health-detail'];
  const showDetail = HEALTH_SECRET && provided && timingSafeEqual(provided, HEALTH_SECRET);

  if (!showDetail) {
    return res.json({ status: 'ok' });
  }

  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
    postgres: 'unknown',
    redis: 'unknown',
    chains: []
  };

  // Check PostgreSQL (with timeout to prevent hanging)
  try {
    const { query, getPoolMetrics, getCircuitState } = require('./src/models/db');
    const dbCheck = await Promise.race([
      (async () => {
        await query('SELECT 1');
        return { status: 'ok', ...getPoolMetrics(), circuit: getCircuitState() };
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB health check timeout')), 5000))
    ]);
    health.postgres = 'connected';
    health.database = dbCheck;
  } catch (err) {
    health.postgres = 'disconnected';
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = require('./src/models/redis').redis;
    if (redis && redis.status === 'ready') {
      health.redis = 'connected';
    } else if (redis) {
      await redis.ping();
      health.redis = 'connected';
    } else {
      health.redis = 'not configured';
    }
  } catch (err) {
    health.redis = 'disconnected';
    health.status = 'degraded';
  }

  // Check chain adapters
  try {
    const { getSupportedChains } = require('./src/services/chainAdapters');
    health.chains = getSupportedChains().map(c => c.chainType);
  } catch (err) {
    health.chains = [];
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Rate limiting
app.use(defaultLimiter);

// Audit middleware (logs mutating requests after response is sent)
app.use(auditMiddleware);

// Usage tracking middleware (fire-and-forget Redis counter on res.finish)
app.use(usageMiddleware);

// Data residency headers and compliance audit trail
app.use(dataResidencyMiddleware);

// CSRF protection - require custom header on mutating requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Explicit allowlist of paths that skip CSRF validation:
    // - /public/  : public registry endpoints (read-only semantics, no sensitive state mutation)
    // - /badge/   : badge image endpoints (idempotent, no auth)
    // - /widget/  : widget embed endpoints (read-only, no auth)
    // - /health   : health check (never mutates state)
    // - /verify-token : A2A token verification (unauthenticated, called by external agents
    //                    that do not send the X-Requested-With header)
    const csrfSkipExact = ['/health', '/verify-token', '/.well-known/jwks.json', '/v1/verify-token', '/credentials/verify', '/v1/credentials/verify', '/openapi.yaml', '/docs'];
    const csrfSkipPrefix = ['/public/', '/badge/', '/widget/', '/v1/public/', '/v1/badge/', '/v1/widget/'];
    if (csrfSkipExact.includes(req.path) || csrfSkipPrefix.some(p => req.path.startsWith(p))) {
      return next();
    }
    // Bearer auth doesn't need CSRF (browsers don't auto-attach Authorization headers)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return next();

    // Origin validation (defense-in-depth)
    const origin = req.get('Origin') || req.get('Referer');
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const allowedHosts = (config.corsOrigin || [])
          .filter(o => o !== '*')
          .map(o => { try { return new URL(o).hostname; } catch { return null; } })
          .filter(Boolean);
        // Also allow the API's own domain
        if (config.cookieDomain) {
          allowedHosts.push(config.cookieDomain.replace(/^\./, ''));
        }
        if (!allowedHosts.some(h => originHost === h || originHost.endsWith('.' + h))) {
          return res.status(403).json({ error: 'CSRF validation failed: origin not allowed' });
        }
      } catch (e) {
        return res.status(403).json({ error: 'CSRF validation failed: invalid origin' });
      }
    }

    // Secondary defense: require custom header on cookie-authenticated requests
    if (req.get('X-Requested-With') !== 'AgentID') {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
  }
  next();
});

// JWKS endpoint for A2A token Ed25519 public key verification
app.get('/.well-known/jwks.json', async (req, res) => {
  try {
    const { getA2APublicKeyJWK } = require('./src/services/authService');
    const jwk = await getA2APublicKeyJWK();
    if (!jwk) {
      return res.status(503).json({ error: 'A2A signing keys not configured' });
    }
    res.json({ keys: [jwk] });
  } catch (err) {
    logger.error({ err }, 'Error exporting JWKS public key');
    res.status(500).json({ error: 'Failed to export JWKS' });
  }
});

// DID Document endpoint — public, no auth required
// Exposes W3C DID document for did:web:agentidapp.com
app.get('/.well-known/did.json', (req, res) => {
  const pubkey = process.env.DID_ED25519_PUBLIC_KEY;

  if (!pubkey && config.nodeEnv === 'production') {
    return res.status(503).json({
      error: 'DID document not available — DID_ED25519_PUBLIC_KEY not configured'
    });
  }

  const didDomain = new URL(config.agentIdBaseUrl).hostname;
  const didId = `did:web:${didDomain}`;

  res.json({
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1'
    ],
    id: didId,
    controller: didId,
    verificationMethod: [
      {
        id: `${didId}#ed25519-key`,
        type: 'Ed25519VerificationKey2020',
        controller: didId,
        // Public key would be populated from env in production
        publicKeyMultibase: process.env.DID_ED25519_PUBLIC_KEY || 'z_PLACEHOLDER_CONFIGURE_IN_ENV'
      },
      {
        id: `${didId}#secp256k1-key`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: didId,
        publicKeyMultibase: process.env.DID_SECP256K1_PUBLIC_KEY || 'z_PLACEHOLDER_CONFIGURE_IN_ENV'
      }
    ],
    authentication: [
      `${didId}#ed25519-key`,
      `${didId}#secp256k1-key`
    ],
    assertionMethod: [
      `${didId}#ed25519-key`,
      `${didId}#secp256k1-key`
    ],
    service: [
      {
        id: `${didId}#agentid-api`,
        type: 'AgentIDService',
        serviceEndpoint: config.agentIdBaseUrl
      },
      {
        id: `${didId}#a2a-verify`,
        type: 'A2AVerificationService',
        serviceEndpoint: `${config.agentIdBaseUrl}/verify-token`
      },
      {
        id: `${didId}#credential-issuance`,
        type: 'VerifiableCredentialService',
        serviceEndpoint: `${config.agentIdBaseUrl}/agents/{agentId}/credential`
      }
    ]
  });
});

// Deprecation headers for unversioned API routes
app.use((req, res, next) => {
  // Skip non-API paths: v1-prefixed, health, well-known, static assets
  if (req.path.startsWith('/v1/') ||
      req.path.startsWith('/.well-known/') ||
      req.path === '/health' ||
      req.path.startsWith('/public/') ||
      req.path.startsWith('/badge/') ||
      req.path.startsWith('/widget/')) {
    return next();
  }
  // Add deprecation headers to unversioned API calls
  res.set('Deprecation', 'true');
  res.set('Sunset', '2026-10-01');
  res.set('Link', `</v1${req.path}>; rel="successor-version"`);
  next();
});

// Cache headers for public read endpoints
app.use(['/badge', '/widget', '/v1/badge', '/v1/widget'], (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  }
  next();
});

// API routes
app.use('/', registerRoutes);       // POST /register
app.use('/verify', verifyRoutes);   // POST /verify/challenge, /verify/response
app.use('/', badgeRoutes);          // GET /badge/:pubkey, /badge/:pubkey/svg
app.use('/', reputationRoutes);     // GET /reputation/:pubkey
app.use('/', agentsRoutes);         // GET /agents, /agents/:pubkey, /discover
app.use('/', attestationRoutes);    // POST /agents/:pubkey/attest, /flag etc.
app.use('/', widgetRoutes);         // GET /widget/:pubkey
app.use('/', authRoutes);           // POST /auth/register, /auth/login, /auth/refresh, /auth/logout
app.use('/', apiKeyRoutes);         // POST /api-keys, GET /api-keys, DELETE /api-keys/:id
app.use('/', orgRoutes);            // GET/PUT /orgs/:orgId, /orgs/:orgId/members, /orgs/:orgId/invite, /orgs/:orgId/stats
app.use('/', auditRoutes);          // GET /audit/logs
app.use('/', policyRoutes);         // GET/POST/PUT/DELETE /orgs/:orgId/policies
// Webhook ingestion may receive larger payloads
app.use('/webhooks', express.json({ limit: '1mb' }));
app.use('/', webhookRoutes);        // GET/POST/PUT/DELETE /orgs/:orgId/webhooks
app.use('/', heartbeatRoutes);      // POST /agents/:agentId/heartbeat
app.use('/', credentialRoutes);     // POST /credentials/verify
app.use('/', usageRoutes);          // GET /orgs/:orgId/usage, /orgs/:orgId/usage/history

// ── API v1 — Canonical versioned prefix ────────────────────
// All routes are also available under /v1/ as the canonical versioned endpoint.
// Root-mounted routes will be deprecated in a future release.
const v1Router = express.Router();
v1Router.use('/', registerRoutes);
v1Router.use('/verify', verifyRoutes);
v1Router.use('/', badgeRoutes);
v1Router.use('/', reputationRoutes);
v1Router.use('/', agentsRoutes);
v1Router.use('/', attestationRoutes);
v1Router.use('/', widgetRoutes);
v1Router.use('/', authRoutes);
v1Router.use('/', apiKeyRoutes);
v1Router.use('/', orgRoutes);
v1Router.use('/', auditRoutes);
v1Router.use('/', policyRoutes);
v1Router.use('/webhooks', express.json({ limit: '1mb' }));
v1Router.use('/', webhookRoutes);
v1Router.use('/', heartbeatRoutes);
v1Router.use('/', credentialRoutes);
v1Router.use('/', usageRoutes);
app.use('/v1', v1Router);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'AgentID API server running');

    // Non-blocking SAID Gateway connectivity check
    axios.get(`${config.saidGatewayUrl}/health`, { timeout: 5000 })
      .then(() => logger.info('SAID Gateway: connected'))
      .catch(() => logger.warn('SAID Gateway: unreachable (non-critical — SAID features will degrade gracefully)'));
    
    // Start demo agent cleanup job (runs every hour)
    // Uses a Redis-based distributed lock so only one instance runs cleanup
    const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    async function cleanupDemoAgentsWithLock() {
      try {
        if (!redis || redis.status !== 'ready') {
          // No Redis available — single instance assumed, run locally
          await cleanupDemoAgents();
          return;
        }
        // Acquire lock for 1 hour (matches the interval)
        const acquired = await redis.set('demo-cleanup-lock', Date.now().toString(), 'NX', 'EX', 3600);
        if (acquired) {
          await cleanupDemoAgents();
        }
      } catch (err) {
        logger.error({ err }, 'Demo cleanup error');
      }
    }

    setInterval(cleanupDemoAgentsWithLock, CLEANUP_INTERVAL_MS);
    logger.info('Demo agent cleanup scheduled (every hour, distributed lock enabled)');

    // Health status background job — mark stale/offline agents every 60s
    const { query: dbQuery } = require('./src/models/db');
    setInterval(async () => {
      try {
        await dbQuery(`
          UPDATE agent_identities 
          SET health_status = 'stale' 
          WHERE last_heartbeat < NOW() - INTERVAL '2 minutes' 
            AND health_status = 'healthy' 
            AND deleted_at IS NULL
        `);
        await dbQuery(`
          UPDATE agent_identities 
          SET health_status = 'offline' 
          WHERE last_heartbeat < NOW() - INTERVAL '10 minutes' 
            AND health_status IN ('healthy', 'stale') 
            AND deleted_at IS NULL
        `);
      } catch (err) {
        logger.error({ err }, 'Health status update failed');
      }
    }, 60000);
    logger.info('Agent health status reconciliation scheduled (every 60s)');

    // Trust score propagation — compute every 15 minutes with distributed lock
    const { computeTrustScores } = require('./src/services/trustPropagation');
    const TRUST_SCORE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    async function computeTrustScoresWithLock() {
      try {
        if (redis && redis.status === 'ready') {
          const locked = await redis.set('lock:trust-scores', '1', 'NX', 'EX', 840); // 14min lock
          if (locked) {
            await computeTrustScores();
          }
        } else {
          await computeTrustScores();
        }
      } catch (err) {
        logger.error({ err }, 'Trust score computation job failed');
      }
    }
    setInterval(computeTrustScoresWithLock, TRUST_SCORE_INTERVAL_MS);
    logger.info('Trust score propagation scheduled (every 15 minutes, distributed lock enabled)');

    // Initialize real-time event listeners
    const { init: initCacheInvalidation } = require('./src/services/cacheInvalidation');
    const { initPolicyListeners } = require('./src/services/policyEngine');
    const { initWebhookListeners } = require('./src/services/webhookService');
    initCacheInvalidation();
    initPolicyListeners();
    initWebhookListeners();
  });
}

module.exports = app;
