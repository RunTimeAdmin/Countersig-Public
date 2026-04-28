/**
 * Central configuration module
 * Reads from environment variables with sensible defaults
 */

const config = {
  // Server configuration
  port: parseInt(process.env.PORT, 10) || 3002,
  nodeEnv: process.env.NODE_ENV || 'development',

  // External API configuration
  bagsApiKey: process.env.BAGS_API_KEY || '',
  saidGatewayUrl: process.env.SAID_GATEWAY_URL || 'https://said-identity-gateway.up.railway.app',
  agentIdBaseUrl: process.env.AGENTID_BASE_URL || 'http://localhost:3002',

  // Database configuration
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/agentid',

  // Redis configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisHost: process.env.REDIS_HOST || undefined,
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
  redisPassword: process.env.REDIS_PASSWORD || undefined,

  // CORS configuration (comma-separated for multi-origin support)
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['*'],

  // Cache and expiry configuration
  badgeCacheTtl: parseInt(process.env.BADGE_CACHE_TTL, 10) || 60,
  challengeExpirySeconds: parseInt(process.env.CHALLENGE_EXPIRY_SECONDS, 10) || 300,

  // Verified tier threshold configuration
  verifiedThreshold: parseInt(process.env.VERIFIED_THRESHOLD || '70', 10),

  // Enterprise Auth (OAuth2/OIDC)
  oauth2Enabled: process.env.OAUTH2_ENABLED === 'true',
  oauth2AllowedIssuers: (process.env.OAUTH2_ALLOWED_ISSUERS || '').split(',').map(s => s.trim()).filter(Boolean),
  oauth2AllowedAudiences: (process.env.OAUTH2_ALLOWED_AUDIENCES || '').split(',').map(s => s.trim()).filter(Boolean),

  // Microsoft Entra ID
  entraIdEnabled: process.env.ENTRA_ID_ENABLED === 'true',
  entraTenantId: process.env.ENTRA_TENANT_ID || ''
};

module.exports = config;
