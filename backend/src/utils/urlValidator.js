'use strict';

const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd[0-9a-f]{2}:/i
];

/**
 * Validates a URL is a public HTTPS endpoint (not internal/private)
 * Prevents SSRF attacks by resolving DNS and checking IP ranges
 */
async function assertPublicHttpsUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  if (u.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  if (u.username || u.password) {
    throw new Error('URLs with credentials are not allowed');
  }

  // Block localhost variants
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0') {
    throw new Error('Localhost URLs are not allowed');
  }

  // DNS resolve and check all addresses
  try {
    const addrs = await dns.lookup(host, { all: true });
    for (const { address } of addrs) {
      if (net.isIP(address) === 0) continue;
      for (const range of PRIVATE_RANGES) {
        if (range.test(address)) {
          throw new Error(`URL resolves to non-routable address: ${address}`);
        }
      }
    }
    return { url: u.toString(), resolvedAddresses: addrs.map(a => a.address) };
  } catch (err) {
    if (err.message.includes('non-routable') || err.message.includes('not allowed')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${host}: ${err.message}`);
  }
}

module.exports = { assertPublicHttpsUrl, PRIVATE_RANGES };
