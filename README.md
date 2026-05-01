# Countersig 2.0

**Universal Non-Human Identity (NHI) Platform for AI Agents**

[![Live App](https://img.shields.io/badge/Live-countersig.com-blue)](https://countersig.com)
[![API](https://img.shields.io/badge/API-api.countersig.com-green)](https://api.countersig.com/health)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

This repository contains public documentation, SDK integration guides, and conceptual architecture for Countersig.

Countersig 2.0 is a production-grade identity and trust platform purpose-built for autonomous AI agents. It provides verifiable identity, multi-chain credential binding, reputation scoring, and machine-to-machine authentication — enabling agents to prove who they are, what they can do, and why they should be trusted.

> **Note:** For source code access, see the private repository. This repo contains public documentation, integration guides, and conceptual architecture.

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
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 Client Layer                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Frontend SPA │ │ Embed Widget │ │ SDK/CLI  │ │   MCP    │ │  A2A Clients │    │
│  │ (React+Vite) │ │ (iframe/JS)  │ │ (JS/TS)  │ │ (Claude) │ │   (JWKS)     │    │
│  │countersig.com│ │              │ │          │ │          │ │              │    │
│  └──────┬───────┘ └──────┬───────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘    │
└─────────┼────────────────┼──────────────┼────────────┼──────────────┼────────────┘
          └────────────────┴──────────────┴────────────┴──────────────┘
                                          │
                             ┌────────────▼────────────┐
                             │  API Gateway: Caddy 2   │
                             │  Auto-SSL, Rate Limiting│
                             └────────────┬────────────┘
                                          │
┌─────────────────────────────────────────▼─────────────────────────────────────────┐
│                          Backend API (Express 4)                                   │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                        Pluggable Auth Layer                                   │  │
│  │  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐        │  │
│  │  │Cryptographic│ │ OAuth2/ │ │Google OAuth│ │ Entra ID │ │ API Keys │        │  │
│  │  │ (Ed25519)  │ │  OIDC   │ │            │ │(Azure AD)│ │  (M2M)   │        │  │
│  │  └─────┬──────┘ └────┬────┘ └─────┬──────┘ └────┬─────┘ └────┬─────┘        │  │
│  │  ┌─────┴──────────────┴────────────┴─────────────┴────────────┴────────────┐  │  │
│  │  │                   AuthManager (Strategy Router)                          │  │  │
│  │  └───────────────────────────────────┬─────────────────────────────────────┘  │  │
│  │  ┌────────────┐ ┌──────────────┐     │     ┌─────────────┐                    │  │
│  │  │  A2A JWT   │ │PKI Challenge │     │     │ Human Auth  │                    │  │
│  │  │  (60s)     │ │  (Nonce)     │     │     │ (bcrypt-12) │                    │  │
│  │  └────────────┘ └──────────────┘     │     └─────────────┘                    │  │
│  └──────────────────────────────────────┼────────────────────────────────────────┘  │
│                                         │                                          │
│  ┌──────────────────────────────────────┼────────────────────────────────────────┐  │
│  │                        Service Layer │                                         │  │
│  │  ┌────────────┐ ┌─────────────┐ ┌────┴───────┐ ┌──────────────┐                │  │
│  │  │Agent Mgmt  │ │   Policy    │ │   RBAC     │ │  Audit       │                │  │
│  │  │ (DID/VC)   │ │   Engine    │ │            │ │ (hash chain) │                │  │
│  │  └────────────┘ └─────────────┘ └────────────┘ └──────────────┘                │  │
│  │  ┌────────────┐ ┌─────────────┐ ┌────────────┐                                 │  │
│  │  │ Reputation │ │Badge Builder│ │  Webhook   │                                 │  │
│  │  │  Scoring   │ │             │ │ (BullMQ)   │                                 │  │
│  │  └────────────┘ └─────────────┘ └────────────┘                                 │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                          │
└─────────────────────────────────────────┼──────────────────────────────────────────┘
                                          │
                             ┌────────────▼────────────┐
                             │       Data Layer        │
                             │ PostgreSQL 16 │ Redis 7 │
                             └────────────┬────────────┘
                                          │
                             ┌────────────▼────────────┐
                             │    External Services    │
                             │ Stripe Billing          │
                             │ URLhaus Threat Feed     │
                             └─────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6, TailwindCSS |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16, Redis 7 |
| Auth | JWT (Ed25519 + HMAC-SHA256), OAuth2/OIDC |
| Deployment | Docker Compose, Caddy 2 (auto-SSL) |
| Queue | BullMQ (webhook delivery) |
| Monitoring | prom-client (Prometheus metrics) |
| Hosting | Hostinger CDN (frontend), VPS (backend) |

## Getting Started

This is a documentation and concepts repository. To integrate with Countersig, use the published client libraries below or explore the [API Reference](docs/API_REFERENCE.md).

For deployment and self-hosting guides, see [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

## Billing & Plans

Countersig 2.0 includes integrated billing and plan management via **Stripe**:

| Tier | Price | Included |
|------|-------|----------|
| **Free** | $0/mo | Basic agent registration and verification, 10 whitelist destinations |
| **Starter** | $29/mo | Higher quotas, API key access, audit logs, 50 whitelist destinations |
| **Professional** | $99/mo | Full platform access, advanced policies, priority support, 500 whitelist destinations |
| **Enterprise** | Custom | Dedicated infrastructure, SLAs, custom integrations, unlimited whitelist destinations |

**Usage-based metering** tracks attestations, verifications, badge calls, and token issuances against plan quotas. Stripe handles payment processing, and users can manage their plan via the **/settings** page in the frontend.

## API Documentation

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for the complete API reference, or visit the [live API docs](https://countersig.com/docs).

## Client Libraries

Now live on npm:

| Package | Version | Install | Description |
|---------|---------|---------|-------------|
| [@countersig/sdk](https://www.npmjs.com/package/@countersig/sdk) | 1.0.0 | `npm install @countersig/sdk` | TypeScript SDK for all Countersig operations |
| [@countersig/mcp](https://www.npmjs.com/package/@countersig/mcp) | 1.0.0 | `npm i -g @countersig/mcp` | MCP server for Claude Code / Claude Desktop |
| @countersig/verify | 1.0.0 | `npm install @countersig/verify` | Lightweight A2A token verification |
| [@countersig/react](https://www.npmjs.com/package/@countersig/react) | 1.0.1 | `npm install @countersig/react` | React components — trust badges, reputation displays, capability lists |

### Quick Start with Claude

```bash
# Install globally
npm install -g @countersig/mcp

# Add to Claude
claude mcp add countersig -- countersig-mcp
```

Then ask Claude: "Register a new agent called my-assistant with text-generation capabilities"

## Developer Guide

See [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for architecture details, multi-chain integration, enterprise auth setup, and SDK usage.

## License

[MIT](LICENSE)
