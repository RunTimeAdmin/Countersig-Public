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

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const config = require('./src/config');
const errorHandler = require('./src/middleware/errorHandler');
const { defaultLimiter } = require('./src/middleware/rateLimit');
const { auditMiddleware } = require('./src/middleware/auditMiddleware');
const { cleanupDemoAgents } = require('./src/models/queries');
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
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'agentid-api',
    timestamp: new Date().toISOString()
  });
});

// Rate limiting
app.use(defaultLimiter);

// Audit middleware (logs mutating requests after response is sent)
app.use(auditMiddleware);

// CSRF protection - require custom header on mutating requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Skip CSRF check for public endpoints
    const publicPaths = ['/public/', '/badge/', '/widget/', '/health'];
    if (publicPaths.some(p => req.path.startsWith(p))) {
      return next();
    }
    if (req.get('X-Requested-With') !== 'AgentID') {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
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
    const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
      try {
        const deletedCount = await cleanupDemoAgents();
        if (deletedCount > 0) {
          console.log(`Demo cleanup: removed ${deletedCount} demo agent(s) older than 24 hours`);
        }
      } catch (err) {
        console.error('Demo cleanup error:', err.message);
      }
    }, CLEANUP_INTERVAL_MS);
    console.log('Demo agent cleanup scheduled (every hour)');

    // Initialize real-time event listeners
    const { initPolicyListeners } = require('./src/services/policyEngine');
    const { initWebhookListeners } = require('./src/services/webhookService');
    initPolicyListeners();
    initWebhookListeners();
  });
}

module.exports = app;
