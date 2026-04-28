# AgentID 2.0

**Universal Non-Human Identity (NHI) Platform for AI Agents**

[![Live App](https://img.shields.io/badge/Live-agentidapp.com-blue)](https://agentidapp.com)
[![API](https://img.shields.io/badge/API-api.agentidapp.com-green)](https://api.agentidapp.com/health)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

AgentID 2.0 is a production-grade identity and trust platform purpose-built for autonomous AI agents. It provides verifiable identity, multi-chain credential binding, reputation scoring, and machine-to-machine authentication — enabling agents to prove who they are, what they can do, and why they should be trusted.

## Live Deployment

- **Frontend**: [agentidapp.com](https://agentidapp.com)
- **API**: [api.agentidapp.com](https://api.agentidapp.com/health)
- **Documentation**: [Wiki](https://github.com/RunTimeAdmin/AgentID-2.0/wiki)

## Key Features

### Authentication & Identity

AgentID 2.0 is built around a **pluggable, multi-provider authentication architecture** — not just crypto wallets. This is what distinguishes it from every other agent identity solution on the market.

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
│  │  agentidapp.com │  │               │  │              │  │              │  │
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
git clone https://github.com/RunTimeAdmin/AgentID-2.0.git
cd AgentID-2.0

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

## API Documentation

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for the complete API reference, or visit the [live API docs](https://agentidapp.com/docs).

## Developer Guide

See [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for architecture details, multi-chain integration, enterprise auth setup, and SDK usage.

## Production Deployment

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for production deployment with Docker Compose and Caddy reverse proxy.

```bash
# Production deployment
cp .env.production.example .env
# Edit .env with production secrets
docker-compose -f docker-compose.prod.yml up -d
```

## License

[MIT](LICENSE)
