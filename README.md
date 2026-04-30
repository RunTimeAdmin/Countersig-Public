# Countersig 2.0

**Universal Non-Human Identity (NHI) Platform for AI Agents**

[![Live App](https://img.shields.io/badge/Live-countersig.com-blue)](https://countersig.com)
[![API](https://img.shields.io/badge/API-api.countersig.com-green)](https://api.countersig.com/health)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Countersig 2.0 is a production-grade identity and trust platform purpose-built for autonomous AI agents. It provides verifiable identity, multi-chain credential binding, reputation scoring, and machine-to-machine authentication — enabling agents to prove who they are, what they can do, and why they should be trusted.

## Live Deployment

- **Frontend**: [countersig.com](https://countersig.com)
- **API**: [api.countersig.com](https://api.countersig.com/health)
- **Documentation**: [Wiki](https://github.com/RunTimeAdmin/Countersig-Public/wiki)

## Key Features

### Authentication & Identity

Countersig 2.0 is built around a **pluggable, multi-provider authentication architecture** — not just crypto wallets. This is what distinguishes it from every other agent identity solution on the market.

| Provider | Purpose | Standard / Protocol |
|----------|---------|---------------------|
| **Cryptographic (Ed25519)** | Wallet-based agent identity for blockchain-native agents | Challenge-response signature verification |
| **OAuth2 / OIDC** | Enterprise SSO for managed AI agents | OpenID Connect with config-driven issuers & audiences |
| **Microsoft Entra ID** | Azure workload identity for enterprise AI deployments | Entra ID Workload Identity Federation (tenant-aware) |
| **API Keys** | Programmatic machine-to-machine access | SHA-256 hashed keys with prefix matching & org scoping |
| **Agent-to-Agent (A2A)** | Direct agent-to-agent trust verification | Short-lived JWT (60s) with JWKS public-key distribution |
| **PKI Challenge-Response** | Ongoing cryptographic proof of identity | Nonce-based challenge with replay prevention |

**Additional security hardening:**
- Human user auth with bcrypt-12 password hashing, access/refresh token rotation, and Redis-backed session management
- Account lockout after 5 failed attempts (15-minute cooldown)
- Tamper-evident hash-chain audit logging
- Multi-tenant RBAC with org-scoped API keys
- Rate limiting per endpoint category

### Platform Features

- **Multi-Chain Identity** — Solana, EVM (Ethereum / Base / Polygon), and chain-agnostic agent registration
- **W3C DID/VC Credentials** — Standards-compliant Decentralized Identifiers and Verifiable Credentials
- **Trust & Reputation** — Multi-dimensional reputation scoring with on-chain attestations and community flagging
- **Organization Management** — Multi-tenant RBAC with fine-grained permissions and API key scoping
- **Embeddable Widget** — Drop-in trust badge for any website (React, vanilla JS, or iframe)
- **Audit System** — Tamper-evident hash-chain audit logging for compliance
- **Policy Engine** — Configurable automated policy enforcement with dynamic trust evaluation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Frontend SPA   │  │  Embed Widget │  │  SDK / CLI   │  │  A2A Clients │  │
│  │  (React + Vite) │  │  (iframe/JS)  │  │  (JS/TS)     │  │  (JWKS)      │  │
│  │  countersig.com │  │               │  │              │  │              │  │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└───────────┼──────────────────┼─────────────────┼─────────────────┼──────────┘
            │                  │                 │                 │
            └──────────────────┴─────────────────┴─────────────────┘
                                           │
                              ┌────────────▼────────────┐
                              │    Caddy (Auto-SSL)     │
                              │    Rate Limiting        │
                              └────────────┬────────────┘
                                           │
┌──────────────────────────────────────────▼──────────────────────────────────┐
│                           Backend API (Express)                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     Pluggable Auth Layer                                 │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │  │
│  │  │ Cryptographic│ │  OAuth2/   │ │  Entra ID   │ │   API Key   │        │  │
│  │  │ (Ed25519)   │ │   OIDC     │ │ (Azure AD)  │ │  (M2M)      │        │  │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘        │  │
│  │  ┌──────┴───────────────┴───────────────┴───────────────┴─────────────┐  │  │
│  │  │                    AuthManager (Strategy Router)                     │  │  │
│  │  └────────────────────────────────────┬────────────────────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐      │      ┌─────────────┐             │  │
│  │  │  A2A JWT    │ │ PKI Challenge│      │      │ Human Auth  │             │  │
│  │  │  (60s)      │ │ (Nonce)      │      │      │ (bcrypt-12) │             │  │
│  │  └─────────────┘ └─────────────┘      │      └─────────────┘             │  │
│  └────────────────────────────────────────┼──────────────────────────────────┘  │
│                                           │                                   │
│  ┌────────────────────────────────────────┼──────────────────────────────────┐  │
│  │           Service Layer                │                                   │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────┴─────────┐ ┌─────────────┐         │  │
│  │  │ Agent Mgmt  │ │   Policy    │ │   RBAC /     │ │  Chain      │         │  │
│  │  │ (DID/VC)    │ │   Engine    │ │   Audit      │ │  Adapters   │         │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘ └─────────────┘         │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                      │
└───────────────────────────────────────────┼──────────────────────────────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │     Data Layer            │
                              │  PostgreSQL 16 │ Redis 7  │
                              └───────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, TailwindCSS |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16, Redis 7 |
| Auth | JWT, HMAC-SHA256, OAuth2/OIDC |
| Deployment | Docker Compose, Caddy 2 (auto-SSL) |
| Hosting | Hostinger CDN (frontend), VPS (backend) |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/RunTimeAdmin/Countersig.git
cd Countersig

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Backend
cd backend
cp .env.example .env  # Configure environment variables
npm install
npm run migrate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

## Production Deployment

> For a complete production deployment walkthrough, see [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `REDIS_HOST` | Explicit Redis host (recommended for Docker) |
| `REDIS_PORT` | Explicit Redis port (recommended for Docker) |
| `REDIS_PASSWORD` | Explicit Redis password (recommended for Docker) |
| `JWT_SECRET` | 64-char hex secret for token signing |
| `JWT_EXPIRY` | Access token lifetime (default: 15m) |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime (default: 7d) |
| `BAGS_API_KEY` | BAGS reputation API key |
| `CORS_ORIGIN` | Allowed frontend origin (e.g. `https://countersig.com`) |
| `COUNTERSIG_BASE_URL` | Public API URL (e.g. `https://api.countersig.com`) |
| `PORT` | Server port (default: 3002) |
| `NODE_ENV` | `production` |
| `DB_SSL` | Set to `"true"` only for hosted databases with SSL |
| `OAUTH2_ENABLED` | Optional auth provider flag |
| `ENTRA_ID_ENABLED` | Optional auth provider flag |
| `HEALTH_DETAIL_SECRET` | Secret for detailed health check endpoint (any strong random string) |
| `COOKIE_DOMAIN` | Cookie domain scope for cross-subdomain auth (e.g., `.countersig.com`) |
| `DB_POOL_MAX` | PostgreSQL connection pool max size (default: 20) |
| `LEGACY_SIGNING_DEADLINE` | Unix timestamp after which legacy signatures are rejected (default: 2026-07-01) |
| `DID_ED25519_PUBLIC_KEY` | Ed25519 public key for DID document (required for production VCs) |

### Deploy Order

1. Provision PostgreSQL 16 and Redis 7
2. Set all environment variables
3. Run database migrations: `node src/models/migrate.js`
4. Start the API server: `node server.js`
5. Configure reverse proxy (Caddy or nginx) for HTTPS — reference `Caddyfile` in repo root

The production stack uses **Caddy** for automatic TLS termination and reverse proxying (see `Caddyfile` in repo root). Caddy handles HTTPS certificates automatically via Let's Encrypt and proxies API requests to the Node.js backend. To deploy the full stack:

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Secret Rotation

- **JWT_SECRET**: Rotation requires invalidating active sessions.
- **BAGS_API_KEY**: Can be rotated independently.

## Billing & Plans

Countersig 2.0 includes integrated billing and plan management via **Stripe**:

| Tier | Price | Included |
|------|-------|----------|
| **Free** | $0/mo | Basic agent registration and verification |
| **Starter** | $29/mo | Higher quotas, API key access, audit logs |
| **Professional** | $99/mo | Full platform access, advanced policies, priority support |
| **Enterprise** | Custom | Dedicated infrastructure, SLAs, custom integrations |

**Usage-based metering** tracks attestations, verifications, badge calls, and token issuances against plan quotas. Stripe handles payment processing, and users can manage their plan via the **/settings** page in the frontend.

Required environment variables for billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_ID`, `STRIPE_PRICE_PROFESSIONAL_ID`.

## API Documentation

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for the complete API reference, or visit the [live API docs](https://countersig.com/docs).

## Client Libraries

Now live on npm:

| Package | Version | Install | Description |
|---------|---------|---------|-------------|
| [@countersig/sdk](https://www.npmjs.com/package/@countersig/sdk) | 1.0.0 | `npm install @countersig/sdk` | TypeScript SDK for all Countersig operations |
| [@countersig/mcp](https://www.npmjs.com/package/@countersig/mcp) | 1.0.0 | `npx -y @countersig/mcp` | MCP server for Claude Code / Claude Desktop |
| @countersig/verify | 1.0.0 | `npm install @countersig/verify` | Lightweight A2A token verification |
| @countersig/react | Coming soon | — | React hooks and components |

### Quick Start with Claude

```bash
claude mcp add countersig -- npx -y @countersig/mcp
```

Then ask Claude: "Register a new agent called my-assistant with text-generation capabilities"

## Developer Guide

See [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for architecture details, multi-chain integration, enterprise auth setup, and SDK usage.

## License

[MIT](LICENSE)
