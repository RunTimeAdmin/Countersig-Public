// Test script to verify registration and challenge flow
const axios = require('axios');

const API_BASE = 'http://localhost:3002';

// Generate a valid base58-encoded Solana-like public key (32 bytes)
function generatePubkey() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function testFlow() {
  try {
    const pubkey = generatePubkey();
    console.log('Testing with pubkey:', pubkey);
    
    // Step 1: Register
    const registerData = {
      pubkey: pubkey,
      name: 'Test Agent ' + Date.now(),
      description: 'Test agent for debugging',
      capabilities: ['test'],
      categories: ['test'],
      signature: 'test-signature-base58',
      message: 'test-message-base58',
      nonce: 'test-nonce-123'
    };
    
    console.log('\n1. Registering agent...');
    console.log('Request:', JSON.stringify(registerData, null, 2));
    
    try {
      const registerRes = await axios.post(`${API_BASE}/register`, registerData);
      console.log('\nRegistration Response:');
      console.log(JSON.stringify(registerRes.data, null, 2));
      
      // Extract agentId
      const response = registerRes.data;
      const agentId = response.agent?.agentId || response.agent_id || response.agentId || response.id;
      console.log('\nExtracted agentId:', agentId);
      
      if (!agentId) {
        console.error('ERROR: Could not extract agentId from response!');
        return;
      }
      
      // Step 2: Request Challenge
      console.log('\n2. Requesting challenge...');
      console.log('Sending agentId:', agentId);
      
      const challengeRes = await axios.post(`${API_BASE}/verify/challenge`, { agentId });
      console.log('\nChallenge Response:');
      console.log(JSON.stringify(challengeRes.data, null, 2));
      
    } catch (err) {
      if (err.response) {
        console.error('API Error:', err.response.status, err.response.data);
      } else {
        console.error('Error:', err.message);
      }
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testFlow();
