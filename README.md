# AgentID 2.0

**Universal Identity for AI Agents**

AgentID is a production-grade identity, verification, and reputation platform for AI agents. It provides wallet-signed registration, W3C Verifiable Credentials, multi-chain support, and enterprise authentication — all in one platform.

![AgentID Logo](AgentIDLogo.png)

## What AgentID Does

- **Identity Issuance** — Register AI agents with cryptographic identity (Ed25519, OAuth2, Entra ID, API Keys)
- **Verification** — Challenge-response proof of ownership, W3C Verifiable Credentials, DID documents
- **Reputation** — Multi-dimensional trust scoring across chains and organizations
- **Multi-Chain** — Solana, Ethereum, Base, Polygon support
- **Enterprise Ready** — RBAC, audit logs with hash chaining, policy engine, webhooks, Stripe billing

## Live Platform

- **Website:** [agentidapp.com](https://agentidapp.com)
- **API:** [api.agentidapp.com](https://api.agentidapp.com)
- **Interactive Demo:** [agentidapp.com/demo](https://agentidapp.com/demo)
- **Pricing:** [agentidapp.com/pricing](https://agentidapp.com/pricing)

## Client Libraries

| Package | Description | Install |
|---------|-------------|---------|
| [@agentidapp/sdk](https://www.npmjs.com/package/@agentidapp/sdk) | TypeScript SDK | `npm install @agentidapp/sdk` |
| [@agentidapp/mcp](https://www.npmjs.com/package/@agentidapp/mcp) | MCP Server for Claude | `npx -y @agentidapp/mcp` |
| [@agentidapp/react](https://www.npmjs.com/package/@agentidapp/react) | React Components | `npm install @agentidapp/react` |
| [@agentidapp/verify](https://www.npmjs.com/package/@agentidapp/verify) | Standalone Verifier | `npm install @agentidapp/verify` |

## Quick Start with Claude

```bash
claude mcp add agentid -- npx -y @agentidapp/mcp
```

Then ask Claude: "List all registered agents" or "Register a new agent called my-bot"

## Quick Start with SDK

```typescript
import { AgentIDClient } from '@agentidapp/sdk';

const client = new AgentIDClient({
  baseUrl: 'https://api.agentidapp.com'
});

// List verified agents
const agents = await client.listAgents();

// Get agent reputation
const rep = await client.getReputation(agentPublicKey);
```

## Documentation

- [API Reference](docs/API_REFERENCE.md)
- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [Trustmark Integration Guide](docs/DEVELOPER_GUIDE_TRUSTMARK.md)
- [Widget Guide](docs/WIDGET_GUIDE.md)
- [Agent Owner Guide](docs/AGENT_OWNER_GUIDE.md)
- [Migration Guide](docs/MIGRATION_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Architecture

AgentID provides three core capabilities:

1. **Identity Issuer** — Wallet-signed registration, W3C Verifiable Credentials, JWKS endpoint, did:web document, multi-chain support (Solana BAGS, Solana generic, Ethereum, Base, Polygon)
2. **Management Plane** — Organizations, RBAC, API keys with scopes, audit logs with hash chaining, policy engine, webhooks, heartbeat monitoring, attestations and reputation scoring
3. **Integration Surface** — TypeScript SDK, MCP server, React components, standalone verify package, OpenAPI spec, Swagger UI

## Authentication Methods

| Method | Use Case |
|--------|----------|
| Ed25519 Cryptographic | Wallet-based agent registration |
| OAuth2 / OIDC | Enterprise SSO integration |
| Microsoft Entra ID | Azure workload identity |
| API Keys | Programmatic access with scopes |
| Agent-to-Agent (A2A) JWT | Inter-agent communication |
| PKI Challenge-Response | Cryptographic proof of ownership |

## Pricing

| Plan | Price | Attestations | Verifications | Badge Calls | A2A Tokens |
|------|-------|-------------|---------------|-------------|------------|
| Free | $0/mo | 100 | 50 | 500 | 100 |
| Starter | $29/mo | 5,000 | 1,000 | 10,000 | 1,000 |
| Professional | $99/mo | 50,000 | 10,000 | 100,000 | 10,000 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

See [agentidapp.com/pricing](https://agentidapp.com/pricing) for full details.

## License

MIT — see [LICENSE](LICENSE)

## Contact

- **Enterprise:** enterprise@agentidapp.com
- **Website:** [agentidapp.com](https://agentidapp.com)
