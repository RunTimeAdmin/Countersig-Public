'use strict';

jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn()
  }
}));

const dns = require('dns');
const { assertPublicHttpsUrl, PRIVATE_RANGES } = require('../src/utils/urlValidator');

describe('urlValidator', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('assertPublicHttpsUrl', () => {
    describe('valid URLs', () => {
      it('should succeed for https://example.com with public IP', async () => {
        dns.promises.lookup.mockResolvedValue([{ address: '93.184.216.34' }]);

        const result = await assertPublicHttpsUrl('https://example.com');
        expect(result.url).toBe('https://example.com/');
        expect(result.resolvedAddresses).toEqual(['93.184.216.34']);
      });

      it('should succeed for https://api.github.com/webhooks', async () => {
        dns.promises.lookup.mockResolvedValue([{ address: '140.82.121.6' }]);

        const result = await assertPublicHttpsUrl('https://api.github.com/webhooks');
        expect(result.url).toBe('https://api.github.com/webhooks');
        expect(result.resolvedAddresses).toEqual(['140.82.121.6']);
      });
    });

    describe('invalid URL format', () => {
      it('should throw for non-URL string', async () => {
        await expect(assertPublicHttpsUrl('not-a-url')).rejects.toThrow('Invalid URL format');
      });

      it('should throw for empty string', async () => {
        await expect(assertPublicHttpsUrl('')).rejects.toThrow('Invalid URL format');
      });

      it('should throw for null', async () => {
        await expect(assertPublicHttpsUrl(null)).rejects.toThrow();
      });
    });

    describe('non-HTTPS protocols', () => {
      it('should reject http:// URLs', async () => {
        await expect(assertPublicHttpsUrl('http://example.com')).rejects.toThrow('Only HTTPS URLs are allowed');
      });

      it('should reject ftp:// URLs', async () => {
        await expect(assertPublicHttpsUrl('ftp://example.com')).rejects.toThrow('Only HTTPS URLs are allowed');
      });
    });

    describe('URLs with credentials', () => {
      it('should reject URLs with user:pass', async () => {
        await expect(assertPublicHttpsUrl('https://user:pass@example.com')).rejects.toThrow('URLs with credentials are not allowed');
      });

      it('should reject URLs with username only', async () => {
        await expect(assertPublicHttpsUrl('https://user@example.com')).rejects.toThrow('URLs with credentials are not allowed');
      });
    });

    describe('localhost blocking', () => {
      it('should reject https://localhost/hook', async () => {
        await expect(assertPublicHttpsUrl('https://localhost/hook')).rejects.toThrow('Localhost URLs are not allowed');
      });

      it('should reject https://0.0.0.0/hook', async () => {
        await expect(assertPublicHttpsUrl('https://0.0.0.0/hook')).rejects.toThrow('Localhost URLs are not allowed');
      });
    });

    describe('private IP ranges (SSRF protection)', () => {
      const privateIPs = [
        ['10.0.0.1', '10.x range'],
        ['172.16.0.1', '172.16.x range'],
        ['192.168.1.1', '192.168.x range'],
        ['127.0.0.1', 'loopback'],
        ['169.254.1.1', 'link-local'],
        ['0.0.0.1', '0.x range'],
        ['::1', 'IPv6 loopback'],
        ['fc00::1', 'IPv6 unique local'],
        ['fe80::1', 'IPv6 link-local'],
      ];

      it.each(privateIPs)('should reject DNS resolving to %s (%s)', async (ip) => {
        dns.promises.lookup.mockResolvedValue([{ address: ip }]);

        await expect(assertPublicHttpsUrl('https://evil.example.com')).rejects.toThrow('non-routable address');
      });
    });

    describe('DNS resolution failure', () => {
      it('should throw DNS resolution failed on ENOTFOUND', async () => {
        const err = new Error('getaddrinfo ENOTFOUND');
        err.code = 'ENOTFOUND';
        dns.promises.lookup.mockRejectedValue(err);

        await expect(assertPublicHttpsUrl('https://nonexistent.example.com')).rejects.toThrow('DNS resolution failed');
      });
    });
  });

  describe('PRIVATE_RANGES export', () => {
    it('should be an array of 10 regex patterns', () => {
      expect(Array.isArray(PRIVATE_RANGES)).toBe(true);
      expect(PRIVATE_RANGES).toHaveLength(10);
      PRIVATE_RANGES.forEach((r) => {
        expect(r).toBeInstanceOf(RegExp);
      });
    });

    it('should match expected private IPs', () => {
      expect(PRIVATE_RANGES.some(r => r.test('10.0.0.1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('172.16.5.1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('192.168.0.1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('127.0.0.1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('169.254.1.1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('0.0.0.1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('::1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('fc00::1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('fe80::1'))).toBe(true);
      expect(PRIVATE_RANGES.some(r => r.test('fd01::1'))).toBe(true);
    });

    it('should NOT match public IPs', () => {
      expect(PRIVATE_RANGES.some(r => r.test('93.184.216.34'))).toBe(false);
      expect(PRIVATE_RANGES.some(r => r.test('8.8.8.8'))).toBe(false);
      expect(PRIVATE_RANGES.some(r => r.test('140.82.121.6'))).toBe(false);
    });
  });
});
