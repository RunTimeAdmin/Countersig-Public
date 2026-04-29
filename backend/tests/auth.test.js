/**
 * Authentication Service Tests
 * Tests for hashPassword, comparePassword, generateTokens, verifyAccessToken,
 * generateApiKey, verifyApiKey, and Redis token management
 */

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';

const mockPipeline = {
  setex: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  srem: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([])
};

jest.mock('../src/models/redis', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn(() => ({ ...mockPipeline }))
  }
}));

const jwt = require('jsonwebtoken');
const {
  hashPassword,
  comparePassword,
  generateTokens,
  verifyAccessToken,
  generateApiKey,
  verifyApiKey,
  storeRefreshToken,
  revokeRefreshToken,
  isRefreshTokenValid
} = require('../src/services/authService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth Service', () => {
  describe('hashPassword / comparePassword', () => {
    it('should hash a password and verify it matches', async () => {
      const password = 'mySecret123';
      const hash = await hashPassword(password);
      const match = await comparePassword(password, hash);
      expect(match).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'mySecret123';
      const hash = await hashPassword(password);
      const match = await comparePassword('wrongPassword', hash);
      expect(match).toBe(false);
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'mySecret123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateTokens', () => {
    it('should return accessToken and refreshToken', () => {
      const user = { id: 'u1', email: 'test@example.com', org_id: 'org1', role: 'admin' };
      const tokens = generateTokens(user);
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('access token should contain userId, email, orgId, role', () => {
      const user = { id: 'u1', email: 'test@example.com', org_id: 'org1', role: 'admin' };
      const { accessToken } = generateTokens(user);
      const decoded = jwt.decode(accessToken);
      expect(decoded.userId).toBe('u1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.orgId).toBe('org1');
      expect(decoded.role).toBe('admin');
    });

    it('tokens should be valid JWTs', () => {
      const user = { id: 'u1', email: 'test@example.com', org_id: 'org1', role: 'admin' };
      const { accessToken, refreshToken } = generateTokens(user);
      expect(() => jwt.verify(accessToken, JWT_SECRET)).not.toThrow();
      expect(() => jwt.verify(refreshToken, JWT_SECRET)).not.toThrow();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const user = { id: 'u1', email: 'test@example.com', org_id: 'org1', role: 'admin' };
      const { accessToken } = generateTokens(user);
      const decoded = verifyAccessToken(accessToken);
      expect(decoded.userId).toBe('u1');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should reject an expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'u1', exp: Math.floor(Date.now() / 1000) - 10 },
        JWT_SECRET
      );
      expect(() => verifyAccessToken(expiredToken)).toThrow();
    });

    it('should reject a tampered token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });
  });

  describe('generateApiKey', () => {
    it('should return rawKey, keyHash, keyPrefix', () => {
      const result = generateApiKey();
      expect(result).toHaveProperty('rawKey');
      expect(result).toHaveProperty('keyHash');
      expect(result).toHaveProperty('keyPrefix');
    });

    it('rawKey should start with aid_', () => {
      const { rawKey } = generateApiKey();
      expect(rawKey.startsWith('aid_')).toBe(true);
    });

    it('keyPrefix should be first 12 chars of rawKey', () => {
      const { rawKey, keyPrefix } = generateApiKey();
      expect(keyPrefix).toBe(rawKey.slice(0, 12));
    });

    it('keyHash should be a 64-char hex string (SHA-256)', () => {
      const { keyHash } = generateApiKey();
      expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyApiKey', () => {
    it('should return the same hash for the same key', () => {
      const key = 'aid_abc123';
      const hash1 = verifyApiKey(key);
      const hash2 = verifyApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('different keys should produce different hashes', () => {
      const hash1 = verifyApiKey('aid_abc123');
      const hash2 = verifyApiKey('aid_def456');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Redis token management', () => {
    const { redis } = require('../src/models/redis');

    it('storeRefreshToken should use redis pipeline', async () => {
      await storeRefreshToken('u1', 'token123');
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('revokeRefreshToken should call redis.del', async () => {
      redis.del.mockResolvedValue(1);
      await revokeRefreshToken('u1');
      expect(redis.del).toHaveBeenCalledWith('refresh:u1');
    });

    it('isRefreshTokenValid should return true when token matches', async () => {
      redis.get.mockResolvedValue('token123');
      const result = await isRefreshTokenValid('u1', 'token123');
      expect(result).toBe(true);
    });

    it('isRefreshTokenValid should return false when token does not match', async () => {
      redis.get.mockResolvedValue('different');
      const result = await isRefreshTokenValid('u1', 'token123');
      expect(result).toBe(false);
    });
  });
});
