require('dotenv').config();

// Required environment variables - server will not start without these
const required = ['DATABASE_URL', 'BAGS_API_KEY', 'REDIS_URL', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('========================================');
  console.error('FATAL: Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  console.error('');
  console.error('Copy .env.example to .env and configure:');
  console.error('  cp .env.example .env');
  console.error('========================================');
  process.exit(1);
}

// Recommended environment variables - warn but allow startup
const recommended = ['CORS_ORIGIN', 'AGENTID_BASE_URL'];
const missingRecommended = recommended.filter(key => !process.env[key]);
if (missingRecommended.length > 0) {
  console.warn('WARNING: Missing recommended environment variables (using defaults):');
  missingRecommended.forEach(key => console.warn(`  - ${key}`));
}

if (process.env.NODE_ENV === 'production' && !process.env.DID_ED25519_PUBLIC_KEY) {
  console.warn('WARNING: DID_ED25519_PUBLIC_KEY not set — /.well-known/did.json will return 503');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const config = require('./src/config');
const errorHandler = require('./src/middleware/errorHandler');
const { defaultLimiter } = require('./src/middleware/rateLimit');
const { auditMiddleware } = require('./src/middleware/auditMiddleware');
const { cleanupDemoAgents } = require('./src/models/queries');
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

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.get('X-Request-Id') || crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
});

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

// Health check route
app.get('/health', async (req, res) => {
  // Detailed health check requires secret header (constant-time compare)
  const HEALTH_SECRET = process.env.HEALTH_DETAIL_SECRET;
  const provided = req.headers['x-health-detail'];
  const showDetail = HEALTH_SECRET && provided &&
    Buffer.byteLength(provided) === Buffer.byteLength(HEALTH_SECRET) &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(HEALTH_SECRET));

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

  // Check PostgreSQL
  try {
    const { pool } = require('./src/models/db');
    await pool.query('SELECT 1');
    health.postgres = 'connected';
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
    const csrfSkipExact = ['/health', '/verify-token'];
    const csrfSkipPrefix = ['/public/', '/badge/', '/widget/'];
    if (csrfSkipExact.includes(req.path) || csrfSkipPrefix.some(p => req.path.startsWith(p))) {
      return next();
    }
    // Bearer auth doesn't need CSRF (browsers don't auto-attach Authorization headers)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return next();
    if (req.get('X-Requested-With') !== 'AgentID') {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
  }
  next();
});

// JWKS endpoint — public, no auth required
// Exposes key metadata so receiving agents can verify A2A tokens
app.get('/.well-known/jwks.json', (req, res) => {
  res.json({
    keys: [
      {
        kty: 'oct',
        kid: 'agentid-a2a-v1',
        use: 'sig',
        alg: 'HS256'
        // Note: HMAC secrets are symmetric — the actual key is NOT exposed.
        // Verifiers must obtain the shared secret via secure channel.
        // This endpoint documents the key metadata and algorithm.
      }
    ],
    issuer: new URL(config.agentIdBaseUrl).hostname,
    documentation: `${config.agentIdBaseUrl}/docs/a2a-auth`,
    // Provide the verification endpoint for agents that can't use shared secrets
    verify_endpoint: '/verify-token'
  });
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
    console.log(`🚀 AgentID API server running on port ${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🏥 Health check: http://localhost:${config.port}/health`);

    // Non-blocking SAID Gateway connectivity check
    axios.get(`${config.saidGatewayUrl}/health`, { timeout: 5000 })
      .then(() => console.log('SAID Gateway: connected'))
      .catch(() => console.warn('SAID Gateway: unreachable (non-critical — SAID features will degrade gracefully)'));
    
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
        console.error('Demo cleanup error:', err.message);
      }
    }

    setInterval(cleanupDemoAgentsWithLock, CLEANUP_INTERVAL_MS);
    console.log('Demo agent cleanup scheduled (every hour, distributed lock enabled)');

    // Initialize real-time event listeners
    const { initPolicyListeners } = require('./src/services/policyEngine');
    const { initWebhookListeners } = require('./src/services/webhookService');
    initPolicyListeners();
    initWebhookListeners();
  });
}

module.exports = app;
