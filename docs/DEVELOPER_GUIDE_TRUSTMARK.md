# AgentID Trust Mark — Developer Integration Guide

This guide provides technical implementation details and code examples for developers integrating AgentID trust verification into their applications.

---

## Technical Requirements

### Node.js Environment
- **Node.js 18+** (required for Ed25519 cryptographic operations)
- **Required packages:** `tweetnacl`, `bs58`

### Alternative Languages
You can use any Ed25519 library in your preferred language:
- **Python**: `pynacl` (PyNaCl)
- **Go**: `crypto/ed25519` (standard library)
- **Rust**: `ed25519-dalek`
- **Java**: `net.i2p.crypto:eddsa`

---

## Quick Start

### Installation

```bash
npm install tweetnacl bs58
```

### Generate Keypair

```javascript
const nacl = require('tweetnacl');
const bs58 = require('bs58');

// Generate a new Ed25519 keypair
const keypair = nacl.sign.keyPair();

// Encode keys as base58 strings
const pubkey = bs58.encode(keypair.publicKey);
const privkey = bs58.encode(keypair.secretKey);

console.log('Public Key:', pubkey);
console.log('Private Key:', privkey);
```

---

## Step-by-Step Implementation

### Step 1: Register Agent Programmatically

The registration process involves:
1. Generating a unique nonce (UUID v4)
2. Constructing a message with the format: `AGENTID-REGISTER:{name}:{nonce}:{timestamp}`
3. Encoding the message as bytes, then base58
4. Signing the message bytes with your private key
5. Encoding the signature as base58
6. POSTing to `/register` with all required fields
7. Extracting and saving the `agentId` from the response

```javascript
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const crypto = require('crypto');

/**
 * Register a new agent with AgentID
 * @param {string} pubkey - Base58-encoded public key
 * @param {Uint8Array} secretKey - Raw secret key bytes (from nacl.sign.keyPair())
 * @param {Object} agentData - Agent metadata
 * @returns {Promise<string>} - The agentId (UUID)
 */
async function registerAgent(pubkey, secretKey, agentData) {
  // Generate unique nonce and timestamp
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  
  // Construct the message to sign
  const messagePlain = `AGENTID-REGISTER:${agentData.name}:${nonce}:${timestamp}`;
  
  // Convert message to bytes and encode as base58
  const messageBytes = Buffer.from(messagePlain, 'utf8');
  const message = bs58.encode(messageBytes);
  
  // Sign the message bytes (not the base58 string!)
  const sigBytes = nacl.sign.detached(messageBytes, secretKey);
  const signature = bs58.encode(Buffer.from(sigBytes));

  // Send registration request
  const response = await fetch('https://agentid.provenanceai.network/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      signature,
      message,
      nonce,
      name: agentData.name,
      description: agentData.description,
      capabilities: agentData.capabilities,
      xHandle: agentData.xHandle,
      wallet: agentData.wallet
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Registration failed: ${error.error || response.statusText}`);
  }
  
  const data = await response.json();
  
  // CRITICAL: Save this agentId — you'll need it for all future operations
  console.log('Agent registered successfully!');
  console.log('Agent ID:', data.agentId);
  
  return data.agentId;
}

// Example usage:
async function main() {
  // Generate keypair
  const keypair = nacl.sign.keyPair();
  const pubkey = bs58.encode(keypair.publicKey);
  
  // Register agent
  const agentId = await registerAgent(pubkey, keypair.secretKey, {
    name: 'MyTradingBot',
    description: 'An AI agent for automated trading',
    capabilities: ['trading', 'analysis', 'notifications'],
    xHandle: '@mybot',
    wallet: '7xKXtg5CwXJHkjXzZW7nTFjKfZJxYfJQFjKxJzQjZJxQ'
  });
  
  // Save agentId securely — you'll need it for verification and badge display
  console.log('Save this Agent ID:', agentId);
}
```

**Important Notes:**
- The `message` field must be base58-encoded
- The `signature` field must be base58-encoded
- The backend decodes both using `bs58.decode()` before verification
- The agentId returned is a UUID v4 string — save it!

---

### Step 2: Verify Agent (PKI Challenge-Response)

Verification proves you control the private key. The flow:
1. POST to `/verify/challenge` with your `agentId`
2. Receive a `challenge` string and `nonce`
3. Base58-decode the challenge to get raw bytes
4. Sign the decoded challenge bytes with your private key
5. Base58-encode the signature
6. POST to `/verify/response` with `agentId`, `nonce`, and `signature`
7. On success, your agent status changes to "verified"

```javascript
/**
 * Verify an agent using PKI challenge-response
 * @param {string} agentId - The agent's UUID
 * @param {Uint8Array} secretKey - Raw secret key bytes
 * @returns {Promise<Object>} - Verification result
 */
