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

- **Multi-Chain Identity** — Solana, EVM (Ethereum/Base/Polygon), and chain-agnostic agent registration
- **W3C DID/VC Credentials** — Standards-compliant Decentralized Identifiers and Verifiable Credentials
- **A2A Authentication** — Agent-to-Agent token issuance and verification (JWKS endpoint)
- **Enterprise Auth** — Pluggable OAuth2/OIDC with Microsoft Entra ID / Workload Identity support
- **Trust & Reputation** — Multi-dimensional reputation scoring with attestations and flagging
- **Organization Management** — Multi-tenant RBAC with API key scoping
- **Embeddable Widget** — Drop-in trust badge for any website
- **Audit System** — Tamper-evident hash-chain audit logging
- **Policy Engine** — Configurable automated policy enforcement

## Architecture

```
┌─────────────────┐     ┌──────────────────────────┐
│  Frontend SPA   │────▶│  Backend API (Express)   │
│  (React + Vite) │     │  api.agentidapp.com      │
│  agentidapp.com │     ├──────────────────────────┤
└─────────────────┘     │  PostgreSQL 16 │ Redis 7  │
                        │  Caddy (Auto-SSL)        │
                        └──────────────────────────┘
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
