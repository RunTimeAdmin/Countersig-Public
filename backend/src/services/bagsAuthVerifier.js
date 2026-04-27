/**
 * Bags Auth Verifier Service
 * Wraps the Bags agent auth flow to verify wallet ownership
 */

const axios = require('axios');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const config = require('../config');

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1/agent/v2';

/**
 * Initialize Bags auth flow for a given pubkey
 * @param {string} pubkey - The agent's public key (wallet address)
 * @returns {Promise<{message: string, nonce: string}>} - Challenge message and nonce from Bags
 */
async function initBagsAuth(pubkey) {
  const response = await axios.post(
    `${BAGS_API_BASE}/auth/init`,
    { address: pubkey },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.bagsApiKey
      },
      timeout: 10000
    }
  );

  return {
    message: response.data.message,
    nonce: response.data.nonce
  };
}

/**
 * Verify an Ed25519 signature using tweetnacl
 * @param {string} message - The base58-encoded challenge message from Bags
 * @param {string} signature - The base58-encoded signature
 * @param {string} pubkey - The base58-encoded public key
 * @returns {boolean} - True if signature is valid
 */
function verifyBagsSignature(message, signature, pubkey) {
  try {
    // Decode base58 strings to bytes
    const messageBytes = bs58.decode(message);
    const sigBytes = bs58.decode(signature);
    const pubkeyBytes = bs58.decode(pubkey);

    // Verify the signature
    return nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error.message);
    return false;
  }
}

/**
 * Complete Bags auth flow by submitting the signature
 * @param {string} pubkey - The agent's public key (wallet address)
 * @param {string} signature - The base58-encoded signature
 * @returns {Promise<string>} - The API key ID (reference identifier for tracking)
 */
async function completeBagsAuth(pubkey, signature, message) {
  // Verify signature before calling Bags callback
  const isValid = verifyBagsSignature(message, signature, pubkey);
  if (!isValid) {
    throw new Error('Invalid signature');
  }

  const response = await axios.post(
    `${BAGS_API_BASE}/auth/callback`,
    { address: pubkey, signature },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.bagsApiKey
      },
      timeout: 10000
    }
  );

  // Return the API key ID (not the key itself)
  return response.data.apiKeyId;
}

module.exports = {
  initBagsAuth,
  verifyBagsSignature,
  completeBagsAuth
};