async function verifyAgent(agentId, secretKey) {
  // Step 1: Request a challenge
  const chalRes = await fetch('https://agentid.provenanceai.network/verify/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId })
  });
  
  if (!chalRes.ok) {
    const error = await chalRes.json();
    throw new Error(`Challenge request failed: ${error.error || chalRes.statusText}`);
  }
  
  const { challenge, nonce } = await chalRes.json();
  console.log('Challenge received:', challenge.substring(0, 20) + '...');

  // Step 2: Sign the challenge
  // CRITICAL: Decode the base58 challenge first, then sign the raw bytes
  const challengeBytes = bs58.decode(challenge);
  const sigBytes = nacl.sign.detached(challengeBytes, secretKey);
  const signature = bs58.encode(Buffer.from(sigBytes));

  // Step 3: Submit verification response
  const verifyRes = await fetch('https://agentid.provenanceai.network/verify/response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, nonce, signature })
  });
  
  if (!verifyRes.ok) {
    const error = await verifyRes.json();
    throw new Error(`Verification failed: ${error.error || verifyRes.statusText}`);
  }
  
  const result = await verifyRes.json();
  console.log('Verification successful:', result);
  
  return result;
}

// Example usage:
async function main() {
  const agentId = '550e8400-e29b-41d4-a716-446655440000'; // Your saved agentId
  const secretKey = /* load your secret key */;
  
  await verifyAgent(agentId, secretKey);
}
```

**Critical Implementation Detail:**
The challenge from the server is base58-encoded. You **must** decode it (`bs58.decode(challenge)`) before signing. Signing the base58 string directly will result in an invalid signature.

---

### Step 3: Display Trust Mark

#### Option A: Embed Widget (iframe)

The widget provides a rich, interactive display that auto-refreshes:

```html
<iframe 
  src="https://agentid.provenanceai.network/widget/{agentId}" 
  width="400" 
  height="300" 
  frameborder="0" 
  style="border-radius: 12px; overflow: hidden;" 
  title="AgentID Trust Badge">
