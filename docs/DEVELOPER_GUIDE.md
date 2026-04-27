# AgentID Developer Guide

Enterprise-grade developer onboarding documentation for the AgentID platform — the Bags-native trust verification layer for AI agents on Solana.

**Author:** David Cooper (CCIE #14019)  
**Version:** 1.0.0  
**Last Updated:** April 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Setup](#4-database-setup)
5. [Running the Project](#5-running-the-project)
6. [Architecture Overview](#6-architecture-overview)
7. [Testing](#7-testing)
8. [Key Concepts](#8-key-concepts)
9. [AgentID 2.0 Features](#9-agentid-20-features)
10. [Deployment](#10-deployment)
11. [Contributing](#11-contributing)

---

## 1. Prerequisites

| Component | Minimum Version | Purpose |
|-----------|-----------------|---------|
| Node.js | 20.x | Runtime environment |
| PostgreSQL | 16.x | Primary database |
| Redis | 7.x | Caching and session storage |
| Git | 2.x+ | Version control |

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be v20.x.x or higher

# Check PostgreSQL
psql --version  # Should be 16.x or higher

# Check Redis
redis-cli --version  # Should be 7.x or higher

# Check Git
git --version
```

---

## 2. Quick Start

Choose one of three setup options based on your environment:

### Option A: Docker Compose (Recommended for First-Time Setup)

This option automatically provisions PostgreSQL and Redis containers.

```bash
# Clone the repository
git clone https://github.com/RunTimeAdmin/AgentID-2.0.git
cd AgentID-2.0

# Start infrastructure services
docker-compose up -d

# Verify services are healthy
docker-compose ps

# Backend setup
cd backend
cp .env.example .env
npm install
npm run migrate       # Creates database tables
npm run dev           # Starts development server on port 3002

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev           # Starts Vite dev server on port 5173
```

Access the application:
- Frontend: http://localhost:5173
- API: http://localhost:3002
- Health Check: http://localhost:3002/health

### Option B: Local Services (If You Already Have PG/Redis)

```bash
# Ensure your local PostgreSQL and Redis are running
# Then follow the same setup as Option A, but update .env:
# DATABASE_URL=postgresql://youruser:yourpass@localhost:5432/agentid
# REDIS_URL=redis://localhost:6379

cd backend
cp .env.example .env
# Edit .env with your local database credentials
npm install
npm run migrate
npm run dev
```

### Option C: Cloud Services (Railway, Supabase, etc.)

```bash
# Create databases on your cloud provider
# Example for Railway:
# - Create PostgreSQL database
# - Create Redis instance (or use Redis Cloud)
# - Copy connection strings

cd backend
cp .env.example .env
# Update .env with cloud connection URLs:
# DATABASE_URL=postgresql://... (from Railway)
# REDIS_URL=redis://... (from Redis Cloud)

npm install
npm run migrate
npm run dev
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

### Required Variables

| Variable | Description | Default | Where to Get |
|----------|-------------|---------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/agentid` | Local: use docker-compose values; Cloud: provider dashboard |
| `BAGS_API_KEY` | API key for Bags.fm integration | (empty) | **Required** — Contact Bags team or check docs.bags.fm |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `PORT` | API server port | `3002` | Change if port is in use |
| `NODE_ENV` | Environment mode | `development` | Set to `production` for deploys |
| `SAID_GATEWAY_URL` | SAID Protocol gateway | `https://said-identity-gateway.up.railway.app` | Only change if self-hosting SAID |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Must match your Redis instance |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` | Update for production domains |
| `BADGE_CACHE_TTL` | Badge cache duration (seconds) | `60` | Increase for production |
| `CHALLENGE_EXPIRY_SECONDS` | PKI challenge lifetime | `300` | 5 minutes default |
| `AGENTID_BASE_URL` | Public API base URL | `http://localhost:3002` | Update for production |

### Environment Setup Checklist

```bash
cd backend
cp .env.example .env

# Edit .env and verify:
# [ ] DATABASE_URL is correct
# [ ] BAGS_API_KEY is set (required for agent registration)
# [ ] REDIS_URL matches your Redis instance
# [ ] CORS_ORIGIN matches your frontend URL
```

---

## 4. Database Setup

### Migration Command

```bash
cd backend
npm run migrate
```

This creates the following schema:

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     agent_identities                              │
├─────────────────────────────────────────────────────────────────┤
│ pubkey (PK)        │ VARCHAR(88)  │ Agent's Ed25519 public key  │
│ name               │ VARCHAR(255) │ Display name                │
│ description        │ TEXT         │ Agent description           │
│ token_mint         │ VARCHAR(88)  │ Associated token mint       │
│ bags_api_key_id    │ VARCHAR(255) │ Bags API reference          │
│ said_registered    │ BOOLEAN      │ SAID protocol binding       │
│ said_trust_score   │ INTEGER      │ Inherited SAID score        │
│ capability_set     │ JSONB        │ Array of capabilities       │
│ creator_x          │ VARCHAR(255) │ Creator's X handle          │
│ creator_wallet     │ VARCHAR(88)  │ Creator's wallet            │
│ registered_at      │ TIMESTAMPTZ  │ Registration timestamp      │
│ last_verified      │ TIMESTAMPTZ  │ Last PKI verification       │
│ status             │ VARCHAR(20)  │ verified/flagged/suspended  │
│ flag_reason        │ TEXT         │ Reason if flagged           │
│ bags_score         │ INTEGER      │ Computed reputation (0-100) │
│ total_actions      │ INTEGER      │ Total actions tracked       │
│ successful_actions │ INTEGER      │ Successful action count     │
│ failed_actions     │ INTEGER      │ Failed action count         │
│ fee_claims_count   │ INTEGER      │ Number of fee claims        │
│ fee_claims_sol     │ DECIMAL      │ Total fees claimed (SOL)    │
│ swaps_count        │ INTEGER      │ Swap operations count       │
│ launches_count     │ INTEGER      │ Token launch count          │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1:N
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   agent_verifications                             │
├─────────────────────────────────────────────────────────────────┤
│ id (PK)            │ SERIAL       │ Verification record ID      │
│ pubkey (FK)        │ VARCHAR(88)  │ Reference to agent          │
│ nonce              │ VARCHAR(64)  │ Unique challenge nonce      │
│ challenge          │ TEXT         │ Challenge string            │
│ expires_at         │ TIMESTAMPTZ  │ Challenge expiration        │
│ completed          │ BOOLEAN      │ Whether verified            │
│ created_at         │ TIMESTAMPTZ  │ Record creation time        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      agent_flags                                  │
├─────────────────────────────────────────────────────────────────┤
│ id (PK)            │ SERIAL       │ Flag record ID              │
│ pubkey (FK)        │ VARCHAR(88)  │ Flagged agent               │
│ reporter_pubkey    │ VARCHAR(88)  │ Reporter's public key       │
│ reason             │ TEXT         │ Flag reason                 │
│ evidence           │ JSONB        │ Supporting evidence         │
│ created_at         │ TIMESTAMPTZ  │ Flag timestamp              │
│ resolved           │ BOOLEAN      │ Resolution status           │
└─────────────────────────────────────────────────────────────────┘
```

### Indexes Created

- `idx_agent_identities_status` — Filter by verification status
- `idx_agent_identities_bags_score` — Sort by reputation score
- `idx_agent_verifications_pubkey` — Lookup verifications by agent
- `idx_agent_flags_pubkey` — Lookup flags by agent
- `idx_agent_flags_resolved` — Filter unresolved flags
- `idx_agent_flags_pubkey_resolved` — Combined flag queries

### Reset Database

```bash
# Drop and recreate (destructive — all data lost)
cd backend

# Connect to PostgreSQL and drop tables
psql $DATABASE_URL -c "DROP TABLE IF EXISTS agent_flags, agent_verifications, agent_identities CASCADE;"

# Re-run migrations
npm run migrate
```

---

## 5. Running the Project

### Backend Commands

```bash
cd backend

# Production mode
npm start

# Development mode (with nodemon auto-reload)
npm run dev

# Run database migrations
npm run migrate

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Frontend Commands

```bash
cd frontend

# Development server with HMR
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint
```

### Port Assignments

| Service | Port | Purpose |
|---------|------|---------|
| Backend API | 3002 | Express.js REST API |
| Frontend Dev | 5173 | Vite development server |
| PostgreSQL | 5432 | Database (docker-compose) |
| Redis | 6379 | Cache (docker-compose) |

### Full Stack Development

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev

# Terminal 3 — Run tests (optional)
cd backend
npm run test:watch
```

---

## 6. Architecture Overview

### Directory Structure

```
AgentID/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   │   └── index.js       # Central config module
│   │   ├── middleware/        # Express middleware
│   │   │   ├── errorHandler.js
│   │   │   └── rateLimit.js
│   │   ├── models/            # Data access layer
│   │   │   ├── db.js          # PostgreSQL connection
│   │   │   ├── redis.js       # Redis client
│   │   │   ├── queries.js     # All DB queries
│   │   │   └── migrate.js     # Schema migrations
│   │   ├── routes/            # API route handlers
│   │   │   ├── register.js    # Agent registration
│   │   │   ├── verify.js      # PKI challenge-response
│   │   │   ├── badge.js       # Badge endpoints
│   │   │   ├── reputation.js  # Reputation scoring
│   │   │   ├── agents.js      # Agent CRUD & listing
│   │   │   ├── attestations.js # Flags & attestations
│   │   │   └── widget.js      # Widget serving
│   │   ├── services/          # Business logic layer
│   │   │   ├── bagsAuthVerifier.js  # Bags API integration
│   │   │   ├── bagsReputation.js    # 5-factor scoring
│   │   │   ├── pkiChallenge.js      # Ed25519 challenges
│   │   │   ├── saidBinding.js       # SAID protocol
│   │   │   └── badgeBuilder.js      # Badge generation
│   │   └── utils/             # Utility functions
│   │       └── transform.js   # Data transformations
│   └── tests/                 # Jest test suites
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Route pages
│   │   ├── lib/               # API client
│   │   └── widget/            # Widget components
│   └── public/                # Static assets
└── docker-compose.yml         # Infrastructure definition
```

### Request Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Vite Dev    │────▶│   Express   │
│  (Browser)  │     │   Server     │     │    API      │
│             │     │  (Port 5173) │     │ (Port 3002) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       │                        │                        │
                       ▼                        ▼                        ▼
                ┌─────────────┐        ┌─────────────┐        ┌─────────────────┐
                │  Middleware │        │   Routes    │        │    Services     │
                │  - Helmet   │───────▶│  - /register│───────▶│  - bagsAuth     │
                │  - CORS     │        │  - /verify  │        │  - bagsReputation│
                │  - RateLimit│        │  - /badge   │        │  - pkiChallenge │
                │  - JSON     │        │  - /agents  │        │  - saidBinding  │
                └─────────────┘        │  - /widget  │        │  - badgeBuilder │
                                       └─────────────┘        └────────┬────────┘
                                                                       │
                                                ┌──────────────────────┼──────┐
                                                │                      │      │
                                                ▼                      ▼      ▼
                                         ┌──────────┐          ┌──────────┐ ┌────────┐
                                         │PostgreSQL│          │  Redis   │ │Bags API│
                                         │          │          │          │ │SAID GW │
                                         │- Agents  │          │- Caching │ │        │
                                         │- Verifications│      │- Sessions│ │        │
                                         │- Flags   │          │          │ │        │
                                         └──────────┘          └──────────┘ └────────┘
```

### Service Layer

| Service | Purpose | Key Functions |
|---------|---------|---------------|
| `bagsAuthVerifier.js` | Wraps Bags authentication flow | `initBagsAuth()`, `completeBagsAuth()`, `verifyBagsSignature()` |
| `bagsReputation.js` | Computes 5-factor reputation score | `computeBagsScore()`, `refreshAndStoreScore()` |
| `pkiChallenge.js` | Ed25519 challenge-response PKI | `issueChallenge()`, `verifyChallenge()` |
| `saidBinding.js` | SAID Protocol integration | `registerWithSAID()`, `getSAIDTrustScore()`, `discoverSAIDAgents()` |
| `badgeBuilder.js` | Generates trust badges | `getBadgeJSON()`, `getBadgeSVG()`, `getWidgetHTML()` |

### Route Layer

| Route File | Endpoints | Purpose |
|------------|-----------|---------|
| `register.js` | `POST /register` | Agent registration with Bags auth + SAID binding |
| `verify.js` | `POST /verify/challenge`, `POST /verify/response` | PKI challenge-response flow |
| `badge.js` | `GET /badge/:pubkey`, `GET /badge/:pubkey/svg` | Trust badge retrieval |
| `reputation.js` | `GET /reputation/:pubkey` | Full reputation breakdown |
| `agents.js` | `GET /agents`, `GET /agents/:pubkey`, `GET /discover` | Agent listing and discovery |
| `attestations.js` | `POST /agents/:pubkey/attest`, `POST /flag` | Attestations and flagging |
| `widget.js` | `GET /widget/:pubkey` | Embeddable widget HTML |

### Model Layer

| File | Purpose |
|------|---------|
| `db.js` | PostgreSQL connection pool using `pg` |
| `redis.js` | Redis client using `ioredis` |
| `queries.js` | All parameterized SQL queries (404 lines) |
| `migrate.js` | Database schema creation and migrations |

---

## 7. Testing

### Running Tests

```bash
cd backend

# Run all tests once
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run specific test file
npx jest tests/pkiChallenge.test.js

# Run with coverage
npx jest --coverage
```

### Test Files

| File | Coverage |
|------|----------|
| `bagsReputation.test.js` | 5-factor scoring algorithm, label thresholds, graceful degradation |
| `pkiChallenge.test.js` | Ed25519 challenge issuance, signature verification, expiration handling |
| `transform.test.js` | Snake-to-camel conversion, HTML escaping, Solana address validation |

### Mocking Patterns

The project uses Jest's `jest.mock()` for CommonJS modules:

```javascript
// Example from bagsReputation.test.js
jest.mock('../src/models/queries', () => ({
  getAgent: jest.fn(),
  getAgentActions: jest.fn(),
  getUnresolvedFlagCount: jest.fn(),
  updateBagsScore: jest.fn(),
}));

jest.mock('../src/services/saidBinding', () => ({
  getSAIDTrustScore: jest.fn(),
}));

jest.mock('axios');
```

### Adding New Tests

```javascript
// tests/myFeature.test.js
const { myFunction } = require('../src/services/myService');

// Mock dependencies
jest.mock('../src/models/queries', () => ({
  someQuery: jest.fn(),
}));

describe('My Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    // Arrange
    const mockData = { /* ... */ };
    require('../src/models/queries').someQuery.mockResolvedValue(mockData);

    // Act
    const result = await myFunction('input');

    // Assert
    expect(result).toEqual(expected);
  });
});
```

---

## 8. Key Concepts

### Ed25519 PKI Challenge-Response

AgentID uses Ed25519 digital signatures for cryptographic identity verification:

```
┌─────────────┐                    ┌─────────────┐
│   Client    │──1. Request───────▶│   Server    │
│  (Agent)    │    Challenge       │             │
│             │◀──2. Returns───────│             │
│             │    {nonce,         │             │
│             │     challenge,     │             │
│             │     expiresIn}     │             │
│             │                    │             │
│             │──3. Signs with────▶│             │
│             │    private key     │             │
│             │◀──4. Verifies──────│             │
│             │    with public key │             │
└─────────────┘                    └─────────────┘
```

**Challenge Format:**
```
AGENTID-VERIFY:{pubkey}:{nonce}:{timestamp}
```

**Implementation:** See [`pkiChallenge.js`](backend/src/services/pkiChallenge.js)

### Bags Auth Flow Integration

AgentID wraps the Bags.fm agent authentication system:

1. **Init:** Call Bags API to get challenge message
2. **Sign:** Agent signs message with Ed25519 private key
3. **Verify:** AgentID verifies signature locally using `tweetnacl`
4. **Callback:** Submit to Bags API to complete auth
5. **Store:** Save `bags_api_key_id` for future reference

**Implementation:** See [`bagsAuthVerifier.js`](backend/src/services/bagsAuthVerifier.js)

### SAID Protocol Binding

SAID (Solana Agent Identity) provides cross-platform agent discovery:

```javascript
// Registration payload sent to SAID Gateway
{
  pubkey,
  timestamp,
  signature,
  name,
  description,
  capabilities,
  bags_binding: {
    tokenMint,
    bags_wallet: pubkey,
    agentid_registered_at: ISOString,
    capability_set: capabilities
  }
}
```

**Implementation:** See [`saidBinding.js`](backend/src/services/saidBinding.js)

### Reputation Scoring Algorithm

The 5-factor scoring model (0-100 points):

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Fee Activity | 30 pts | `min(30, floor(totalFeesSOL * 10))` |
| Success Rate | 25 pts | `(successful / total) * 25` |
| Registration Age | 20 pts | `min(20, daysSinceRegistration)` |
| SAID Trust | 15 pts | `(saidScore / 100) * 15` |
| Community | 10 pts | 0 flags = 10, 1 flag = 5, 2+ = 0 |

**Trust Labels:**
- `HIGH` (≥80): Established, trusted agent
- `MEDIUM` (60-79): Verified agent with moderate history
- `LOW` (40-59): New or limited activity agent
- `UNVERIFIED` (<40): Insufficient data or flagged

**Implementation:** See [`bagsReputation.js`](backend/src/services/bagsReputation.js)

### Badge Generation Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Agent Data │───▶│  Reputation │───▶│   Format    │───▶│   Output    │
│   (DB)      │    │   Score     │    │  Selection  │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
              ┌──────────┐          ┌──────────┐          ┌──────────┐
              │   JSON   │          │   SVG    │          │   HTML   │
              │          │          │          │          │          │
              │/badge/:id│          │/badge/:id│          │/widget/:id│
              │          │          │/svg      │          │          │
              └──────────┘          └──────────┘          └──────────┘
```

**Caching:** Badge data is cached in Redis for 60 seconds (configurable via `BADGE_CACHE_TTL`).

**Implementation:** See [`badgeBuilder.js`](backend/src/services/badgeBuilder.js)

---

## 9. AgentID 2.0 Features

### Authentication Flow

AgentID 2.0 introduces JWT cookie-based authentication alongside the existing Ed25519 PKI system.

#### JWT Session Flow

```
┌─────────────┐     POST /auth/login      ┌─────────────┐
│   Client    │ ────────────────────────▶ │   Server    │
│  (Browser)  │    { email, password }    │             │
│             │ ◀──────────────────────── │             │
│             │    Set-Cookie: token=     │             │
│             │    Set-Cookie: refresh=   │             │
└─────────────┘                           └─────────────┘
```

**Access Token:** Short-lived JWT (default 15 minutes) stored in an `httpOnly`, `Secure`, `SameSite=strict` cookie.

**Refresh Token:** Long-lived token (default 7 days) stored in a separate `httpOnly` cookie. Used to silently obtain new access tokens via `POST /auth/refresh`.

**Token Rotation:** Every refresh generates new access and refresh tokens, invalidating the previous refresh token. This mitigates replay attacks from stolen cookies.

#### API Key Alternative

For programmatic access (CI/CD, server-to-server), use API keys:

1. Generate an API key via `POST /api-keys` (requires JWT auth)
2. Include the key in the `X-API-Key` header for subsequent requests
3. Keys are scoped to an organization and can be limited by `scopes` and `expiresAt`

```bash
curl https://agentid2.provenanceai.network/orgs/org-uuid/agents \
  -H "X-API-Key: aid_abc123xyz789secret"
```

#### Middleware Stack

| Middleware | Purpose |
|------------|---------|
| `authenticate` | Validates JWT cookie or `X-API-Key` header, attaches `req.user` |
| `authorize` | Checks `req.user.role` against required role for the endpoint |
| `orgContext` | Ensures `req.user.orgId` matches the route's `:orgId` parameter |

---

### Multi-Tenancy Model

AgentID 2.0 is built around an **organization-centric multi-tenant architecture**.

#### Organization Isolation

Every user belongs to exactly one organization. All agents, audit logs, policies, and webhooks are scoped to that organization via `org_id`.

```sql
-- Every v2 table includes org_id for tenant isolation
SELECT * FROM agent_identities WHERE org_id = 'org-uuid-1234';
```

#### Role Hierarchy

| Role | Permissions |
|------|-------------|
| `viewer` | Read-only access to org data, agents, audit logs |
| `member` | Can register agents, create API keys, view everything |
| `manager` | Can invite users, manage policies/webhooks, update org settings |
| `admin` | Full control: manage members, delete org resources, billing |

Roles are enforced by the `authorize` middleware:

```javascript
// Example route protection
router.put('/orgs/:orgId', authenticate, authorize('manager'), orgContext, updateOrg);
```

#### Tenant Filtering

All service-layer functions that query v2 data automatically filter by `org_id`:

```javascript
// src/services/orgService.js
async function getOrgAgents(orgId, filters) {
  return queries.getAgentsByOrg(orgId, filters);
}
```

---

### Audit System

The audit system provides tamper-evident logging for all mutating operations.

#### Hash Chain Integrity

Each audit log entry includes a SHA-256 hash that chains to the previous entry:

```
Entry 1: hash = SHA256(entry_data + "0")
Entry 2: hash = SHA256(entry_data + Entry1.hash)
Entry 3: hash = SHA256(entry_data + Entry2.hash)
```

This creates a sequential chain. Any modification to a historical entry breaks all subsequent hashes, detectable via `GET /orgs/:orgId/audit/verify`.

#### Risk Scoring

Every audited action receives an automatic risk score (0-100):

| Action | Base Risk | Factors |
|--------|-----------|---------|
| `AGENT_REGISTERED` | 10 | +20 if from new IP, +10 if high-reputation agent |
| `USER_LOGIN` | 5 | +15 if unusual geo, +10 if failed attempts > 3 |
| `POLICY_VIOLATION` | 30 | +20 if auto-remediation triggered |
| `MEMBER_REMOVED` | 25 | +10 if by non-admin |

#### Compliance Mapping

Audit entries are tagged with compliance frameworks:

- **SOC 2 Type II:** All authentication and access-control events
- **ISO 27001:** Policy changes and member role modifications
- **GDPR:** Data export and deletion events

Export audit logs in CSV format for compliance auditors:

```bash
curl "https://agentid2.provenanceai.network/orgs/org-uuid/audit/export?format=csv" \
  -H "Cookie: token=..." \
  --output soc2-audit.csv
```

---

### Event System

AgentID 2.0 includes a real-time event bus for reactive automation.

#### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `agent.registered` | New agent registered | `{ pubkey, name, orgId }` |
| `agent.verified` | PKI challenge completed | `{ pubkey, timestamp }` |
| `agent.flagged` | Agent status changed to flagged | `{ pubkey, reason, flags }` |
| `agent.revoked` | Agent revoked by policy or admin | `{ pubkey, revokedBy }` |
| `policy.violation` | Policy condition matched | `{ policyId, agentId, condition }` |
| `user.invited` | New user invited to org | `{ email, role, invitedBy }` |
| `audit.high_risk` | Risk score exceeded threshold | `{ logId, score, action }` |

#### Policy Engine

The policy engine listens for events and evaluates conditions in real time:

```javascript
// Example policy: auto-revoke if bags_score < 50
{
  name: "Auto-revoke low reputation",
  condition: "bags_score < 50",
  action: "revoke_agent",
  enabled: true
}
```

When `agent.verified` or scheduled score updates trigger the condition, the action executes automatically.

#### Webhook Delivery

Webhooks are delivered with an `X-Webhook-Signature` HMAC-SHA256 header for verification:

```javascript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

Delivery is retried up to 3 times with exponential backoff for non-2xx responses.

---

### Getting Started with 2.0

Follow this checklist to set up your first AgentID 2.0 organization:

#### 1. Register an Account

```bash
curl -X POST https://agentid2.provenanceai.network/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "SecurePass123!",
    "name": "Your Name",
    "orgName": "Your Org"
  }'
```

This creates your user account and initial organization in one step.

#### 2. Log In

```bash
curl -X POST https://agentid2.provenanceai.network/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt
```

The server sets `httpOnly` cookies. Use `-b cookies.txt` in subsequent `curl` commands.

#### 3. Register Your First Agent

Agents registered while authenticated are automatically scoped to your organization:

```bash
curl -X POST https://agentid2.provenanceai.network/register \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pubkey": "YourAgentPubkey...",
    "name": "My First Agent",
    "signature": "Base58Signature...",
    "message": "...",
    "nonce": "..."
  }'
```

#### 4. View the Dashboard

Open `https://agentid2.provenanceai.network` in your browser and log in. The dashboard shows:

- Organization overview and stats
- Agent registry with trust scores
- Audit log timeline
- Policy and webhook configuration

#### 5. Invite Team Members

```bash
curl -X POST https://agentid2.provenanceai.network/orgs/your-org-id/invite \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "teammate@example.com",
    "role": "member"
  }'
```

---

## 10. Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production `DATABASE_URL`
- [ ] Configure production `REDIS_URL`
- [ ] Set strong `BAGS_API_KEY`
- [ ] Update `CORS_ORIGIN` to production domain
- [ ] Update `AGENTID_BASE_URL` to public URL
- [ ] Increase `BADGE_CACHE_TTL` (e.g., 300 seconds)
- [ ] Enable SSL/TLS
- [ ] Configure log aggregation
- [ ] Set up monitoring/alerting

### PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'agentid-api',
    script: './backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
};
```

Run with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name agentid2.provenanceai.network;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name agentid2.provenanceai.network;

    ssl_certificate /etc/letsencrypt/live/api.agentid.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.agentid.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.agentid.io

# Auto-renewal test
sudo certbot renew --dry-run
```

### Frontend Build and Static Serving

```bash
cd frontend
npm run build

# Serve with Nginx
# Copy dist/ contents to /var/www/agentid/
```

Nginx static file configuration:
```nginx
server {
    listen 80;
    server_name agentid2.provenanceai.network;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name agentid2.provenanceai.network;

    ssl_certificate /etc/letsencrypt/live/agentid.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agentid.io/privkey.pem;

    root /var/www/agentid;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 11. Contributing

### Code Style

- **Module System:** CommonJS (`require`/`module.exports`)
- **Framework:** Express.js with async/await
- **Naming:** camelCase for variables/functions, PascalCase for classes
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Indentation:** 2 spaces

### Project Patterns

**Adding a New Route:**

```javascript
// src/routes/myFeature.js
const express = require('express');
const router = express.Router();
const myService = require('../services/myService');

router.get('/my-endpoint', async (req, res, next) => {
  try {
    const result = await myService.doSomething();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

Then register in `server.js`:
```javascript
const myFeatureRoutes = require('./src/routes/myFeature');
app.use('/', myFeatureRoutes);
```

**Adding a New Service:**

```javascript
// src/services/myService.js
const queries = require('../models/queries');

async function myFunction(param) {
  // Implementation
  return result;
}

module.exports = {
  myFunction
};
```

**Adding a Database Query:**

```javascript
// src/models/queries.js
async function myNewQuery(param) {
  const sql = 'SELECT * FROM table WHERE column = $1';
  const result = await query(sql, [param]);
  return result.rows;
}

// Add to module.exports
module.exports = {
  // ... existing exports
  myNewQuery
};
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Ensure all tests pass: `npm test`
4. Update documentation if needed
5. Submit PR with clear description
6. Request review from maintainers

### Development Workflow

```bash
# Start feature branch
git checkout -b feature/new-capability

# Make changes, write tests
cd backend
npm run test:watch  # Keep tests running

# Before committing
npm test            # Full test run
npm run lint        # If available

# Commit and push
git add .
git commit -m "feat: add new capability endpoint"
git push origin feature/new-capability
```

---

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: David Cooper (CCIE #14019)

---

## License

MIT License — See [LICENSE](../LICENSE) for details.
