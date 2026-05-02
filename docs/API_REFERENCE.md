# Countersig API Reference

**Version:** 2.0.0  
**Base URL:** `https://countersig.com` (configurable via `COUNTERSIG_BASE_URL`)  
**Author:** David Cooper (CCIE #14019)

---

## Authentication Model

Countersig employs an **Ed25519 signature-based authentication model** for all state-modifying operations. This cryptographic approach ensures non-repudiation and eliminates the need for shared secrets or API tokens.

### Challenge-Response Pattern

The authentication flow follows a challenge-response pattern:

1. **Client requests a challenge** by providing their public key
2. **Server issues a challenge** containing a unique nonce and timestamp
3. **Client signs the challenge** using their Ed25519 private key
4. **Server verifies the signature** against the stored public key

### Message Format

Challenge messages follow this exact format:

```
COUNTERSIG-VERIFY:{pubkey}:{nonce}:{timestamp}
```

Where:
- `pubkey` - Base58-encoded Ed25519 public key (32 bytes)
- `nonce` - UUID v4 string for replay protection
- `timestamp` - Unix timestamp in milliseconds

### Signature Creation

```javascript
const nacl = require('tweetnacl');
const bs58 = require('bs58');

// Message to sign
const message = `COUNTERSIG-VERIFY:${pubkey}:${nonce}:${timestamp}`;
const messageBytes = Buffer.from(message, 'utf-8');

// Sign with private key
const signatureBytes = nacl.sign.detached(messageBytes, privateKeyBytes);
const signature = bs58.encode(signatureBytes);
```

### Nonce Lifecycle

- **Issuance:** Challenges are issued via `POST /verify/challenge`
- **Expiration:** Default expiry is 300 seconds (5 minutes), configurable via `CHALLENGE_EXPIRY_SECONDS`
- **Single-use:** Each nonce can only be used once; completed challenges are marked in the database
- **Replay protection:** Timestamps must be within 5 minutes of server time (with 1-minute clock skew tolerance)

---

## Rate Limiting

Countersig implements tiered rate limiting to protect API availability while accommodating different use cases.

### Rate Limit Tiers

| Tier | Endpoints | Limit | Window |
|------|-----------|-------|--------|
| **General** | All API endpoints (default) | 100 requests | 1 minute |
| **Auth** | Authentication (login, OAuth, refresh) | 10 requests | 1 minute |
| **Registration** | Agent registration | 5 requests | 1 minute |

### Rate Limit Headers

All responses include standard rate limit headers:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 1699999999
```

> **Note:** The `RateLimit-Limit` value varies by tier (100 for general, 10 for auth, 5 for registration).

### Exceeded Limit Response

```json
{
  "error": "Too many requests, please try again later.",
  "status": 429
}
```

---

## Error Handling

### Standard Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "pubkey": "optional-public-key-context"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Missing/invalid parameters, validation failure |
| 401 | Unauthorized | Invalid signature, expired challenge, timestamp too old |
| 404 | Not Found | Agent or challenge not found |
| 409 | Conflict | Agent already registered |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Common Error Codes by Endpoint

- **Invalid Solana Address:** Returns 400 with `"Invalid Solana public key format"`
- **Agent Not Found:** Returns 404 with `"Agent not found"`
- **Invalid Signature:** Returns 401 with `"Invalid signature"`
- **Challenge Expired:** Returns 401 with `"Challenge has expired"`
- **Rate Limited:** Returns 429 with retry information in headers

---

## Reputation Scoring

The Countersig reputation system computes a **Reputation Score (0-100)** using a weighted 5-factor model. This score determines trust labels and badge status.

### 5-Factor Model

| Factor | Weight | Max Points | Description |
|--------|--------|------------|-------------|
| **Fee Activity** | 30% | 30 pts | Trading fee generation on Bags.fm (1 pt per 0.1 SOL) |
| **Success Rate** | 25% | 25 pts | Ratio of successful to total actions |
| **Registration Age** | 20% | 20 pts | Days since registration (1 pt per day, max 20) |
| **SAID Trust Score** | 15% | 15 pts | External trust verification from SAID Identity Gateway |
| **Community Verification** | 10% | 10 pts | Penalty for unresolved flags (10=none, 5=one, 0=two+) |

### Score Calculation

```javascript
// Fee Activity: min(30, floor(totalFeesSOL * 10))
// Success Rate: floor((successful / total) * 25)
// Age: min(20, daysSinceRegistration)
// SAID Trust: floor((saidScore / 100) * 15)
// Community: 10 if 0 flags, 5 if 1 flag, 0 if 2+ flags

const totalScore = feeActivity + successRate + age + saidTrust + community;
```

### Trust Labels

| Score Range | Label | Description |
|-------------|-------|-------------|
| 80-100 | HIGH | Highly trusted agent with strong activity history |
| 60-79 | MEDIUM | Moderately trusted agent with established presence |
| 40-59 | LOW | New or limited-activity agent |
| 0-39 | UNVERIFIED | Insufficient data or flagged concerns |

### Auto-Flagging

Agents with **3 or more unresolved flags** are automatically marked with `status: 'flagged'`, regardless of score.

---

## Endpoints

### Registration & Identity (v1 — backward compatible)

---

#### POST /register

Register a new agent with Bags authentication and SAID binding.

**Rate Limit:** Registration tier (5 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `credential_type` | string | No | `crypto` (default), `oauth2`, or `entra_id` |
| `pubkey` | string | Yes* | 32-130 characters, valid public key (crypto only) |
| `name` | string | Yes | 1-255 characters |
| `signature` | string | Yes* | Base58-encoded Ed25519 signature (crypto only) |
| `message` | string | Yes* | Must contain the nonce (crypto only) |
| `nonce` | string | Yes* | Challenge nonce (crypto only) |
| `token` | string | Yes* | External OAuth2/OIDC JWT (oauth2/entra_id only) |
| `chainType` | string | No | `solana-bags`, `solana`, `ethereum`, `base`, `polygon` |
| `tokenMint` | string | No | Token mint address for fee tracking |
| `capabilities` | string[] | No | Array of capability strings |
| `creatorX` | string | No | Creator's X/Twitter handle |
| `creatorWallet` | string | No | Creator's wallet address |
| `description` | string | No | Agent description |

> **Note:** For `crypto` (default), `pubkey`, `signature`, `message`, and `nonce` are required. For `oauth2` or `entra_id`, `token` is required instead of `signature`/`pubkey`.

**Response Body (201 Created):**
```json
{
  "agent": {
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "name": "My Trading Agent",
    "description": "Automated trading bot",
    "tokenMint": "TokenMint1111111111111111111111111111111111",
    "capabilities": ["trading", "analytics"],
    "creatorX": "@creator",
    "creatorWallet": "CreatorWallet1111111111111111111111111111111",
    "status": "active",
    "bagsScore": 0,
    "totalActions": 0,
    "successfulActions": 0,
    "failedActions": 0,
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "lastVerified": null
  },
  "said": {
    "registered": true,
    "data": { /* SAID response */ }
  }
}
```

**Error Responses:**
- `400` - Missing/invalid fields, invalid public key, unsupported credential type
- `401` - Invalid signature or external token validation failed
- `409` - Agent already registered

**Example Request:**
```bash
curl -X POST https://countersig.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "name": "My Trading Agent",
    "signature": "Base58Signature...",
    "message": "Auth message containing nonce",
    "nonce": "550e8400-e29b-41d4-a716-446655440000",
    "capabilities": ["trading", "analytics"],
    "creatorX": "@tradingbot"
  }'
