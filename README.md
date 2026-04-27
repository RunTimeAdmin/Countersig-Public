# AgentID 2.0 — Non-Human Identity Manager for AI Agents

![Version](https://img.shields.io/badge/version-2.0.0--alpha.1-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)

## Vision

AgentID 2.0 discovers, inventories, and manages AI agent identities at enterprise scale. It provides cryptographic identity verification, multi-tenant organization support, role-based access control, and comprehensive audit logging — so humans can trust the agents they work with.

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   Nginx / CDN   │────▶│         React SPA (Vite)            │
└─────────────────┘     └─────────────────────────────────────┘
          │                           │
          │              ┌────────────▼────────────┐
          │              │   Express API (Node)    │
          │              └────────────┬────────────┘
          │                           │
          │     ┌─────────────────────┼─────────────────────┐
          │     │                     │                     │
          │     ▼                     ▼                     ▼
          │  AuthN / RBAC      Audit / Events        Policy Engine
          │     │                     │                     │
          │     └─────────────────────┼─────────────────────┘
          │                           │
          │              ┌────────────▼────────────┐
          │              │   PostgreSQL + Redis    │
          │              └─────────────────────────┘
          │                           │
          └───────────────────────────┘
```

## Features

- **Cryptographic Identity** — Ed25519 PKI challenges, SAID protocol binding
- **Multi-Tenant Organizations** — Org-scoped agents, users, and roles
- **RBAC** — Granular permissions for agents, users, and API keys
- **Audit Logging** — Immutable event stream for compliance
- **Policy Engine** — Custom trust and access policies
- **Badges & Widgets** — Embeddable trust badges for any agent

## Quick Start

```bash
# Clone the repository
git clone https://github.com/RunTimeAdmin/AgentID-2.0.git
cd AgentID-2.0

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Backend
cd backend
cp .env.example .env  # Configure secrets, database, Redis, API keys
npm install
npm run migrate       # Create database tables
npm start             # Starts on port 3002

# Frontend (separate terminal)
cd frontend
npm install
npm run dev           # Starts on port 5173
```

## Documentation

- [API Reference](docs/API_REFERENCE.md)
- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [Widget Guide](docs/WIDGET_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Repository

[https://github.com/RunTimeAdmin/AgentID-2.0](https://github.com/RunTimeAdmin/AgentID-2.0)

## License

MIT
