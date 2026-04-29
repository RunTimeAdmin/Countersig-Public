const client = require('prom-client');

// Create a custom registry
const register = new client.Registry();

// Collect default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

const cacheHits = new client.Counter({
  name: 'redis_cache_hits_total',
  help: 'Total Redis cache hits',
  registers: [register]
});

const cacheMisses = new client.Counter({
  name: 'redis_cache_misses_total',
  help: 'Total Redis cache misses',
  registers: [register]
});

const webhookDeliveries = new client.Counter({
  name: 'webhook_deliveries_total',
  help: 'Total webhook deliveries',
  labelNames: ['status'],
  registers: [register]
});

const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register]
});

// Middleware that records per-request metrics
function metricsMiddleware(req, res, next) {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') return next();

  activeConnections.inc();
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route };

    httpRequestsTotal.inc({ ...labels, status_code: res.statusCode });
    end(labels);
    activeConnections.dec();
  });

  next();
}

module.exports = {
  metricsMiddleware,
  register,
  cacheHits,
  cacheMisses,
  webhookDeliveries
};