```

---

#### PUT /agents/:pubkey/update

Update agent metadata with signature verification.

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `signature` | string | Yes | Base58-encoded Ed25519 signature |
| `timestamp` | number | Yes | Unix timestamp in milliseconds |
| `name` | string | No | 1-255 characters |
| `tokenMint` | string | No | Token mint address |
| `capabilities` | string[] | No | Array of capability strings |
| `creatorX` | string | No | Creator's X/Twitter handle |
| `description` | string | No | Agent description |

**Signature Message Format:**
```
COUNTERSIG-UPDATE:{pubkey}:{timestamp}
```

**Response Body (200 OK):**
```json
{
  "agent": {
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "name": "Updated Agent Name",
    "description": "Updated description",
    "tokenMint": "TokenMint1111111111111111111111111111111111",
    "capabilities": ["trading", "analytics", "reporting"],
    "creatorX": "@newhandle",
    "status": "active",
    "bagsScore": 45,
    "totalActions": 10,
    "successfulActions": 9,
    "failedActions": 1,
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "lastVerified": "2024-01-20T14:22:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid fields, no valid fields to update, timestamp too old/future
- `401` - Invalid signature, timestamp outside 5-minute window
- `404` - Agent not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/agents/AgentPubkey111111111111111111111111111111111/update \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "Base58Signature...",
    "timestamp": 1705753200000,
    "name": "Updated Agent Name",
    "capabilities": ["trading", "analytics", "reporting"]
  }'
```

---

### Verification (PKI Challenge-Response) (v1 — backward compatible)

---

#### POST /verify/challenge

Issue a PKI challenge for agent verification.

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `pubkey` | string | Yes | Valid Solana address |

**Response Body (200 OK):**
```json
{
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "challenge": "8n3kQm9XvB2pL5rT...", 
  "expiresIn": 300
}
```

| Field | Type | Description |
|-------|------|-------------|
| `nonce` | string | UUID v4 challenge identifier |
| `challenge` | string | Base58-encoded challenge message |
| `expiresIn` | number | Seconds until expiration |

**Error Responses:**
- `400` - Invalid agent ID, or agent uses non-crypto credential type (does not require PKI verification)
- `404` - Agent not found

**Example Request:**
```bash
curl -X POST https://countersig.com/verify/challenge \
  -H "Content-Type: application/json" \
  -d '{"pubkey": "AgentPubkey111111111111111111111111111111111"}'
```

---

#### POST /verify/response

Verify a signed challenge response.

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pubkey` | string | Yes | Agent's public key |
| `nonce` | string | Yes | Challenge nonce from `/verify/challenge` |
| `signature` | string | Yes | Base58-encoded Ed25519 signature |

**Response Body (200 OK):**
```json
{
  "verified": true,
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "timestamp": 1705753200000
}
```

**Error Responses:**
- `400` - Missing/invalid fields, or agent uses non-crypto credential type (does not require PKI verification)
- `401` - Challenge expired or invalid signature
- `404` - Challenge not found or already completed

**Example Request:**
```bash
curl -X POST https://countersig.com/verify/response \
  -H "Content-Type: application/json" \
  -d '{
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "nonce": "550e8400-e29b-41d4-a716-446655440000",
    "signature": "Base58Signature..."
  }'
```

---

### Trust & Reputation (v1 — backward compatible)

---

#### GET /badge/:pubkey

Retrieve trust badge data as JSON.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response Body (200 OK):**
```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "name": "My Trading Agent",
  "status": "verified",
  "badge": "✅",
  "label": "VERIFIED AGENT",
  "score": 75,
  "bags_score": 75,
  "saidTrustScore": 85,
  "saidLabel": "HIGH",
  "registeredAt": "2024-01-15T10:30:00.000Z",
  "lastVerified": "2024-01-20T14:22:00.000Z",
  "totalActions": 150,
  "successRate": 0.94,
  "capabilities": ["trading", "analytics"],
  "tokenMint": "TokenMint1111111111111111111111111111111111",
  "widgetUrl": "https://countersig.com/widget/AgentPubkey111111111111111111111111111111111"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `verified`, `unverified`, or `flagged` |
| `badge` | string | Emoji indicator (✅, ⚠️, 🔴) |
| `label` | string | Human-readable status label |
| `score` | number | BAGS reputation score (0-100) |
| `successRate` | number | Ratio of successful actions (0.0-1.0) |
| `widgetUrl` | string | URL for embedding the widget |

**Error Responses:**
- `404` - Agent not found

**Example Request:**
```bash
curl https://countersig.com/badge/AgentPubkey111111111111111111111111111111111
```

---

#### GET /badge/:pubkey/svg

Retrieve trust badge as an SVG image.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response:**
- **Content-Type:** `image/svg+xml`
- **Body:** SVG markup (320x80px badge)

**SVG Colors by Status:**
- **Verified:** Green theme (#22c55e)
- **Unverified:** Amber theme (#f59e0b)
- **Flagged:** Red theme (#ef4444)

**Error Responses:**
- `404` - Agent not found (returns JSON error)

**Example Request:**
```bash
curl https://countersig.com/badge/AgentPubkey111111111111111111111111111111111/svg
```

**Markdown Usage:**
```markdown
![Agent Trust Badge](https://countersig.com/badge/AgentPubkey111111111111111111111111111111111/svg)
```

---

#### GET /reputation/:pubkey

Retrieve full reputation breakdown with 5-factor analysis.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response Body (200 OK):**
```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "score": 75,
  "label": "MEDIUM",
  "breakdown": {
    "feeActivity": {
      "score": 25,
      "max": 30
    },
    "successRate": {
      "score": 23,
      "max": 25
    },
    "age": {
      "score": 15,
      "max": 20
    },
    "saidTrust": {
      "score": 12,
      "max": 15
    },
    "community": {
      "score": 10,
      "max": 10
    }
  }
}
```

**Error Responses:**
- `404` - Agent not found

**Example Request:**
```bash
curl https://countersig.com/reputation/AgentPubkey111111111111111111111111111111111
```

---

### Agent Registry & Discovery (v1 — backward compatible)

---

#### GET /agents

List registered agents with optional filters.

**Rate Limit:** General tier (100 requests / 1 min)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (`active`, `flagged`, etc.) |
| `capability` | string | - | Filter by capability |
| `limit` | number | 50 | Results per page (max 100) |
| `offset` | number | 0 | Pagination offset |

**Response Body (200 OK):**
```json
{
  "agents": [
    {
      "pubkey": "AgentPubkey111111111111111111111111111111111",
      "name": "My Trading Agent",
      "description": "Automated trading bot",
      "tokenMint": "TokenMint1111111111111111111111111111111111",
      "capabilities": ["trading", "analytics"],
      "creatorX": "@creator",
      "creatorWallet": "CreatorWallet1111111111111111111111111111111",
      "status": "active",
      "bagsScore": 75,
      "totalActions": 150,
      "successfulActions": 141,
      "failedActions": 9,
      "registeredAt": "2024-01-15T10:30:00.000Z",
      "lastVerified": "2024-01-20T14:22:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Example Request:**
```bash
# List all agents
curl https://countersig.com/agents

# Filter by capability with pagination
curl "https://countersig.com/agents?capability=trading&limit=10&offset=0"
```

---

#### GET /agents/:pubkey

Get detailed information for a single agent including reputation.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response Body (200 OK):**
```json
{
  "agent": {
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "name": "My Trading Agent",
    "description": "Automated trading bot",
    "tokenMint": "TokenMint1111111111111111111111111111111111",
    "capabilities": ["trading", "analytics"],
    "creatorX": "@creator",
    "creatorWallet": "CreatorWallet1111111111111111111111111111111",
    "status": "active",
    "bagsScore": 75,
    "totalActions": 150,
    "successfulActions": 141,
    "failedActions": 9,
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "lastVerified": "2024-01-20T14:22:00.000Z"
  },
  "reputation": {
    "score": 75,
    "label": "MEDIUM",
    "breakdown": {
      "feeActivity": { "score": 25, "max": 30 },
      "successRate": { "score": 23, "max": 25 },
      "age": { "score": 15, "max": 20 },
      "saidTrust": { "score": 12, "max": 15 },
      "community": { "score": 10, "max": 10 }
    }
  }
}
```

**Error Responses:**
- `400` - Invalid Solana address format
- `404` - Agent not found

**Example Request:**
```bash
curl https://countersig.com/agents/AgentPubkey111111111111111111111111111111111
```

---

#### GET /discover

A2A (Agent-to-Agent) discovery - find agents by capability.

**Rate Limit:** General tier (100 requests / 1 min)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `capability` | string | Yes | Capability to search for |

**Response Body (200 OK):**
```json
{
  "agents": [
    {
      "pubkey": "AgentPubkey111111111111111111111111111111111",
      "name": "My Trading Agent",
      "description": "Automated trading bot",
      "tokenMint": "TokenMint1111111111111111111111111111111111",
      "capabilities": ["trading", "analytics"],
      "creatorX": "@creator",
      "status": "active",
      "bagsScore": 75,
      "totalActions": 150,
      "registeredAt": "2024-01-15T10:30:00.000Z",
      "lastVerified": "2024-01-20T14:22:00.000Z"
    }
  ],
  "capability": "trading",
  "count": 1
}
```

**Error Responses:**
- `400` - Missing capability parameter

**Example Request:**
```bash
curl "https://countersig.com/discover?capability=analytics"
```

---

### Attestation & Flagging (v1 — backward compatible)

---

#### POST /agents/:pubkey/attest

Record a successful or failed action for an agent.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Whether the action was successful |
| `action` | string | No | Action identifier/description |

**Response Body (200 OK):**
```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "success": true,
  "action": "execute_trade",
  "totalActions": 151,
  "successfulActions": 142,
  "failedActions": 9,
  "bagsScore": 76
}
```

**Error Responses:**
- `400` - Invalid success field (must be boolean)
- `404` - Agent not found

**Example Request:**
```bash
curl -X POST https://countersig.com/agents/AgentPubkey111111111111111111111111111111111/attest \
  -H "Content-Type: application/json" \
  -d '{
    "success": true,
    "action": "execute_trade"
  }'
```

---

#### POST /agents/:pubkey/flag

Flag suspicious behavior for an agent.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reporterPubkey` | string | Yes | Public key of the reporter |
| `reason` | string | Yes | Reason for flagging |
| `evidence` | string | No | Supporting evidence/notes |

**Response Body (201 Created):**
```json
{
  "flag": {
    "id": 1,
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "reporter_pubkey": "ReporterPubkey111111111111111111111111111111",
    "reason": "Suspicious trading pattern",
    "evidence": "Multiple failed transactions",
    "status": "pending",
    "created_at": "2024-01-20T15:30:00.000Z"
  },
  "unresolved_flags": 1,
  "auto_flagged": false
}
```

**Auto-Flagging:** When `unresolved_flags >= 3`, the agent status is automatically set to `flagged`.

**Error Responses:**
- `400` - Missing/invalid fields
- `404` - Agent not found

**Example Request:**
```bash
curl -X POST https://countersig.com/agents/AgentPubkey111111111111111111111111111111111/flag \
  -H "Content-Type: application/json" \
  -d '{
    "reporterPubkey": "ReporterPubkey111111111111111111111111111111",
    "reason": "Suspicious trading pattern",
    "evidence": "Multiple failed transactions in short timeframe"
  }'
```

---

#### GET /agents/:pubkey/attestations

Retrieve action statistics for an agent.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response Body (200 OK):**
```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "totalActions": 151,
  "successfulActions": 142,
  "failedActions": 9,
  "bagsScore": 76
}
```

**Error Responses:**
- `404` - Agent not found

**Example Request:**
```bash
curl https://countersig.com/agents/AgentPubkey111111111111111111111111111111111/attestations
```

---

#### GET /agents/:pubkey/flags

Retrieve all flags for an agent.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response Body (200 OK):**
```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "flags": [
    {
      "id": 1,
      "pubkey": "AgentPubkey111111111111111111111111111111111",
      "reporter_pubkey": "ReporterPubkey111111111111111111111111111111",
      "reason": "Suspicious trading pattern",
      "evidence": "Multiple failed transactions",
      "status": "pending",
      "created_at": "2024-01-20T15:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `404` - Agent not found

**Example Request:**
```bash
curl https://countersig.com/agents/AgentPubkey111111111111111111111111111111111/flags
```

---

### Widget (v1 — backward compatible)

---

#### GET /widget/:pubkey

Retrieve an embeddable HTML widget for an agent.

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Agent's public key |

**Response:**
- **Content-Type:** `text/html`
- **Body:** Complete HTML page with styled widget

The widget includes:
- Status indicator with visual badge
- Trust score with progress bar
- Action statistics (total, success rate)
- Registration and verification dates
- Capability tags
- Auto-refresh every 60 seconds

**Error Responses:**
- `404` - Agent not found (returns styled error HTML page)

**Example Request:**
```bash
curl https://countersig.com/widget/AgentPubkey111111111111111111111111111111111
```

**iframe Embed:**
```html
<iframe 
  src="https://countersig.com/widget/AgentPubkey111111111111111111111111111111111"
  width="400"
  height="300"
  frameborder="0"
></iframe>
```

---

---

## Authentication Endpoints (v2)

---

#### POST /auth/register

Register a new user account and create an initial organization.

**Authentication:** None (public registration)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Minimum 8 characters |
| `name` | string | Yes | Display name, 1-255 characters |
| `orgName` | string | No | Organization name (defaults to user's name) |

**Response Body (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Alice Smith",
    "role": "admin",
    "createdAt": "2026-04-27T10:30:00.000Z"
  },
  "org": {
    "id": "org-uuid-1234",
    "name": "Alice's Organization",
    "slug": "alice-s-organization",
    "createdAt": "2026-04-27T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing/invalid fields, invalid email format
- `409` - Email already registered

**Example Request:**
```bash
curl -X POST https://countersig.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!",
    "name": "Alice Smith",
    "orgName": "Acme Corp"
  }'
```

---

#### POST /auth/login

Authenticate and receive a JWT session cookie.

**Authentication:** None

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Registered email address |
| `password` | string | Yes | Account password |

**Response Body (200 OK):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "name": "Alice Smith",
    "role": "admin",
    "orgId": "org-uuid-1234"
  }
}
```

**Cookies Set:**
- `token` - JWT access token (httpOnly, Secure, SameSite=strict)
- `refreshToken` - Refresh token for session rotation

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid credentials

**Example Request:**
```bash
curl -X POST https://countersig.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }'
```

---

#### POST /auth/refresh

Refresh the JWT access token using the httpOnly refresh token cookie.

**Authentication:** Requires valid `refreshToken` cookie

**Rate Limit:** Auth tier (10 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "success": true
}
```

**Cookies Set:**
- New `token` cookie with rotated access token
- New `refreshToken` cookie with rotated refresh token

**Error Responses:**
- `401` - Missing or invalid refresh token

**Example Request:**
```bash
curl -X POST https://countersig.com/auth/refresh \
  -H "Cookie: refreshToken=..."
```

---

#### POST /auth/logout

Clear the session cookies and invalidate the refresh token.

**Authentication:** None (always succeeds client-side)

**Response Body (200 OK):**
```json
{
  "success": true
}
```

**Cookies Cleared:**
- `token`
- `refreshToken`

**Example Request:**
```bash
curl -X POST https://countersig.com/auth/logout
```

---

## API Key Endpoints (v2)

---

#### POST /api-keys

Create a new API key for programmatic access.

**Authentication:** JWT cookie or API key
**Required Role:** `member` or higher within the organization

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Descriptive name for the key |
| `scopes` | string[] | No | Allowed scopes (e.g., `["read", "write"]`) |
| `expiresAt` | string | No | ISO 8601 expiration date (null for no expiry) |

**Response Body (201 Created):**
```json
{
  "id": "key-uuid-5678",
  "rawKey": "cs_abc123xyz789secret",
  "name": "CI Deployment Key",
  "keyPrefix": "cs_abc",
  "scopes": ["read", "write"],
  "createdAt": "2026-04-27T10:30:00.000Z",
  "expiresAt": "2027-04-27T10:30:00.000Z"
}
```

> **Warning:** The `rawKey` is shown only once at creation. Store it securely.

**Error Responses:**
- `400` - Invalid request body
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl -X POST https://countersig.com/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "name": "Production API Key",
    "scopes": ["read"],
    "expiresAt": "2027-01-01T00:00:00.000Z"
  }'
```

---

#### GET /api-keys

List all API keys for the current user's organization.

**Authentication:** JWT cookie or API key
**Required Role:** `member` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
[
  {
    "id": "key-uuid-5678",
    "name": "CI Deployment Key",
    "keyPrefix": "cs_abc",
    "scopes": ["read", "write"],
    "createdAt": "2026-04-27T10:30:00.000Z",
    "expiresAt": "2027-04-27T10:30:00.000Z",
    "lastUsedAt": "2026-04-27T12:00:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl https://countersig.com/api-keys \
  -H "Cookie: token=..."
```

---

#### DELETE /api-keys/:id

Revoke and delete an API key.

**Authentication:** JWT cookie or API key
**Required Role:** `member` or higher (owner or admin can delete any key in the org)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key UUID |

**Response Body (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Key not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/api-keys/key-uuid-5678 \
  -H "Cookie: token=..."
```

---

## Organization Endpoints (v2)

---

#### GET /orgs/:orgId

Retrieve organization details.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher within the organization

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
{
  "id": "org-uuid-1234",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "description": "AI agent research and deployment",
  "settings": {
    "autoVerify": true,
    "defaultPolicy": "strict"
  },
  "createdAt": "2026-04-27T10:30:00.000Z",
  "updatedAt": "2026-04-27T10:30:00.000Z"
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization
- `404` - Organization not found

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234 \
  -H "Cookie: token=..."
```

---

#### PUT /orgs/:orgId

Update organization metadata and settings.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New organization name |
| `description` | string | No | Organization description |
| `settings` | object | No | Organization-specific settings JSON |

**Response Body (200 OK):**
```json
{
  "id": "org-uuid-1234",
  "name": "Acme Corp Updated",
  "slug": "acme-corp-updated",
  "description": "Updated description",
  "settings": {
    "autoVerify": true,
    "defaultPolicy": "strict"
  },
  "updatedAt": "2026-04-27T11:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid fields
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Organization not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/orgs/org-uuid-1234 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "name": "Acme Corp Updated",
    "description": "Updated organization description"
  }'
```

---

#### GET /orgs/:orgId/members

List all members of an organization.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
[
  {
    "id": "user-uuid-1111",
    "email": "alice@example.com",
    "name": "Alice Smith",
    "role": "admin",
    "joinedAt": "2026-04-27T10:30:00.000Z"
  },
  {
    "id": "user-uuid-2222",
    "email": "bob@example.com",
    "name": "Bob Jones",
    "role": "member",
    "joinedAt": "2026-04-27T11:00:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization
- `404` - Organization not found

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/members \
  -H "Cookie: token=..."
```

---

#### PUT /orgs/:orgId/members/:userId

Update a member's role within the organization.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `userId` | string | User UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | One of: `viewer`, `member`, `manager`, `admin` |

**Response Body (200 OK):**
```json
{
  "id": "user-uuid-2222",
  "email": "bob@example.com",
  "name": "Bob Jones",
  "role": "manager",
  "updatedAt": "2026-04-27T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid role
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - User or organization not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/orgs/org-uuid-1234/members/user-uuid-2222 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{"role": "manager"}'
```

---

#### DELETE /orgs/:orgId/members/:userId

Remove a member from the organization.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `userId` | string | User UUID |

**Response Body (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - User or organization not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/orgs/org-uuid-1234/members/user-uuid-2222 \
  -H "Cookie: token=..."
```

---

#### POST /orgs/:orgId/invite

Invite a new user to the organization by email.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address of the invitee |
| `role` | string | No | Role to assign (default: `member`) |

**Response Body (200 OK):**
```json
{
  "success": true,
  "inviteId": "invite-uuid-3333"
}
```

**Error Responses:**
- `400` - Invalid email or role
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl -X POST https://countersig.com/orgs/org-uuid-1234/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "email": "charlie@example.com",
    "role": "viewer"
  }'
```

---

#### GET /orgs/:orgId/stats

Retrieve aggregated organization statistics.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
{
  "total_agents": 42,
  "verified_agents": 35,
  "flagged_agents": 3,
  "revoked_agents": 1,
  "total_users": 8
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization
- `404` - Organization not found

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/stats \
  -H "Cookie: token=..."
```

---

#### GET /orgs/:orgId/agents

List agents scoped to the organization with pagination.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Results per page (max 100) |
| `offset` | number | 0 | Pagination offset |
| `status` | string | - | Filter by agent status |
| `capability` | string | - | Filter by capability |
| `chain` | string | - | Filter by chain type |
| `includeDemo` | boolean | `false` | Include demo agents |

**Response Body (200 OK):**
```json
{
  "agents": [
    {
      "pubkey": "AgentPubkey111111111111111111111111111111111",
      "name": "My Trading Agent",
      "status": "active",
      "bagsScore": 75,
      "registeredAt": "2024-01-15T10:30:00.000Z",
      "orgId": "org-uuid-1234"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization
- `404` - Organization not found

**Example Request:**
```bash
curl "https://countersig.com/orgs/org-uuid-1234/agents?limit=10&offset=0" \
  -H "Cookie: token=..."
```

---

## Audit Endpoints (v2)

---

#### GET /orgs/:orgId/audit

Query audit logs with filtering and pagination.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page (max 200) |
| `action` | string | - | Filter by action type (e.g., `AGENT_REGISTERED`) |
| `startDate` | string | - | ISO 8601 start date |
| `endDate` | string | - | ISO 8601 end date |

**Response Body (200 OK):**
```json
{
  "logs": [
    {
      "id": 101,
      "orgId": "org-uuid-1234",
      "action": "AGENT_REGISTERED",
      "actorId": "user-uuid-1111",
      "targetId": "AgentPubkey111111111111111111111111111111111",
      "metadata": { "ip": "203.0.113.1" },
      "riskScore": 10,
      "hash": "a3f5c2...",
      "createdAt": "2026-04-27T10:30:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization

**Example Request:**
```bash
curl "https://countersig.com/orgs/org-uuid-1234/audit?page=1&limit=20&action=AGENT_REGISTERED" \
  -H "Cookie: token=..."
```

---

#### GET /orgs/:orgId/audit/export

Export audit logs as JSON or CSV.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | Yes | `json` or `csv` |

**Response:**
- `Content-Type: application/json` or `text/csv`
- `Content-Disposition: attachment; filename="audit-export.{format}"`

**Error Responses:**
- `400` - Invalid format
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl "https://countersig.com/orgs/org-uuid-1234/audit/export?format=csv" \
  -H "Cookie: token=..." \
  --output audit-export.csv
```

---

#### GET /orgs/:orgId/audit/verify

Verify the integrity of the audit log hash chain.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
{
  "valid": true,
  "totalEntries": 150,
  "firstInvalidEntry": null
}
```

If the chain is broken:
```json
{
  "valid": false,
  "totalEntries": 150,
  "firstInvalidEntry": {
    "id": 87,
    "expectedHash": "a3f5c2...",
    "actualHash": "b7e1d9...",
    "createdAt": "2026-04-27T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/audit/verify \
  -H "Cookie: token=..."
```

---

## Policy Endpoints (v2)

---

#### GET /orgs/:orgId/policies

List all policy rules for an organization.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
[
  {
    "id": "policy-uuid-1111",
    "orgId": "org-uuid-1234",
    "name": "Auto-revoke low reputation",
    "condition": "bags_score < 50",
    "action": "revoke_agent",
    "enabled": true,
    "createdAt": "2026-04-27T10:30:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/policies \
  -H "Cookie: token=..."
```

---

#### POST /orgs/:orgId/policies

Create a new policy rule.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Policy name |
| `condition` | string | Yes | Condition expression (e.g., `bags_score < 50`) |
| `action` | string | Yes | Action to execute (e.g., `revoke_agent`, `flag_agent`) |
| `enabled` | boolean | No | Whether the policy is active (default: `true`) |

**Response Body (201 Created):**
```json
{
  "id": "policy-uuid-1111",
  "orgId": "org-uuid-1234",
  "name": "Auto-revoke low reputation",
  "condition": "bags_score < 50",
  "action": "revoke_agent",
  "enabled": true,
  "createdAt": "2026-04-27T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid condition or action
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl -X POST https://countersig.com/orgs/org-uuid-1234/policies \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "name": "Auto-revoke low reputation",
    "condition": "bags_score < 50",
    "action": "revoke_agent",
    "enabled": true
  }'
```

---

#### PUT /orgs/:orgId/policies/:policyId

Update an existing policy rule.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `policyId` | string | Policy UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Updated policy name |
| `condition` | string | No | Updated condition |
| `action` | string | No | Updated action |
| `enabled` | boolean | No | Enable/disable the policy |

**Response Body (200 OK):**
```json
{
  "id": "policy-uuid-1111",
  "name": "Auto-revoke low reputation (updated)",
  "condition": "bags_score < 40",
  "action": "revoke_agent",
  "enabled": true,
  "updatedAt": "2026-04-27T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid fields
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Policy not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/orgs/org-uuid-1234/policies/policy-uuid-1111 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "condition": "bags_score < 40",
    "enabled": true
  }'
```

---

#### DELETE /orgs/:orgId/policies/:policyId

Delete a policy rule.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `policyId` | string | Policy UUID |

**Response Body (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Policy not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/orgs/org-uuid-1234/policies/policy-uuid-1111 \
  -H "Cookie: token=..."
```

---

## Policy Enforcement Endpoints (Trust Layer v1)

The Trust Layer v1 policy system provides runtime destination enforcement for AI agents. It operates independently from the legacy Policy Endpoints (v2) above, which handle reputation-based rule automation.

All Trust Layer endpoints are mounted under `/v1/policy/` and require authentication. The system evaluates outbound destinations against a 5-level precedence model and produces signed, cacheable policy bundles for SDK consumption.

### Endpoint Summary

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/v1/policy/bundle/:agentId` | Required | `read` | Signed policy bundle for SDK consumption |
| POST | `/v1/policy/check` | Required | `read` | Per-call destination evaluation for gateway |
| GET | `/v1/policy/settings` | Required | `read` | Read org policy settings |
| PUT | `/v1/policy/settings` | Required | `admin` | Update org policy settings |
| GET | `/v1/policy/whitelist` | Required | `read` | List org whitelist entries |
| POST | `/v1/policy/whitelist` | Required | `admin` | Add whitelist entry |
| DELETE | `/v1/policy/whitelist/:id` | Required | `admin` | Remove whitelist entry |
| GET | `/v1/policy/blacklist` | Required | `read` | List org blacklist entries |
| POST | `/v1/policy/blacklist` | Required | `admin` | Add blacklist entry |
| DELETE | `/v1/policy/blacklist/:id` | Required | `admin` | Remove blacklist entry |

---

#### GET /v1/policy/bundle/:agentId

Returns a signed policy bundle containing the computed allow-list, deny-list, and global blacklist hash for a specific agent. This is the high-traffic hot path — agents pull every `bundle_ttl_seconds`.

**Authentication:** JWT cookie or API key
**Required Scope:** `read`

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent UUID |

**Response Headers:**
- `Cache-Control: private, max-age=<ttl_seconds>`

**Response Body (200 OK):**
```json
{
  "bundle": {
    "version": 1,
    "agent_id": "agent-uuid-1234",
    "org_id": "org-uuid-5678",
    "policy_mode": "enforced",
    "allow": [
      { "destination": "api.openai.com", "destination_type": "domain" },
      { "destination": "*.anthropic.com", "destination_type": "wildcard" }
    ],
    "deny": [
      { "destination": "evil.com", "destination_type": "domain", "scope": "org", "reason": "org_blacklist" }
    ],
    "global_deny_hash": "a1b2c3d4e5f6...sha256",
    "issued_at": "2026-04-30T12:00:00.000Z",
    "expires_at": "2026-04-30T12:05:00.000Z",
    "ttl_seconds": 300
  },
  "signature": "eyJhbGciOiJFZERTQSJ9...JWS"
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Agent belongs to a different organization (cross-tenant)
- `404` - Agent not found or deleted

**Example Request:**
```bash
curl https://countersig.com/v1/policy/bundle/agent-uuid-1234 \
  -H "Cookie: token=..."
```

---

#### POST /v1/policy/check

Evaluates a single destination for an agent and returns an allow/deny decision. Used by the network gateway for per-call enforcement. CSRF is skipped on this endpoint — authenticate via Bearer token.

For internal agent-to-agent traffic (`agent:<uuid>` destinations), a short-lived JWT is returned in the `token` field when the call is allowed.

**Authentication:** Bearer token (CSRF skipped)
**Required Scope:** `read`

**Rate Limit:** General tier (100 requests / 1 min)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Agent UUID making the outbound call |
| `destination` | string | Yes | Target destination (URL, hostname, or `agent:<uuid>`) |

**Response Body (200 OK):**
```json
{
  "allowed": true,
  "reason": "whitelisted",
  "scope": "org",
  "mode": "enforced",
  "token": null
}
```

**Decision Reasons:**

| Reason | Description |
|--------|-------------|
| `whitelisted` | Destination matches effective whitelist |
| `not_whitelisted` | Destination not found in whitelist (enforced mode) |
| `global_blacklist:<category>` | Blocked by global threat feed (e.g., `global_blacklist:malware`) |
| `org_blacklist` | Blocked by org-level blacklist |
| `agent_blacklist` | Blocked by agent-level blacklist |
| `permissive_mode` | Allowed because org is in permissive mode |
| `audit_only:<reason>` | Would be denied but org is in audit_only mode |
| `invalid_destination` | Destination could not be parsed |
| `internal_agent_reference` | Agent-to-agent traffic (`agent:<uuid>`) |

**Error Responses:**
- `400` - Missing `agent_id` or `destination`
- `401` - Not authenticated
- `403` - Agent belongs to a different organization
- `404` - Agent not found or deleted

**Example Request:**
```bash
curl -X POST https://countersig.com/v1/policy/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "agent_id": "agent-uuid-1234",
    "destination": "https://api.openai.com/v1/chat/completions"
  }'
```

**Example Response (blocked):**
```json
{
  "allowed": false,
  "reason": "global_blacklist:malware",
  "scope": "global",
  "mode": "enforced",
  "token": null
}
```

**Example Response (agent-to-agent with token):**
```json
{
  "allowed": true,
  "reason": "internal_agent_reference",
  "scope": "inherit",
  "mode": "enforced",
  "token": "eyJhbGciOiJFZERTQSJ9...short-lived-JWT"
}
```

---

#### GET /v1/policy/settings

Read the current org-level policy settings.

**Authentication:** JWT cookie or API key
**Required Scope:** `read`

**Response Body (200 OK):**
```json
{
  "org_id": "org-uuid-5678",
  "policy_mode": "enforced",
  "inherit_global_defaults": true,
  "bundle_ttl_seconds": 300
}
```

**Policy Modes:**

| Mode | Behavior |
|------|----------|
| `enforced` | Destinations must match whitelist; blacklist always blocks |
| `permissive` | Blacklist still blocks; whitelist not required |
| `audit_only` | All traffic allowed; violations logged but not blocked |

**Error Responses:**
- `401` - Not authenticated

**Example Request:**
```bash
curl https://countersig.com/v1/policy/settings \
  -H "Cookie: token=..."
```

---

#### PUT /v1/policy/settings

Update org-level policy settings. Only admins may call this endpoint. Changes are audit-logged.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `admin`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `policy_mode` | string | No | `enforced`, `permissive`, or `audit_only` |
| `inherit_global_defaults` | boolean | No | Whether to include the global default whitelist |
| `bundle_ttl_seconds` | integer | No | Cache TTL for policy bundles (seconds) |

**Response Body (200 OK):**
```json
{
  "org_id": "org-uuid-5678",
  "policy_mode": "audit_only",
  "inherit_global_defaults": true,
  "bundle_ttl_seconds": 600,
  "updated_by": "user-uuid-9999",
  "updated_at": "2026-04-30T14:00:00.000Z"
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role (requires admin)

**Example Request:**
```bash
curl -X PUT https://countersig.com/v1/policy/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "policy_mode": "audit_only",
    "bundle_ttl_seconds": 600
  }'
```

---

#### GET /v1/policy/whitelist

List all whitelist entries for the authenticated user's organization.

**Authentication:** JWT cookie or API key
**Required Scope:** `read`

**Response Body (200 OK):**
```json
[
  {
    "id": 1,
    "destination": "api.openai.com",
    "destination_type": "domain",
    "notes": "GPT-4 API access",
    "created_at": "2026-04-28T10:00:00.000Z"
  },
  {
    "id": 2,
    "destination": "*.anthropic.com",
    "destination_type": "wildcard",
    "notes": "All Anthropic endpoints",
    "created_at": "2026-04-28T10:05:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Not authenticated

---

#### POST /v1/policy/whitelist

Add a new whitelist entry. Only admins may call this endpoint. Changes are audit-logged.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `admin`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `destination` | string | Yes | Target destination (e.g., `api.openai.com`, `*.anthropic.com`, `10.0.0.0/8`) |
| `destination_type` | string | Yes | One of: `domain`, `wildcard`, `agent`, `cidr` |
| `notes` | string | No | Optional human-readable note |

**Response Body (201 Created):**
```json
{
  "id": 3,
  "org_id": "org-uuid-5678",
  "destination": "*.google.com",
  "destination_type": "wildcard",
  "notes": "Google APIs",
  "created_by": "user-uuid-9999",
  "created_at": "2026-04-30T15:00:00.000Z"
}
```

**Error Responses:**
- `400` - Missing `destination` or `destination_type`
- `401` - Not authenticated
- `403` - Insufficient role (requires admin)

**Example Request:**
```bash
curl -X POST https://countersig.com/v1/policy/whitelist \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "destination": "*.google.com",
    "destination_type": "wildcard",
    "notes": "Google APIs"
  }'
```

---

#### DELETE /v1/policy/whitelist/:id

Remove a whitelist entry by ID. Only admins may call this endpoint. Changes are audit-logged.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `admin`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Whitelist entry ID |

**Response:** `204 No Content`

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role (requires admin)
- `404` - Entry not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/v1/policy/whitelist/3 \
  -H "Cookie: token=..."
```

---

#### GET /v1/policy/blacklist

List all blacklist entries for the authenticated user's organization.

**Authentication:** JWT cookie or API key
**Required Scope:** `read`

**Response Body (200 OK):**
```json
[
  {
    "id": 1,
    "destination": "evil.com",
    "destination_type": "domain",
    "reason": "Known malicious endpoint",
    "created_at": "2026-04-28T11:00:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Not authenticated

---

#### POST /v1/policy/blacklist

Add a new blacklist entry. Only admins may call this endpoint. Changes are audit-logged.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `admin`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `destination` | string | Yes | Target destination to block |
| `destination_type` | string | Yes | One of: `domain`, `wildcard`, `agent`, `cidr` |
| `reason` | string | No | Optional reason for blocking |

**Response Body (201 Created):**
```json
{
  "id": 2,
  "org_id": "org-uuid-5678",
  "destination": "*.sketchy.io",
  "destination_type": "wildcard",
  "reason": "Untrusted vendor",
  "created_by": "user-uuid-9999",
  "created_at": "2026-04-30T16:00:00.000Z"
}
```

**Error Responses:**
- `400` - Missing `destination` or `destination_type`
- `401` - Not authenticated
- `403` - Insufficient role (requires admin)

**Example Request:**
```bash
curl -X POST https://countersig.com/v1/policy/blacklist \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "destination": "*.sketchy.io",
    "destination_type": "wildcard",
    "reason": "Untrusted vendor"
  }'
```

---

#### DELETE /v1/policy/blacklist/:id

Remove a blacklist entry by ID. Only admins may call this endpoint. Changes are audit-logged.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `admin`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Blacklist entry ID |

**Response:** `204 No Content`

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role (requires admin)
- `404` - Entry not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/v1/policy/blacklist/2 \
  -H "Cookie: token=..."
```

---

### Policy Bundle Format

The signed policy bundle is the primary artifact consumed by the Countersig SDK. It is fetched periodically (every `ttl_seconds`) and verified offline using the Ed25519 public key published via the JWKS endpoint.

```json
{
  "bundle": {
    "version": 1,
    "agent_id": "<agent-uuid>",
    "org_id": "<org-uuid>",
    "policy_mode": "enforced | permissive | audit_only",
    "allow": [
      { "destination": "api.openai.com", "destination_type": "domain" },
      { "destination": "*.anthropic.com", "destination_type": "wildcard" },
      { "destination": "10.0.0.0/8", "destination_type": "cidr" },
      { "destination": "agent:<uuid>", "destination_type": "agent" }
    ],
    "deny": [
      { "destination": "evil.com", "destination_type": "domain", "scope": "org", "reason": "org_blacklist" },
      { "destination": "bad-agent.io", "destination_type": "domain", "scope": "agent", "reason": "manual block" }
    ],
    "global_deny_hash": "<sha256 hex of sorted global_blacklist entries>",
    "issued_at": "2026-04-30T12:00:00.000Z",
    "expires_at": "2026-04-30T12:05:00.000Z",
    "ttl_seconds": 300
  },
  "signature": "<Ed25519 JWS compact serialization>"
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | integer | Bundle schema version (currently `1`) |
| `agent_id` | string | The agent this bundle was computed for |
| `org_id` | string | The agent's organization |
| `policy_mode` | string | `enforced`, `permissive`, or `audit_only` |
| `allow` | array | Effective whitelist (org + defaults ∩ agent overrides) |
| `deny` | array | Merged org + agent blacklist entries |
| `global_deny_hash` | string | SHA-256 hash of global blacklist; SDK fetches full list when hash changes |
| `issued_at` | string | ISO 8601 timestamp of bundle generation |
| `expires_at` | string | ISO 8601 timestamp when bundle expires |
| `ttl_seconds` | integer | Cache TTL matching the org setting |
| `signature` | string | Ed25519 JWS over the bundle JSON, verifiable via JWKS |

---

### Destination Matching Rules

The policy engine normalizes all destinations before matching. URLs are reduced to their hostname; `agent:<uuid>` references are matched as internal identifiers.

| Type | Format | Matching Behavior |
|------|--------|-------------------|
| `domain` | `api.openai.com` | Exact hostname match (case-insensitive) |
| `wildcard` | `*.openai.com` | Suffix match — matches the bare domain (`openai.com`) and any subdomain (`api.openai.com`) |
| `agent` | `agent:<uuid>` | Internal agent-to-agent reference; matched by UUID |
| `cidr` | `10.0.0.0/8` | IP range match — only applies when the destination resolves to a literal IP address |

**Normalization:** URLs are stripped to hostname only (`https://api.openai.com/v1/chat` → `api.openai.com`). Port numbers and paths are ignored. All comparisons are case-insensitive.

---

### Precedence Model

The Trust Layer evaluates destinations against a strict 5-level priority model. Higher-priority rules always win, regardless of lower-level entries.

| Priority | List | Scope | Effect | Overridable? |
|----------|------|-------|--------|--------------|
| 1 (highest) | Global Blacklist | Platform | **Block** — threat feed entries (URLhaus, etc.) | No — cannot be overridden by any org or agent setting |
| 2 | Org Blacklist | Organization | **Block** — org-level denied destinations | No — always wins over whitelists |
| 3 | Org Whitelist | Organization | **Allow** — defines the maximum allowed set | Only restricted by blacklists above |
| 4 | Agent Whitelist | Agent | **Allow** — further restricts within org whitelist (intersection) | Subset of org whitelist only |
| 5 (lowest) | Agent Blacklist | Agent | **Block** — agent-specific denied destinations | Additive on top of org blacklist |

**Key behaviors:**
- In `enforced` mode, a destination must appear in the effective whitelist AND not appear in any blacklist.
- In `permissive` mode, blacklists still block, but destinations not on the whitelist are allowed.
- In `audit_only` mode, all traffic is allowed, but violations are logged with `audit_only:<reason>` for monitoring.
- The effective whitelist is the intersection of org whitelist (+ global defaults if opted in) and agent whitelist (if the agent has any entries). If the agent has no whitelist entries, the full org whitelist applies.

---

## Webhook Endpoints (v2)

---

#### GET /orgs/:orgId/webhooks

List all webhooks configured for an organization.

**Authentication:** JWT cookie or API key
**Required Role:** `viewer` or higher

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
[
  {
    "id": "webhook-uuid-1111",
    "orgId": "org-uuid-1234",
    "url": "https://hooks.slack.com/services/...",
    "events": ["agent.registered", "agent.flagged"],
    "secret": "whsec_***",
    "active": true,
    "createdAt": "2026-04-27T10:30:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not a member of this organization

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/webhooks \
  -H "Cookie: token=..."
```

---

#### POST /orgs/:orgId/webhooks

Create a new webhook subscription.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | HTTPS endpoint URL |
| `events` | string[] | Yes | Event types to subscribe to |
| `secret` | string | No | Shared secret for HMAC signature verification |

**Response Body (201 Created):**
```json
{
  "id": "webhook-uuid-1111",
  "orgId": "org-uuid-1234",
  "url": "https://hooks.slack.com/services/...",
  "events": ["agent.registered", "agent.flagged"],
  "secret": "whsec_***",
  "active": true,
  "createdAt": "2026-04-27T10:30:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid URL or events
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl -X POST https://countersig.com/orgs/org-uuid-1234/webhooks \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["agent.registered", "agent.flagged"],
    "secret": "my-webhook-secret"
  }'
```

---

#### PUT /orgs/:orgId/webhooks/:webhookId

Update a webhook subscription.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `webhookId` | string | Webhook UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | No | Updated endpoint URL |
| `events` | string[] | No | Updated event list |
| `secret` | string | No | Updated shared secret |
| `active` | boolean | No | Enable or disable the webhook |

**Response Body (200 OK):**
```json
{
  "id": "webhook-uuid-1111",
  "url": "https://new-endpoint.example.com/webhook",
  "events": ["agent.registered"],
  "active": true,
  "updatedAt": "2026-04-27T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid fields
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Webhook not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/orgs/org-uuid-1234/webhooks/webhook-uuid-1111 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "url": "https://new-endpoint.example.com/webhook",
    "events": ["agent.registered"]
  }'
```

---

#### DELETE /orgs/:orgId/webhooks/:webhookId

Delete a webhook subscription.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `webhookId` | string | Webhook UUID |

**Response Body (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Webhook not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/orgs/org-uuid-1234/webhooks/webhook-uuid-1111 \
  -H "Cookie: token=..."
```

---

### Chain & Network (v2)

---

#### GET /chains

List all supported blockchain types with metadata.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "chains": [
    {
      "chainType": "solana-bags",
      "name": "Solana (BAGS)",
      "chainId": "solana-mainnet",
      "addressFormat": "base58",
      "signingAlgo": "Ed25519"
    },
    {
      "chainType": "ethereum",
      "name": "Ethereum",
      "chainId": "1",
      "addressFormat": "hex",
      "signingAlgo": "SECP256K1"
    }
  ],
  "count": 5
}
```

**Example Request:**
```bash
curl https://countersig.com/chains
```

---

### Public Agent Listing (v2)

---

#### GET /public/agents

List all public agents without authentication. Returns only public-safe fields.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chain` | string | - | Filter by chain type |
| `capability` | string | - | Filter by capability |
| `search` | string | - | Free-text search across name and description |
| `limit` | number | 50 | Results per page (max 100) |
| `offset` | number | 0 | Pagination offset |

**Response Body (200 OK):**
```json
{
  "agents": [
    {
      "agent_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Trading Agent",
      "pubkey": "AgentPubkey111111111111111111111111111111111",
      "status": "active",
      "bags_score": 75,
      "capabilities": ["trading", "analytics"],
      "registered_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Example Request:**
```bash
curl "https://countersig.com/public/agents?capability=trading&limit=10"
```

---

### Agent Ownership (v2)

---

#### GET /agents/owner/:pubkey

Get all agents owned by a specific public key.

**Authentication:** JWT cookie or API key
**Required Scope:** `read`

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | string | Owner's public key |

**Response Body (200 OK):**
```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "agents": [
    {
      "pubkey": "AgentPubkey111111111111111111111111111111111",
      "name": "My Trading Agent",
      "status": "active",
      "bagsScore": 75,
      "registeredAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `400` - Invalid Solana public key format
- `401` - Not authenticated

**Example Request:**
```bash
curl https://countersig.com/agents/owner/AgentPubkey111111111111111111111111111111111 \
  -H "Cookie: token=..."
```

---

### Agent Revocation (v2)

---

#### POST /agents/:agentId/revoke

Revoke an agent, permanently disabling it. Requires ownership verification via Ed25519 signature.

**Authentication:** JWT cookie or API key
**Required Scope:** `write` (admin)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pubkey` | string | Yes | Agent's registered public key |
| `signature` | string | Yes | Base58-encoded Ed25519 signature |
| `message` | string | Yes | `COUNTERSIG-REVOKE:{agentId}:{timestamp}` |

**Response Body (200 OK):**
```json
{
  "success": true,
  "message": "Agent revoked successfully",
  "agent": {
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "name": "My Trading Agent",
    "status": "revoked",
    "revokedAt": "2024-01-20T14:22:00.000Z"
  },
  "revokedAt": "2024-01-20T14:22:00.000Z"
}
```

**Error Responses:**
- `400` - Missing/invalid fields, invalid message format
- `401` - Invalid signature or timestamp outside 5-minute window
- `403` - Access denied (not owner or wrong organization)
- `404` - Agent not found
- `410` - Agent already revoked

**Example Request:**
```bash
curl -X POST https://countersig.com/agents/550e8400-e29b-41d4-a716-446655440000/revoke \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "signature": "Base58Signature...",
    "message": "COUNTERSIG-REVOKE:550e8400-e29b-41d4-a716-446655440000:1705753200000"
  }'
```

---

### A2A Token & Credentials (v2)

---

#### POST /agents/:agentId/issue-token

Issue a short-lived A2A (Agent-to-Agent) authentication JWT token. The token includes agent metadata, chain type, and capabilities in its claims and expires in 60 seconds.

**Authentication:** JWT cookie or API key
**Required Scope:** `write`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent UUID |

**Response Body (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 60,
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "issuedAt": "2024-01-20T14:22:00.000Z"
}
```

**Error Responses:**
- `403` - Agent is revoked or flagged, or does not belong to your organization
- `404` - Agent not found

**Example Request:**
```bash
curl -X POST https://countersig.com/agents/550e8400-e29b-41d4-a716-446655440000/issue-token \
  -H "Cookie: token=..."
```

---

#### POST /verify-token

Verify an A2A token statelessly. No authentication required — receiving agents can verify tokens without the shared secret by using this endpoint.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | A2A JWT token to verify |

**Response Body (200 OK):**
```json
{
  "valid": true,
  "payload": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "type": "a2a",
    "name": "My Trading Agent",
    "pubkey": "AgentPubkey111111111111111111111111111111111",
    "chain": "solana-bags",
    "caps": ["trading", "analytics"],
    "score": 75
  }
}
```

**Error Responses:**
- `400` - Missing token
- `401` - Invalid or expired token

**Example Request:**
```bash
curl -X POST https://countersig.com/verify-token \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

---

#### GET /agents/:agentId/credential

Get a W3C Verifiable Credential (JSON-LD) for an agent. No authentication required.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent UUID |

**Response Body (200 OK):**
- **Content-Type:** `application/vc+ld+json`

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    {
      "CountersigCredential": "https://countersig.com/schemas/credential/v1",
      "agentName": "https://countersig.com/schemas/credential/v1#agentName",
      "chainType": "https://countersig.com/schemas/credential/v1#chainType",
      "reputationScore": "https://countersig.com/schemas/credential/v1#reputationScore",
      "reputationLabel": "https://countersig.com/schemas/credential/v1#reputationLabel",
      "capabilities": "https://countersig.com/schemas/credential/v1#capabilities",
      "verificationStatus": "https://countersig.com/schemas/credential/v1#verificationStatus",
      "registeredAt": "https://countersig.com/schemas/credential/v1#registeredAt",
      "lastVerified": "https://countersig.com/schemas/credential/v1#lastVerified"
    }
  ],
  "id": "urn:agentid:credential:550e8400-e29b-41d4-a716-446655440000",
  "type": ["VerifiableCredential", "AIAgentIdentityCredential"],
  "issuer": {
    "id": "did:web:countersig.com",
    "name": "Countersig",
    "url": "https://countersig.com"
  },
  "issuanceDate": "2024-01-20T14:22:00.000Z",
  "expirationDate": "2024-01-21T14:22:00.000Z",
  "credentialSubject": {
    "id": "did:key:AgentPubkey111111111111111111111111111111111",
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "agentName": "My Trading Agent",
    "chainType": "solana-bags",
    "publicKey": "AgentPubkey111111111111111111111111111111111",
    "reputationScore": 75,
    "reputationLabel": "MEDIUM",
    "capabilities": ["trading", "analytics"],
    "verificationStatus": "VERIFIED",
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "lastVerified": "2024-01-20T14:22:00.000Z"
  },
  "credentialStatus": {
    "id": "https://api.countersig.com/agents/550e8400-e29b-41d4-a716-446655440000",
    "type": "CountersigStatusCheck2024",
    "statusPurpose": "revocation"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "created": "2024-01-20T14:22:00.000Z",
    "verificationMethod": "did:web:countersig.com#ed25519-key",
    "proofPurpose": "assertionMethod",
    "proofValue": "UNSIGNED_CREDENTIAL_REQUIRES_DID_KEY_CONFIGURATION"
  }
}
```

**Error Responses:**
- `404` - Agent not found
- `500` - Failed to generate credential

**Example Request:**
```bash
curl https://countersig.com/agents/550e8400-e29b-41d4-a716-446655440000/credential \
  -H "Accept: application/vc+ld+json"
```

---

### Enterprise Authentication (v2)

---

#### POST /auth/verify-external-token

Verify an external OAuth2 or Entra ID token and return normalized identity claims.

**Authentication:** JWT cookie or API key

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | `oauth2`, `entra_id`, `okta`, or `auth0` |
| `token` | string | Yes | External JWT to validate |

**Response Body (200 OK):**
```json
{
  "valid": true,
  "identity": {
    "externalId": "user-sub-123",
    "provider": "https://login.microsoftonline.com/{tenant}/v2.0",
    "email": "user@example.com",
    "name": "Alice Smith",
    "credentialType": "oauth2",
    "claims": {
      "sub": "user-sub-123",
      "aud": "client-id-123",
      "iss": "https://login.microsoftonline.com/{tenant}/v2.0",
      "roles": ["User", "Admin"],
      "scope": "openid profile"
    }
  }
}
```

**Error Responses:**
- `400` - Missing token, or provider authentication is not enabled
- `401` - Token validation failed

**Example Request:**
```bash
curl -X POST https://countersig.com/auth/verify-external-token \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "provider": "entra_id",
    "token": "eyJhbGciOiJSUzI1NiIs..."
  }'
```

---

### Identity Provider Management (v2)

---

#### GET /orgs/:orgId/identity-providers

List all configured identity providers for an organization.

**Authentication:** JWT cookie or API key
**Required Role:** `manager` or `admin`
**Required Scope:** `read`

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
{
  "identityProviders": [
    {
      "id": "idp-uuid-1111",
      "orgId": "org-uuid-1234",
      "providerType": "oauth2",
      "issuerUrl": "https://auth.example.com",
      "clientId": "client-id-123",
      "allowedAudiences": ["audience-1", "audience-2"],
      "claimMappings": {
        "email": "email",
        "name": "name"
      },
      "enabled": true,
      "createdAt": "2026-04-27T10:30:00.000Z",
      "updatedAt": "2026-04-27T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/identity-providers \
  -H "Cookie: token=..."
```

---

#### POST /orgs/:orgId/identity-providers

Create a new identity provider configuration.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `write`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `providerType` | string | Yes | `oauth2`, `entra_id`, `okta`, or `auth0` |
| `issuerUrl` | string | Yes | Issuer URL (must be a valid URL) |
| `clientId` | string | No | OAuth2 client ID |
| `allowedAudiences` | string[] | No | Allowed token audiences |
| `claimMappings` | object | No | Claim mapping configuration |
| `enabled` | boolean | No | Whether the IdP is active (default: `true`) |

**Response Body (201 Created):**
```json
{
  "identityProvider": {
    "id": "idp-uuid-1111",
    "orgId": "org-uuid-1234",
    "providerType": "oauth2",
    "issuerUrl": "https://auth.example.com",
    "clientId": "client-id-123",
    "allowedAudiences": ["audience-1"],
    "claimMappings": {},
    "enabled": true,
    "createdAt": "2026-04-27T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing/invalid fields, invalid issuer URL, unsupported provider type
- `401` - Not authenticated
- `403` - Insufficient role
- `409` - Identity provider with this issuer URL already configured

**Example Request:**
```bash
curl -X POST https://countersig.com/orgs/org-uuid-1234/identity-providers \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "providerType": "oauth2",
    "issuerUrl": "https://auth.example.com",
    "clientId": "client-id-123",
    "allowedAudiences": ["my-app"],
    "enabled": true
  }'
```

---

#### PUT /orgs/:orgId/identity-providers/:idpId

Update an existing identity provider configuration.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `write`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `idpId` | string | Identity provider UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `providerType` | string | No | Updated provider type |
| `issuerUrl` | string | No | Updated issuer URL |
| `clientId` | string | No | Updated client ID |
| `allowedAudiences` | string[] | No | Updated allowed audiences |
| `claimMappings` | object | No | Updated claim mappings |
| `enabled` | boolean | No | Enable or disable the IdP |

**Response Body (200 OK):**
```json
{
  "identityProvider": {
    "id": "idp-uuid-1111",
    "providerType": "oauth2",
    "issuerUrl": "https://auth.example.com",
    "clientId": "client-id-123",
    "enabled": true,
    "updatedAt": "2026-04-27T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid fields or issuer URL
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Identity provider not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/orgs/org-uuid-1234/identity-providers/idp-uuid-1111 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=..." \
  -d '{
    "enabled": false
  }'
```

---

#### DELETE /orgs/:orgId/identity-providers/:idpId

Delete an identity provider configuration.

**Authentication:** JWT cookie or API key
**Required Role:** `admin`
**Required Scope:** `write`

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `idpId` | string | Identity provider UUID |

**Response Body (200 OK):**
```json
{
  "deleted": true,
  "identityProvider": {
    "id": "idp-uuid-1111",
    "providerType": "oauth2",
    "issuerUrl": "https://auth.example.com"
  }
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role
- `404` - Identity provider not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/orgs/org-uuid-1234/identity-providers/idp-uuid-1111 \
  -H "Cookie: token=..."
```

---

### Well-Known & Infrastructure

---

#### GET /.well-known/jwks.json

JWKS endpoint exposing public key metadata for A2A token verification. The actual HMAC secret is symmetric and must be obtained via a secure channel; this endpoint documents the algorithm and key ID.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "keys": [
    {
      "kty": "oct",
      "kid": "agentid-a2a-v1",
      "use": "sig",
      "alg": "HS256"
    }
  ],
  "issuer": "countersig.com",
  "documentation": "https://countersig.com/docs/a2a-auth",
  "verify_endpoint": "/agents/verify-token"
}
```

**Example Request:**
```bash
curl https://countersig.com/.well-known/jwks.json
```

---

#### GET /.well-known/did.json

W3C DID document for `did:web:countersig.com`. Exposes verification methods for Ed25519 and SECP256K1 keys, along with service endpoints for Countersig APIs.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://w3id.org/security/suites/secp256k1-2019/v1"
  ],
  "id": "did:web:countersig.com",
  "controller": "did:web:countersig.com",
  "verificationMethod": [
    {
      "id": "did:web:countersig.com#ed25519-key",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:web:countersig.com",
      "publicKeyMultibase": "z_PLACEHOLDER_CONFIGURE_IN_ENV"
    },
    {
      "id": "did:web:countersig.com#secp256k1-key",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:web:countersig.com",
      "publicKeyMultibase": "z_PLACEHOLDER_CONFIGURE_IN_ENV"
    }
  ],
  "authentication": [
    "did:web:countersig.com#ed25519-key",
    "did:web:countersig.com#secp256k1-key"
  ],
  "assertionMethod": [
    "did:web:countersig.com#ed25519-key",
    "did:web:countersig.com#secp256k1-key"
  ],
  "service": [
    {
      "id": "did:web:countersig.com#countersig-api",
      "type": "CountersigService",
      "serviceEndpoint": "https://api.countersig.com"
    },
    {
      "id": "did:web:countersig.com#a2a-verify",
      "type": "A2AVerificationService",
      "serviceEndpoint": "https://api.countersig.com/agents/verify-token"
    },
    {
      "id": "did:web:countersig.com#credential-issuance",
      "type": "VerifiableCredentialService",
      "serviceEndpoint": "https://api.countersig.com/agents/{agentId}/credential"
    }
  ]
}
```

**Example Request:**
```bash
curl https://countersig.com/.well-known/did.json
```

---

#### GET /health

Health check endpoint returning system status and dependency connectivity.

**Authentication:** None

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2024-01-20T14:22:00.000Z",
  "version": "2.0.0",
  "postgres": "connected",
  "redis": "connected",
  "chains": ["solana-bags", "solana", "ethereum", "base", "polygon"]
}
```

If services are degraded:

```json
{
  "status": "degraded",
  "uptime": 12345.67,
  "timestamp": "2024-01-20T14:22:00.000Z",
  "version": "2.0.0",
  "postgres": "disconnected",
  "redis": "connected",
  "chains": []
}
```

**HTTP Status Codes:**
- `200` - All services healthy
- `503` - One or more dependencies unavailable

**Example Request:**
```bash
curl https://countersig.com/health
```

---

## SIEM Integration Endpoints (Enterprise)

SIEM (Security Information and Event Management) integration endpoints allow Enterprise-tier organizations to configure connectors that push audit events to external security platforms. All endpoints require the `siem_integration` tier feature.

---

#### GET /orgs/:orgId/siem/connectors

List all SIEM connectors configured for the organization.

**Authentication:** Bearer JWT
**Required Role:** `manager` or `admin`
**Tier Requirement:** Enterprise (`siem_integration`)

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Response Body (200 OK):**
```json
{
  "connectors": [
    {
      "id": "connector-uuid-1111",
      "org_id": "org-uuid-1234",
      "name": "Splunk Production",
      "connector_type": "splunk_hec",
      "endpoint_url": "https://splunk.example.com:8088/services/collector",
      "auth_token_hash": "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      "auth_header_name": "Authorization",
      "format": "json",
      "filter_actions": ["agent.registered", "policy.violated"],
      "min_risk_score": 0,
      "batch_size": 100,
      "flush_interval_seconds": 30,
      "enabled": true,
      "created_at": "2026-04-28T10:00:00.000Z",
      "updated_at": "2026-04-28T10:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role or not a member of this organization
- `403` - Tier feature `siem_integration` not available

**Example Request:**
```bash
curl https://countersig.com/orgs/org-uuid-1234/siem/connectors \
  -H "Authorization: Bearer <jwt-token>"
```

---

#### POST /orgs/:orgId/siem/connectors

Create a new SIEM connector for the organization.

**Authentication:** Bearer JWT
**Required Role:** `admin`
**Tier Requirement:** Enterprise (`siem_integration`)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the connector |
| `connectorType` | string | Yes | One of: `splunk_hec`, `datadog`, `elasticsearch`, `generic_http`, `syslog` |
| `endpointUrl` | string | Yes | Target URL for event delivery |
| `authToken` | string | No | Authentication token (stored hashed) |
| `authHeaderName` | string | No | Header name for auth token (default: `Authorization`) |
| `format` | string | No | Output format: `json` (default), `cef`, or `syslog` |
| `filterActions` | string[] | No | Event types to forward (empty = all) |
| `minRiskScore` | number | No | Minimum risk score to forward (default: 0) |
| `batchSize` | number | No | Events per batch (default: 100) |
| `flushIntervalSeconds` | number | No | Max seconds between flushes (default: 30) |

**Response Body (201 Created):**
```json
{
  "connector": {
    "id": "connector-uuid-2222",
    "org_id": "org-uuid-1234",
    "name": "Datadog Prod",
    "connector_type": "datadog",
    "endpoint_url": "https://http-intake.logs.datadoghq.com/api/v2/logs",
    "auth_token_hash": "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    "auth_header_name": "DD-API-KEY",
    "format": "json",
    "filter_actions": [],
    "min_risk_score": 0,
    "batch_size": 100,
    "flush_interval_seconds": 30,
    "enabled": true,
    "created_at": "2026-04-28T11:00:00.000Z",
    "updated_at": "2026-04-28T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing required fields (`name`, `connectorType`, `endpointUrl`)
- `400` - Invalid `connectorType` or `format` value
- `401` - Not authenticated
- `403` - Insufficient role or tier feature not available

**Example Request:**
```bash
curl -X POST https://countersig.com/orgs/org-uuid-1234/siem/connectors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "name": "Datadog Prod",
    "connectorType": "datadog",
    "endpointUrl": "https://http-intake.logs.datadoghq.com/api/v2/logs",
    "authToken": "dd-api-key-value",
    "authHeaderName": "DD-API-KEY",
    "format": "json",
    "batchSize": 50,
    "flushIntervalSeconds": 15
  }'
```

---

#### PUT /orgs/:orgId/siem/connectors/:connectorId

Update an existing SIEM connector.

**Authentication:** Bearer JWT
**Required Role:** `admin`
**Tier Requirement:** Enterprise (`siem_integration`)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `connectorId` | string | Connector UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Updated display name |
| `endpointUrl` | string | No | Updated target URL |
| `authToken` | string | No | Updated auth token |
| `authHeaderName` | string | No | Updated header name |
| `format` | string | No | Updated format: `json`, `cef`, or `syslog` |
| `filterActions` | string[] | No | Updated event filter list |
| `minRiskScore` | number | No | Updated minimum risk score |
| `batchSize` | number | No | Updated batch size |
| `flushIntervalSeconds` | number | No | Updated flush interval |
| `enabled` | boolean | No | Enable or disable the connector |

**Response Body (200 OK):**
```json
{
  "connector": {
    "id": "connector-uuid-1111",
    "org_id": "org-uuid-1234",
    "name": "Splunk Production (Updated)",
    "connector_type": "splunk_hec",
    "endpoint_url": "https://splunk.example.com:8088/services/collector",
    "auth_token_hash": "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    "format": "cef",
    "enabled": true,
    "updated_at": "2026-04-28T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role or tier feature not available
- `404` - Connector not found

**Example Request:**
```bash
curl -X PUT https://countersig.com/orgs/org-uuid-1234/siem/connectors/connector-uuid-1111 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "name": "Splunk Production (Updated)",
    "format": "cef",
    "batchSize": 200
  }'
```

---

#### DELETE /orgs/:orgId/siem/connectors/:connectorId

Delete a SIEM connector.

**Authentication:** Bearer JWT
**Required Role:** `admin`
**Tier Requirement:** Enterprise (`siem_integration`)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `connectorId` | string | Connector UUID |

**Response Body (200 OK):**
```json
{
  "message": "Connector deleted"
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role or tier feature not available
- `404` - Connector not found

**Example Request:**
```bash
curl -X DELETE https://countersig.com/orgs/org-uuid-1234/siem/connectors/connector-uuid-1111 \
  -H "Authorization: Bearer <jwt-token>"
```

---

#### POST /orgs/:orgId/siem/connectors/:connectorId/test

Test a SIEM connector by sending a sample event to the configured endpoint.

**Authentication:** Bearer JWT
**Required Role:** `admin`
**Tier Requirement:** Enterprise (`siem_integration`)

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `connectorId` | string | Connector UUID |

**Response Body (200 OK):**
```json
{
  "success": true,
  "status": 200,
  "message": "Test event delivered successfully"
}
```

If the test fails:

```json
{
  "success": false,
  "status": 502,
  "error": "Connection refused: https://splunk.example.com:8088/services/collector"
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role or tier feature not available
- `404` - Connector not found

**Example Request:**
```bash
curl -X POST https://countersig.com/orgs/org-uuid-1234/siem/connectors/connector-uuid-1111/test \
  -H "Authorization: Bearer <jwt-token>"
```

---

#### GET /orgs/:orgId/siem/connectors/:connectorId/deliveries

List delivery history for a SIEM connector, showing recent event batches and their delivery status.

**Authentication:** Bearer JWT
**Required Role:** `manager` or `admin`
**Tier Requirement:** Enterprise (`siem_integration`)

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization UUID |
| `connectorId` | string | Connector UUID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max results to return (capped at 100) |
| `offset` | number | 0 | Pagination offset |

**Response Body (200 OK):**
```json
{
  "deliveries": [
    {
      "id": "delivery-uuid-1111",
      "connector_id": "connector-uuid-1111",
      "event_count": 25,
      "status": "delivered",
      "http_status": 200,
      "error": null,
      "delivered_at": "2026-04-28T12:05:00.000Z"
    },
    {
      "id": "delivery-uuid-2222",
      "connector_id": "connector-uuid-1111",
      "event_count": 10,
      "status": "failed",
      "http_status": 503,
      "error": "Service Unavailable",
      "delivered_at": "2026-04-28T12:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient role or tier feature not available
- `404` - Connector not found

**Example Request:**
```bash
curl "https://countersig.com/orgs/org-uuid-1234/siem/connectors/connector-uuid-1111/deliveries?limit=20" \
  -H "Authorization: Bearer <jwt-token>"
```

---

## Agent Health Monitoring Endpoints (Professional+)

Agent Health Monitoring provides real-time visibility into agent operational status through heartbeats, health summaries, and configurable alert rules. Available on Professional and Enterprise tiers.

---

#### POST /agents/:agentId/heartbeat

Send a heartbeat signal for an agent. Updates the agent's `last_heartbeat` timestamp and transitions its health status to `healthy`. If the agent was previously in a non-healthy state, a health transition event is recorded.

**Authentication:** Bearer JWT
**Required Role:** `member` or higher
**Required Scope:** `write`

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata` | object | No | Optional runtime information |
| `metadata.version` | string | No | Agent software version |
| `metadata.uptime` | number | No | Agent uptime in seconds |
| `metadata.errorCount` | number | No | Number of errors since last heartbeat |
| `metadata.memoryUsage` | number | No | Memory usage in bytes |
| `metadata.cpuUsage` | number | No | CPU usage percentage (0-100) |

**Response Body (200 OK):**
```json
{
  "status": "ok",
  "next_expected": 120,
  "timestamp": "2026-04-28T14:30:00.000Z"
}
```

> **Note:** `next_expected` indicates the number of seconds until the next expected heartbeat. Agents that fail to send a heartbeat within this window will transition to `stale` status.

**Error Responses:**
- `401` - Not authenticated
- `403` - Agent does not belong to user's organization
- `404` - Agent not found

**Example Request:**
```bash
curl -X POST https://countersig.com/agents/agent-uuid-1234/heartbeat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "metadata": {
      "version": "1.2.3",
      "uptime": 86400,
      "errorCount": 0,
      "memoryUsage": 134217728,
      "cpuUsage": 12.5
    }
  }'
```

---

#### GET /agents/health/summary

Get an organization-wide health summary, including counts by status and agents that need attention.

**Authentication:** Bearer JWT

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "summary": {
    "healthy": 45,
    "stale": 3,
    "offline": 2,
    "unknown": 5,
    "total": 55,
    "healthScore": 82
  },
  "needsAttention": [
    {
      "agent_id": "agent-uuid-1111",
      "name": "Trading Bot Alpha",
      "health_status": "offline",
      "last_heartbeat": "2026-04-27T08:00:00.000Z",
      "successful_actions": 1250,
      "failed_actions": 15
    },
    {
      "agent_id": "agent-uuid-2222",
      "name": "Data Collector",
      "health_status": "stale",
      "last_heartbeat": "2026-04-28T12:00:00.000Z",
      "successful_actions": 890,
      "failed_actions": 3
    }
  ]
}
```

> **Note:** `needsAttention` returns up to 20 agents with `stale` or `offline` status, ordered by oldest heartbeat first.

**Error Responses:**
- `401` - Not authenticated
- `500` - Failed to fetch health summary

**Example Request:**
```bash
curl https://countersig.com/agents/health/summary \
  -H "Authorization: Bearer <jwt-token>"
```

---

#### GET /agents/:agentId/health

Get detailed health information for a specific agent, including action success rate and recent health events.

**Authentication:** Bearer JWT

**Rate Limit:** General tier (100 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent UUID |

**Response Body (200 OK):**
```json
{
  "agentId": "agent-uuid-1234",
  "name": "Trading Bot Alpha",
  "healthStatus": "healthy",
  "lastHeartbeat": "2026-04-28T14:30:00.000Z",
  "lastVerified": "2026-04-28T14:25:00.000Z",
  "successfulActions": 1250,
  "failedActions": 15,
  "successRate": 99,
  "events": [
    {
      "id": "event-uuid-1111",
      "agent_id": "agent-uuid-1234",
      "previous_status": "stale",
      "new_status": "healthy",
      "trigger": "heartbeat",
      "metadata": { "version": "1.2.3" },
      "created_at": "2026-04-28T14:30:00.000Z"
    }
  ]
}
```

> **Note:** `successRate` is a percentage (0-100) calculated from `successfulActions / (successfulActions + failedActions)`. Returns `null` if no actions have been recorded. Up to 20 recent health events are returned.

**Error Responses:**
- `401` - Not authenticated
- `404` - Agent not found or not in user's organization
- `500` - Failed to fetch agent health

**Example Request:**
```bash
curl https://countersig.com/agents/agent-uuid-1234/health \
  -H "Authorization: Bearer <jwt-token>"
```

---

#### GET /agents/health/alerts

List all health alert rules configured for the organization.

**Authentication:** Bearer JWT

**Rate Limit:** General tier (100 requests / 1 min)

**Response Body (200 OK):**
```json
{
  "rules": [
    {
      "id": "rule-uuid-1111",
      "org_id": "org-uuid-1234",
      "name": "Agent Offline Alert",
      "condition": "agent_offline",
      "threshold_minutes": 30,
      "threshold_percent": null,
      "notify_webhook": true,
      "enabled": true,
      "created_at": "2026-04-28T10:00:00.000Z",
      "updated_at": "2026-04-28T10:00:00.000Z"
    },
    {
      "id": "rule-uuid-2222",
      "org_id": "org-uuid-1234",
      "name": "High Failure Rate",
      "condition": "high_failure_rate",
      "threshold_minutes": null,
      "threshold_percent": 25,
      "notify_webhook": true,
      "enabled": true,
      "created_at": "2026-04-28T10:05:00.000Z",
      "updated_at": "2026-04-28T10:05:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401` - Not authenticated
- `500` - Failed to fetch alert rules

**Example Request:**
```bash
curl https://countersig.com/agents/health/alerts \
  -H "Authorization: Bearer <jwt-token>"
```

---

#### POST /agents/health/alerts

Create a new health alert rule for the organization.

**Authentication:** Bearer JWT

**Rate Limit:** Auth tier (10 requests / 1 min)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the alert rule |
| `condition` | string | Yes | One of: `agent_offline`, `agent_stale`, `high_failure_rate`, `no_heartbeat` |
| `thresholdMinutes` | number | No | Minutes threshold (for time-based conditions) |
| `thresholdPercent` | number | No | Percentage threshold (for `high_failure_rate`) |
| `notifyWebhook` | boolean | No | Whether to send webhook notification (default: `true`) |

**Response Body (201 Created):**
```json
{
  "rule": {
    "id": "rule-uuid-3333",
    "org_id": "org-uuid-1234",
    "name": "No Heartbeat Warning",
    "condition": "no_heartbeat",
    "threshold_minutes": 60,
    "threshold_percent": null,
    "notify_webhook": true,
    "enabled": true,
    "created_at": "2026-04-28T15:00:00.000Z",
    "updated_at": "2026-04-28T15:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing `name` or `condition`
- `400` - Invalid `condition` value
- `401` - Not authenticated
- `500` - Failed to create alert rule

**Example Request:**
```bash
curl -X POST https://countersig.com/agents/health/alerts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "name": "No Heartbeat Warning",
    "condition": "no_heartbeat",
    "thresholdMinutes": 60,
    "notifyWebhook": true
  }'
```

---

#### PUT /agents/health/alerts/:ruleId

Update an existing health alert rule.

**Authentication:** Bearer JWT

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ruleId` | string | Alert rule UUID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Updated display name |
| `condition` | string | No | Updated condition |
| `thresholdMinutes` | number | No | Updated minutes threshold |
| `thresholdPercent` | number | No | Updated percentage threshold |
| `notifyWebhook` | boolean | No | Updated webhook notification setting |
| `enabled` | boolean | No | Enable or disable the rule |

**Response Body (200 OK):**
```json
{
  "rule": {
    "id": "rule-uuid-1111",
    "org_id": "org-uuid-1234",
    "name": "Agent Offline Alert (Updated)",
    "condition": "agent_offline",
    "threshold_minutes": 15,
    "threshold_percent": null,
    "notify_webhook": true,
    "enabled": true,
    "updated_at": "2026-04-28T16:00:00.000Z"
  }
}
```

**Error Responses:**
- `401` - Not authenticated
- `404` - Alert rule not found
- `500` - Failed to update alert rule

**Example Request:**
```bash
curl -X PUT https://countersig.com/agents/health/alerts/rule-uuid-1111 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "name": "Agent Offline Alert (Updated)",
    "thresholdMinutes": 15
  }'
```

---

#### DELETE /agents/health/alerts/:ruleId

Delete a health alert rule.

**Authentication:** Bearer JWT

**Rate Limit:** Auth tier (10 requests / 1 min)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ruleId` | string | Alert rule UUID |

**Response Body (200 OK):**
```json
{
  "message": "Alert rule deleted"
}
```

**Error Responses:**
- `401` - Not authenticated
- `404` - Alert rule not found
- `500` - Failed to delete alert rule

**Example Request:**
```bash
curl -X DELETE https://countersig.com/agents/health/alerts/rule-uuid-1111 \
  -H "Authorization: Bearer <jwt-token>"
```

---

## Configuration Reference

Environment variables for API configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | Server port |
| `NODE_ENV` | development | Environment mode |
| `COUNTERSIG_BASE_URL` | http://localhost:3002 | Base URL for widget/badge links |
| `DATABASE_URL` | postgresql://user:password@localhost:5432/countersig | PostgreSQL connection |
| `REDIS_URL` | redis://localhost:6379 | Redis connection |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed CORS origin |
| `BADGE_CACHE_TTL` | 60 | Badge cache TTL in seconds |
| `CHALLENGE_EXPIRY_SECONDS` | 300 | Challenge expiration time |
| `BAGS_API_KEY` | - | API key for Bags.fm integration |
| `SAID_GATEWAY_URL` | https://said-identity-gateway.up.railway.app | SAID gateway endpoint |

---

*Document Version: 2.0.0*  
*Last Updated: May 2026*
