'use strict';

const crypto = require('crypto');

/**
 * Timing-safe string comparison.
 * Returns true if strings are equal, false otherwise.
 * Constant-time to prevent timing attacks.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still do a comparison to avoid length-based timing leak
    // Compare bufA against itself to maintain constant time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { timingSafeEqual };
