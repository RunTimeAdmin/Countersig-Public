/**
 * Mock config module for testing
 */

const config = {
  port: 3002,
  nodeEnv: 'test',
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  redisUrl: 'redis://localhost:6379',
  corsOrigin: 'http://localhost:5173',
  badgeCacheTtl: 60,
  challengeExpirySeconds: 300,
  saidGatewayUrl: 'https://test-gateway.example.com',
  bagsApiKey: 'test-key',
  agentidBaseUrl: 'http://localhost:3002'
};

export default config;
module.exports = config;
