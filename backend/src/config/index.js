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

  // CORS configuration
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Cache and expiry configuration
  badgeCacheTtl: parseInt(process.env.BADGE_CACHE_TTL, 10) || 60,
  challengeExpirySeconds: parseInt(process.env.CHALLENGE_EXPIRY_SECONDS, 10) || 300,

  // Verified tier threshold configuration
  verifiedThreshold: parseInt(process.env.VERIFIED_THRESHOLD || '70', 10)
};

module.exports = config;
