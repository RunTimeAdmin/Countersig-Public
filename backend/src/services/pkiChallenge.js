/**
 * PKI Challenge Service
 * Ed25519 challenge-response for ongoing verification
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { createVerification, getVerification, completeVerification, updateLastVerified } = require('../models/queries.js');
const { challengeStore } = require('../models/challengeStore.js');
const config = require('../config/index.js');

/**
 * Issue a new challenge for an agent
 * @param {string} agentId - Agent UUID
 * @param {string} pubkey - Agent public key
 * @returns {Promise<{nonce: string, challenge: string, expiresIn: number}>} - Challenge data
 */
async function issueChallenge(agentId, pubkey) {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const challengeString = `AGENTID-VERIFY:${agentId}:${pubkey}:${nonce}:${timestamp}`;

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + config.challengeExpirySeconds * 1000);

  // Encode challenge as base58 (same format returned to client and signed)
  const challengeBase58 = bs58.encode(Buffer.from(challengeString));

  // Store in database
  await createVerification({
    agentId,
    pubkey,
    nonce,
    challenge: challengeBase58,
    expiresAt
  });

  // Return base58-encoded challenge
  return {
    nonce,
    challenge: challengeBase58,
    expiresIn: config.challengeExpirySeconds
  };
}

/**
 * Check if a nonce has been used (for replay prevention)
 * @param {string} nonce - Challenge nonce
 * @returns {Promise<boolean>} - True if nonce has been used
 */
async function isNonceUsed(nonce) {
  return challengeStore.isNonceUsed(nonce);
}

/**
 * Verify a challenge response
 * @param {string} agentId - Agent UUID
 * @param {string} pubkey - Agent public key
 * @param {string} nonce - Challenge nonce
 * @param {string} signature - Base58-encoded signature
 * @returns {Promise<{verified: boolean, agentId: string, pubkey: string, timestamp: number}>} - Verification result
 * @throws {Error} - If challenge not found, expired, or signature invalid
 */
async function verifyChallenge(agentId, pubkey, nonce, signature) {
  // Fetch verification record
  const verification = await getVerification(agentId, nonce);
  
  // Check if challenge exists
  if (!verification) {
    throw new Error('Challenge not found or already completed');
  }
  
  // Check if challenge is expired
  const now = new Date();
  const expiresAt = new Date(verification.expires_at);
  if (now > expiresAt) {
    throw new Error('Challenge has expired');
  }
  
  // Decode inputs
  let sigBytes;
  let pubkeyBytes;
  let messageBytes;
  
  try {
    sigBytes = bs58.decode(signature);
    pubkeyBytes = bs58.decode(pubkey);
    messageBytes = bs58.decode(verification.challenge);
  } catch (error) {
    throw new Error(`Invalid encoding: ${error.message}`);
  }
  
  // Verify Ed25519 signature
  const isValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
  
  if (!isValid) {
    throw new Error('Invalid signature');
  }
  
  // Mark challenge as completed in database
  await completeVerification(nonce);

  // Mark nonce as used in ChallengeStore to prevent replay
  await challengeStore.markNonceUsed(nonce, config.challengeExpirySeconds);

  // Delete challenge from store to prevent reuse
  await challengeStore.deleteChallenge(`challenge:${agentId}:${nonce}`);

  // Update last verified timestamp
  await updateLastVerified(agentId);

  return {
    verified: true,
    agentId,
    pubkey,
    timestamp: Date.now()
  };
}

module.exports = {
  issueChallenge,
  verifyChallenge,
  isNonceUsed
};
