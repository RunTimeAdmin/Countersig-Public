# Why AgentID?

## The Problem: AI Agents Are Anonymous

Today's AI agents operate as black boxes. When Agent A calls Agent B's API, there's no way to know: Who built it? Is it authorized? Has it been reliable? Is it who it claims to be?

This is like the early web before SSL certificates — anyone could pretend to be anyone.

As agents proliferate (autonomous coding agents, trading bots, data pipelines, customer service agents), the trust problem becomes existential. Without verifiable identity, the agent economy cannot scale.

## What Happens Without Agent Identity

### 1. Agent-to-Agent Communication

Agent A calls Agent B's API. B has no way to verify A is legitimate.

- **Without identity:** B must either trust blindly (security risk) or block everything (usability dead end)
- **With AgentID:** B verifies A's cryptographic identity in milliseconds, checks reputation score, proceeds with confidence

### 2. Enterprise Compliance

Your company deploys 50 AI agents across departments. Auditor asks: "Which agents accessed customer data? When? Were they authorized?"

- **Without identity:** Shrug. No audit trail. Compliance failure.
- **With AgentID:** Every agent has a verifiable identity, every action is attested, hash-chained audit logs prove the complete history

### 3. Marketplace Trust

You're building an agent marketplace / registry. Users need to know: Is this agent verified? How reliable is it? Who's accountable?

- **Without identity:** Star ratings and reviews (easily gamed)
- **With AgentID:** Cryptographically-verified identity, W3C Verifiable Credentials, objective reputation scores based on actual performance

### 4. Multi-Chain / Cross-Platform

Agent operates across Solana, Ethereum, and enterprise APIs. Each platform has different auth — wallet signatures, OAuth, API keys.

- **Without identity:** Manage separate credentials per platform, no unified identity
- **With AgentID:** One identity, multiple auth methods, cross-chain reputation that follows the agent everywhere

### 5. Autonomous Agent Accountability

Agent runs autonomously — makes decisions, calls APIs, processes data. Something goes wrong. Who's responsible? What did the agent actually do?

- **Without identity:** Black box. No forensics.
- **With AgentID:** Complete attestation history, verifiable credentials, reputation impact from failures

## Who Needs This

### Agent Developers

- Register your agent once, get a cryptographic identity
- Build reputation through successful actions
- Earn trust badges that prove reliability
- Enable agent-to-agent communication with short-lived JWT tokens

### Enterprise Teams

- Deploy agents with organizational RBAC (admin/manager/member roles)
- Hash-chained audit logs for compliance
- Policy engine controlling what agents can do
- Webhook notifications for agent lifecycle events
- OAuth2 and Microsoft Entra ID integration

### Platform Builders

- Embed trust badges in your marketplace (SVG or JSON)
- Query reputation scores via API
- Verify agent identity with a single API call
- Rate-limit by identity instead of IP (more reliable)

### The Agents Themselves

- Prove identity to other agents cryptographically
- Issue and verify 60-second A2A tokens
- Build portable reputation that transfers across platforms
- Export W3C Verifiable Credentials as proof of status

## The AgentID Solution

| Capability | What It Does |
|-----------|-------------|
| **Cryptographic Identity** | Ed25519 keypair registration with challenge-response verification |
| **Multi-Auth Support** | Ed25519 wallets, OAuth2/OIDC, Microsoft Entra ID, API keys |
| **Reputation System** | BAGS score: Behavior, Activity, Governance, Security — earned through real actions |
| **Verifiable Credentials** | W3C standard VCs proving agent identity, status, and capabilities |
| **Trust Badges** | Embeddable SVG/JSON badges showing verification status and reputation tier |
| **Agent-to-Agent Tokens** | Short-lived JWTs (60s) for secure inter-agent communication |
| **Audit Trail** | Hash-chained action logs with tamper detection |
| **Organizations & RBAC** | Multi-agent management with role-based access control |
| **Policy Engine** | Configurable rules governing agent behavior and access |
| **Multi-Chain** | Solana, Ethereum, Base, Polygon — one identity across chains |

## How It Works (30-Second Version)

```
1. Register    →  Agent gets Ed25519 identity + public key published
2. Verify      →  Challenge-response proves key ownership
3. Operate     →  Agent attests actions, builds reputation
4. Communicate →  Issue A2A tokens, verify other agents
5. Prove       →  Export Verifiable Credentials, display trust badges
```

## Integration Options

Three ways to integrate, from simplest to most flexible:

**MCP Server (Easiest — Zero Code)**
```bash
claude mcp add agentid -- npx -y @agentidapp/mcp
```
Claude gets 12 AgentID tools. Register, verify, attest, communicate — all through conversation.

**TypeScript SDK (Full Control)**
```typescript
import { AgentIDClient } from '@agentidapp/sdk';
const client = new AgentIDClient({ baseUrl: 'https://api.agentidapp.com' });
const agents = await client.listAgents();
```

**REST API (Any Language)**
```bash
curl -H "Authorization: Bearer aid_xxx" https://api.agentidapp.com/agents
```

**React Components (Frontend)**
```tsx
import { TrustBadge, ReputationBreakdown } from '@agentidapp/react';
<TrustBadge agentId="..." />
```

## Pricing

| | Free | Starter ($29/mo) | Professional ($99/mo) | Enterprise |
|---|---|---|---|---|
| Attestations | 100 | 5,000 | 50,000 | Unlimited |
| Verifications | 50 | 1,000 | 10,000 | Unlimited |
| Badge Calls | 500 | 10,000 | 100,000 | Unlimited |
| A2A Tokens | 100 | 1,000 | 10,000 | Unlimited |
| Support | Community | Email | Priority | Dedicated |

Start free. Upgrade when you need scale.

## The Bottom Line

Every human on the internet has identity (accounts, certificates, credentials). Every website has identity (SSL, DNS, domain registration).

**AI agents are the only actors on the internet operating without verifiable identity.**

AgentID fixes that.

---

**Get Started:** [agentidapp.com/signup](https://agentidapp.com/signup) | [MCP Quick Start](MCP_QUICKSTART.md) | [API Reference](API_REFERENCE.md) | [Developer Guide](DEVELOPER_GUIDE.md)
