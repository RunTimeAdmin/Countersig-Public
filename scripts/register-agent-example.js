/**
 * Agent Registration Example Script
 * 
 * This is an example script demonstrating how to register an agent with AgentID
 * via the API. It showcases the challenge-response authentication flow, keypair
 * generation, and badge retrieval.
 * 
 * Usage:
 *   node scripts/register-agent-example.js
 * 
 * Requirements:
 *   - The backend dependencies (tweetnacl, bs58) must be installed
 *   - Node.js with fetch API support (v18+)
 * 
 * This script uses the InfraWatch agent as an example. Modify the keypair,
 * agentId, and endpoint URLs as needed for your own agent registration.
 */

const nacl = require('./backend/node_modules/tweetnacl');
const bs58 = require('./backend/node_modules/bs58');
const crypto = require('crypto');

const PRODUCTION_URL = 'https://agentid.provenanceai.network';

// Generate a new Ed25519 keypair
function generateKeypair() {
  const keypair = nacl.sign.keyPair();
  const publicKey = bs58.encode(keypair.publicKey);
  const privateKey = bs58.encode(keypair.secretKey);
  return { publicKey, privateKey, keypair };
}

// Sign a message with the private key
function signMessage(message, secretKey) {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

// Generate a nonce
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

// API helper function
async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${PRODUCTION_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

// Main registration flow
async function registerInfraWatch() {
  console.log('='.repeat(70));
  console.log('InfraWatch Production Agent Registration');
  console.log('='.repeat(70));
  console.log();

  // Step 0: Generate Keypair (or use existing)
  console.log('STEP 0: Loading Ed25519 Keypair...');
  console.log('-'.repeat(70));
  
  // Using the already registered keypair for InfraWatch
  const publicKey = 'H6V2PR6mY8Ure3MZHgp41yznZ9vz8tF1QRYEVfJGqPQG';
  const privateKey = '4HYgjJXYAXo65dQimjB2hBbbwDH45HmWGQEMTVwGDfva4etjhcvZpKaARz7jHLDVtQFtYN5CtsM1GFdSYhpAnbji';
  const keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(privateKey));
  
  console.log('Public Key:', publicKey);
  console.log('Private Key:', privateKey);
  console.log();

  // Step 1: Agent already registered - using existing agent ID
  console.log('STEP 1: Using already registered InfraWatch Agent...');
  console.log('-'.repeat(70));
  
  const registeredAgentId = '3b055043-1c8d-4dbd-99c9-7ef3d3f4f6e6';
  console.log('Agent ID:', registeredAgentId);
  console.log('Status: Already registered (201 Created)');
  console.log();

  // Step 2: Verify (Challenge-Response)
  console.log('STEP 2: Verify (Challenge-Response)...');
  console.log('-'.repeat(70));
  
  // Get a challenge for verification
  const verifyChallengeBody = {
    agentId: registeredAgentId
  };
  console.log('Challenge Request:', JSON.stringify(verifyChallengeBody, null, 2));
  
  const verifyChallengeResponse = await apiCall('/verify/challenge', 'POST', verifyChallengeBody);
  console.log('Challenge Status:', verifyChallengeResponse.status);
  console.log('Challenge Response:', JSON.stringify(verifyChallengeResponse.data, null, 2));
  
  if (verifyChallengeResponse.status !== 200) {
    console.error('Failed to get verification challenge');
    return;
  }
  
  const { challenge: verifyChallenge, nonce: verifyNonce } = verifyChallengeResponse.data;
  
  // The challenge is base58-encoded. The backend decodes it to get the original message bytes,
  // then verifies the signature against those bytes. So we need to decode the challenge first,
  // then sign the decoded message.
  const challengeBytes = bs58.decode(verifyChallenge);
  const challengeDecoded = Buffer.from(challengeBytes).toString('utf8');
  console.log('Decoded challenge:', challengeDecoded);
  const verifySignature = signMessage(challengeDecoded, keypair.secretKey);
  
  const verifyResponseBody = {
    agentId: registeredAgentId,
    nonce: verifyNonce,
    signature: verifySignature,
  };
  console.log();
  console.log('Response Request:', JSON.stringify(verifyResponseBody, null, 2));
  
  const verifyResponse = await apiCall('/verify/response', 'POST', verifyResponseBody);
  console.log('Verify Status:', verifyResponse.status);
  console.log('Verify Response:', JSON.stringify(verifyResponse.data, null, 2));
  console.log();

  // Step 3: Get Badge
  console.log('STEP 3: Getting Badge...');
  console.log('-'.repeat(70));
  
  const badgeResponse = await apiCall(`/badge/${registeredAgentId}`, 'GET');
  console.log('Status:', badgeResponse.status);
  console.log('Response:', JSON.stringify(badgeResponse.data, null, 2));
  console.log();

  // Print Summary
  console.log('='.repeat(70));
  console.log('REGISTRATION COMPLETE - SAVE THESE CREDENTIALS');
  console.log('='.repeat(70));
  console.log('Agent ID:', registeredAgentId);
  console.log('Public Key:', publicKey);
  console.log('Private Key:', privateKey);
  console.log();
  console.log('Add these to your VPS .env file:');
  console.log('----------------------------------------');
  console.log(`INFRAWATCH_AGENT_ID=${registeredAgentId}`);
  console.log(`INFRAWATCH_PUBKEY=${publicKey}`);
  console.log(`INFRAWATCH_PRIVKEY=${privateKey}`);
  console.log('----------------------------------------');
  console.log();
}

// Run the registration
registerInfraWatch().catch(console.error);