</iframe>
```

**Features:**
- Auto-refreshes every 60 seconds
- Displays agent name, trust score, verification status
- Shows capabilities as tags
- Responsive design
- Links to full agent profile

#### Option B: SVG Badge (for README/docs)

Static image perfect for documentation:

```markdown
![Trust Badge](https://agentid.provenanceai.network/badge/{agentId}/svg)
```

**In HTML:**
```html
<img 
  src="https://agentid.provenanceai.network/badge/{agentId}/svg" 
  alt="AgentID Trust Badge"
  width="340"
  height="80" />
```

**Features:**
- 340x80 pixel static image
- Shows agent name, tier, and trust score
- Caches for 5 minutes
- Works anywhere images are supported

#### Option C: JSON API (custom display)

For custom integrations, fetch the badge data as JSON:

```javascript
/**
 * Fetch badge data for an agent
 * @param {string} agentId - The agent's UUID
 * @returns {Promise<Object>} - Badge data
 */
async function getBadge(agentId) {
  const res = await fetch(`https://agentid.provenanceai.network/badge/${agentId}`);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch badge: ${res.statusText}`);
  }
  
  return await res.json();
  // Returns: { status, badge, label, tier, score, capabilities, widgetUrl, ... }
}

// Example usage:
async function displayCustomBadge(agentId) {
  const data = await getBadge(agentId);
  
  console.log('Agent Name:', data.name);
  console.log('Trust Score:', data.score);
  console.log('Tier:', data.tier);
  console.log('Status:', data.verificationStatus);
  console.log('Capabilities:', data.capabilities);
  
  // Build your own UI using this data
}
```

#### Option D: JavaScript Dynamic Embed

Programmatically embed the widget:

```javascript
/**
 * Embed an AgentID widget into a container
 * @param {string} containerId - ID of the container element
 * @param {string} agentId - The agent's UUID
 * @param {Object} options - Optional configuration
 */
function embedAgentIDWidget(containerId, agentId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }
  
  const iframe = document.createElement('iframe');
  iframe.src = `https://agentid.provenanceai.network/widget/${agentId}`;
  iframe.width = options.width || '100%';
  iframe.height = options.height || '320';
  iframe.frameBorder = '0';
  iframe.style.border = 'none';
  iframe.style.borderRadius = options.borderRadius || '12px';
  iframe.title = options.title || 'AgentID Trust Badge';
  
  container.appendChild(iframe);
  
  return iframe;
}

// Example usage:
embedAgentIDWidget('badge-container', '550e8400-e29b-41d4-a716-446655440000', {
  width: '400',
  height: '300',
  borderRadius: '8px'
});
```

---

## API Reference Summary

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| POST | `/register` | No | 20/15min | Register a new agent |
| POST | `/verify/challenge` | No | 20/15min | Request verification challenge |
| POST | `/verify/response` | No | 20/15min | Submit signed verification response |
| GET | `/badge/{agentId}` | No | 100/min | Get badge data as JSON |
| GET | `/badge/{agentId}/svg` | No | 100/min | Get badge as SVG image |
| GET | `/widget/{agentId}` | No | 100/min | Get interactive widget HTML |
| GET | `/agents/{agentId}` | No | 100/min | Get full agent details |
| GET | `/agents` | No | 100/min | List all registered agents |

---

## Badge JSON Response Schema

```typescript
interface BadgeResponse {
  // Response status
  status: 'success' | 'error';
  
  // Agent identifier (UUID v4)
  agentId: string;
  
  // Agent display name
  name: string;
  
  // Badge text (e.g., "VERIFIED", "TRUSTED")
  badge: string;
  
  // Badge label (e.g., "Gold", "Blue")
  label: string;
  
  // Tier classification
  tier: 'gold' | 'blue';
  
  // Trust score (0-100)
  score: number;
  
  // List of agent capabilities
  capabilities: string[];
  
  // Verification status
  verificationStatus: 'verified' | 'unverified';
  
  // URL to embeddable widget
  widgetUrl: string;
  
  // URL to SVG badge
  svgUrl: string;
  
  // Timestamp of registration
  createdAt: string;
  
  // Timestamp of last update
  updatedAt: string;
}
```

**Example Response:**
```json
{
  "status": "success",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "TradeBot Pro",
  "badge": "VERIFIED",
  "label": "Gold",
  "tier": "gold",
  "score": 75,
  "capabilities": ["trading", "analysis", "notifications"],
  "verificationStatus": "verified",
  "widgetUrl": "https://agentid.provenanceai.network/widget/550e8400-e29b-41d4-a716-446655440000",
  "svgUrl": "https://agentid.provenanceai.network/badge/550e8400-e29b-41d4-a716-446655440000/svg",
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-20T14:45:00Z"
}
```

---

## Reputation Scoring System

The trust score (0-100) is calculated from five weighted factors:

### Factor Breakdown

| Factor | Weight | Max Points | Data Source | Calculation |
|--------|--------|------------|-------------|-------------|
| **Fee Activity** | 30% | 30 pts | On-chain transactions | Based on transaction volume and fees paid |
| **Success Rate** | 25% | 25 pts | Action logs | `successful_actions / total_actions * 25` |
| **Registration Age** | 20% | 20 pts | Registration timestamp | `min(days_since_registration, 20)` |
| **SAID Trust** | 15% | 15 pts | SAID Protocol API | Cross-chain reputation score |
| **Community** | 10% | 10 pts | User flags | `10 - (flag_count * penalty_per_flag)` |

### Score Tiers

| Tier | Score Range | Badge | Description |
|------|-------------|-------|-------------|
| Gold | 70-100 | Gold "VERIFIED" | Highly trusted, established agent |
| Blue | 0-69 | Blue "TRUSTED" | Newer agent or building reputation |

### New Agent Starting Score

New agents start with **10/100** points:
- Registration Age: 0 pts (day 0)
- Community: 10 pts (no flags yet)
- Other factors: 0 pts (no activity yet)

The score increases naturally as the agent accumulates activity and age.

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Missing required fields, invalid format |
| 401 | Unauthorized | Invalid signature, challenge expired |
| 404 | Not Found | Agent not found, invalid agentId |
| 409 | Conflict | Agent already registered, duplicate name+pubkey |
| 429 | Rate Limited | Too many requests, wait 15 minutes |
| 500 | Server Error | Internal server error, try again later |

### Common Error Scenarios

#### 400 "Message must contain the nonce"
**Cause:** The decoded message doesn't include the expected nonce.
**Solution:** Ensure your message format is exactly: `AGENTID-REGISTER:{name}:{nonce}:{timestamp}`

#### 401 "Invalid signature"
**Cause:** The signature doesn't match the message or wrong private key used.
**Solution:** 
- Verify you're using the correct private key
- Ensure you're signing the raw bytes, not the base58 string
- Check that both message and signature are base58-encoded in the request

#### 401 "Challenge has expired"
**Cause:** More than 5 minutes elapsed between requesting and submitting challenge.
**Solution:** Request a new challenge and complete verification within 5 minutes.

#### 404 "Agent not found"
**Cause:** The agentId doesn't exist in the database.
**Solution:** 
- Verify the agentId is correct (UUID format)
- Check that registration completed successfully
- The agentId is returned in the registration response

#### 409 "Already registered"
**Cause:** A combination of this pubkey + name already exists.
**Solution:** Use a different name or check if you've already registered this agent.

#### 429 "Rate limit exceeded"
**Cause:** Too many registration/verification attempts.
**Solution:** Wait 15 minutes before trying again.

---

## Troubleshooting

### "My signature is invalid"

**Checklist:**
1. Are you base58-encoding both the message AND signature before sending?
2. Are you signing the raw bytes (not the base58 string)?
3. Is your message format exactly: `AGENTID-REGISTER:{name}:{nonce}:{timestamp}`?
4. Are you using the correct private key that matches your public key?

**Debug code:**
```javascript
// Verify your signature locally before sending
const messageBytes = Buffer.from(messagePlain, 'utf8');
const sigBytes = bs58.decode(signature);
const pubkeyBytes = bs58.decode(pubkey);

const isValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
console.log('Local verification:', isValid); // Should be true
```

### "Challenge expired"

The 5-minute timer starts when you request the challenge, not when you start signing. If your signing process is slow or you get distracted, request a fresh challenge.

### "Agent not found on badge"

- Did you save the agentId from the registration response?
- Is the agentId in the correct UUID format?
- Did registration actually succeed? Check for error responses.

### "Widget shows UNVERIFIED"

You need to complete the verification flow (Step 2). Registration alone doesn't verify key ownership — you must complete the challenge-response flow.

### "Score is 10/100"

This is normal for new agents! The score grows over time:
- Registration Age: +1 point per day (max 20)
- Fee Activity: Increases with on-chain usage
- Success Rate: Improves as your agent operates successfully

### "Invalid Solana address"

The pubkey must be:
- 32-88 characters long
- Valid base58 encoding
- A valid Ed25519 public key

---

## Python Example

Complete Python implementation using PyNaCl:

```python
import nacl.signing
import nacl.encoding
import base58
import requests
import uuid
import time

# Generate keypair
signing_key = nacl.signing.SigningKey.generate()
verify_key = signing_key.verify_key
pubkey = base58.b58encode(verify_key.encode()).decode()

print(f"Public Key: {pubkey}")

# Prepare registration data
nonce = str(uuid.uuid4())
timestamp = int(time.time() * 1000)
message_plain = f"AGENTID-REGISTER:MyAgent:{nonce}:{timestamp}"

# Sign the message
message_bytes = message_plain.encode('utf-8')
signed = signing_key.sign(message_bytes)
signature = base58.b58encode(signed.signature).decode()
message = base58.b58encode(message_bytes).decode()

# Register agent
response = requests.post(
    'https://agentid.provenanceai.network/register',
    json={
        'pubkey': pubkey,
        'name': 'MyAgent',
        'description': 'My AI agent description',
        'capabilities': ['trading', 'analysis'],
        'signature': signature,
        'message': message,
        'nonce': nonce
    }
)

if response.status_code == 200:
    data = response.json()
    agent_id = data['agentId']
    print(f"Agent registered! ID: {agent_id}")
else:
    print(f"Registration failed: {response.text}")

# Verification challenge-response
def verify_agent(agent_id, signing_key):
    # Request challenge
    chal_res = requests.post(
        'https://agentid.provenanceai.network/verify/challenge',
        json={'agentId': agent_id}
    )
    chal_data = chal_res.json()
    challenge = chal_data['challenge']
    nonce = chal_data['nonce']
    
    # Sign challenge (decode base58 first!)
    challenge_bytes = base58.b58decode(challenge)
    signed = signing_key.sign(challenge_bytes)
    signature = base58.b58encode(signed.signature).decode()
    
    # Submit verification
    verify_res = requests.post(
        'https://agentid.provenanceai.network/verify/response',
        json={
            'agentId': agent_id,
            'nonce': nonce,
            'signature': signature
        }
    )
    
    return verify_res.json()

# Verify the agent
# result = verify_agent(agent_id, signing_key)
# print(result)
```

---

## Full End-to-End Example

Complete runnable Node.js script that performs all steps:

```javascript
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const crypto = require('crypto');

const BASE_URL = 'https://agentid.provenanceai.network';

async function main() {
  console.log('=== AgentID End-to-End Example ===\n');
  
  // Step 1: Generate Keypair
  console.log('Step 1: Generating Ed25519 keypair...');
  const keypair = nacl.sign.keyPair();
  const pubkey = bs58.encode(keypair.publicKey);
  console.log(`Public Key: ${pubkey.substring(0, 20)}...`);
  console.log(`Private Key: ${bs58.encode(keypair.secretKey).substring(0, 20)}... (SAVE THIS!)\n`);
  
  // Step 2: Register Agent
  console.log('Step 2: Registering agent...');
  const agentId = await registerAgent(pubkey, keypair.secretKey, {
    name: `DemoAgent-${Date.now()}`,
    description: 'A demo agent for testing',
    capabilities: ['demo', 'testing']
  });
  console.log(`Agent registered with ID: ${agentId}\n`);
  
  // Step 3: Verify Agent
  console.log('Step 3: Verifying agent...');
  await verifyAgent(agentId, keypair.secretKey);
  console.log('Agent verified successfully!\n');
  
  // Step 4: Fetch Badge
  console.log('Step 4: Fetching badge data...');
  const badge = await getBadge(agentId);
  console.log('Badge Data:');
  console.log(`  Name: ${badge.name}`);
  console.log(`  Score: ${badge.score}/100`);
  console.log(`  Tier: ${badge.tier}`);
  console.log(`  Status: ${badge.verificationStatus}`);
  console.log(`  Widget URL: ${badge.widgetUrl}`);
  console.log(`  SVG URL: ${badge.svgUrl}\n`);
  
  console.log('=== All steps completed successfully! ===');
}

async function registerAgent(pubkey, secretKey, agentData) {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const messagePlain = `AGENTID-REGISTER:${agentData.name}:${nonce}:${timestamp}`;
  const messageBytes = Buffer.from(messagePlain, 'utf8');
  const sigBytes = nacl.sign.detached(messageBytes, secretKey);
  
  const response = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      name: agentData.name,
      description: agentData.description,
      capabilities: agentData.capabilities,
      signature: bs58.encode(Buffer.from(sigBytes)),
      message: bs58.encode(messageBytes),
      nonce
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Registration failed: ${error.error}`);
  }
  
  const data = await response.json();
  return data.agentId;
}

async function verifyAgent(agentId, secretKey) {
  // Get challenge
  const chalRes = await fetch(`${BASE_URL}/verify/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId })
  });
  
  const { challenge, nonce } = await chalRes.json();
  
  // Sign challenge (decode base58 first!)
  const challengeBytes = bs58.decode(challenge);
  const sigBytes = nacl.sign.detached(challengeBytes, secretKey);
  
  // Submit verification
  const verifyRes = await fetch(`${BASE_URL}/verify/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      nonce,
      signature: bs58.encode(Buffer.from(sigBytes))
    })
  });
  
  if (!verifyRes.ok) {
    const error = await verifyRes.json();
    throw new Error(`Verification failed: ${error.error}`);
  }
  
  return await verifyRes.json();
}

async function getBadge(agentId) {
  const res = await fetch(`${BASE_URL}/badge/${agentId}`);
  return await res.json();
}

// Run the example
main().catch(console.error);
```

To run this example:
```bash
npm install tweetnacl bs58
node example.js
```

---

## Additional Resources

- **Demo Page**: https://agentid.provenanceai.network/demo
- **Agent Registry**: https://agentid.provenanceai.network/registry
- **API Documentation**: See `docs/API_REFERENCE.md`
- **Widget Guide**: See `docs/WIDGET_GUIDE.md`

---

**Need help?** Check the troubleshooting section above or review the Agent Owner Guide for non-technical guidance.
