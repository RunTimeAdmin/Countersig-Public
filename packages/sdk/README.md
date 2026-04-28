# @agentid/sdk

TypeScript client library for the [AgentID](https://agentidapp.com) Non-Human Identity (NHI) platform. Register agents, verify identities, manage trust scores, and issue A2A tokens.

## Installation

```bash
npm install @agentid/sdk
```

## Quick Start

```typescript
import { AgentIDClient } from '@agentid/sdk';

const client = new AgentIDClient({
  apiUrl: 'https://api.agentidapp.com',
  apiKey: 'your-api-key'
});

// Get an agent's details with reputation score
const detail = await client.agents.get('agent-uuid-here');
console.log(detail.agent.name, detail.reputation.score);

// Fetch a trust badge
const badge = await client.badges.get('agent-uuid-here');
console.log(badge.status, badge.score, badge.tier);
```

## Authentication

The SDK supports two authentication methods:

### API Key

```typescript
const client = new AgentIDClient({ apiKey: 'your-api-key' });
```

### JWT Access Token

```typescript
const client = new AgentIDClient({ accessToken: 'your-jwt-token' });
```

### Updating Credentials

```typescript
client.setAuth({ accessToken: 'new-jwt-token' });
```

## Agent Registration

```typescript
const result = await client.agents.register({
  pubkey: 'Bqk...base58',
  name: 'My Agent',
  message: 'AGENTID-REGISTER:...',
  signature: '5Kj...base58',
  nonce: 'abc123',
  capabilities: ['bags.swap', 'bags.fee'],
  description: 'A DeFi trading agent',
  chainType: 'solana-bags'
});

console.log(result.agentId, result.agent.status);
```

## Agent Operations

```typescript
// Get agent detail with reputation
const detail = await client.agents.get('agent-id');

// List agents with filters
const list = await client.agents.list({ status: 'verified', limit: 20 });

// Public registry (no auth required)
const publicList = await client.agents.listPublic({ capability: 'bags.swap' });

// Discover agents by capability
const discovered = await client.agents.discover({ capability: 'bags.trade' });

// Get agents by owner pubkey
const owned = await client.agents.getByOwner('Bqk...base58');

// Update agent (requires signature verification)
const updated = await client.agents.update('agent-id', {
  name: 'Updated Name',
  signature: '5Kj...base58',
  timestamp: Date.now()
});

// Revoke agent
await client.agents.revoke('agent-id', {
  pubkey: 'owner-pubkey',
  signature: '5Kj...base58',
  message: 'AGENTID-REVOKE:agent-id:1714000000000'
});
```

## Trust Badges

```typescript
// Get badge as JSON
const badge = await client.badges.get('agent-id');
// badge.status, badge.score, badge.tier, badge.capabilities, ...

// Get badge as SVG for embedding
const svg = await client.badges.getSVG('agent-id');
// Use in an <img> tag or embed directly
```

## A2A Token Issuance

Issue short-lived tokens for agent-to-agent authentication:

```typescript
// Issue a token (60-second expiry)
const a2a = await client.tokens.issue('agent-id');
console.log(a2a.token, a2a.expiresIn);

// Verify a token
const result = await client.tokens.verify(a2a.token);
if (result.valid) {
  console.log(result.payload); // Decoded token claims
}
```

## Verifiable Credentials

Export a W3C Verifiable Credential for an agent:

```typescript
const vc = await client.credentials.get('agent-id');
console.log(vc.type);        // ['VerifiableCredential', 'AIAgentIdentityCredential']
console.log(vc.issuer.name); // 'AgentID'
console.log(vc.credentialSubject.reputationScore);
```

## Chain Discovery

```typescript
const { chains, count } = await client.chains.list();
chains.forEach(chain => {
  console.log(chain.chainType, chain.signingAlgo, chain.addressFormat);
});
```

## Attestations & Flags

```typescript
// Record a successful action
const attestation = await client.attestations.attest('agent-id', {
  success: true,
  action: 'token-swap'
});

// Get action stats
const stats = await client.attestations.get('agent-id');

// Flag suspicious behavior
const flagResult = await client.attestations.flag('agent-id', {
  reporterPubkey: 'Reporter...base58',
  signature: '5Kj...base58',
  timestamp: Date.now(),
  reason: 'Detected malicious behavior',
  evidence: 'Transaction log reference'
});

// Get flags for an agent
const flags = await client.attestations.getFlags('agent-id');
```

## API Reference

| Namespace | Method | Description |
|-----------|--------|-------------|
| `agents` | `register(data)` | Register a new agent |
| `agents` | `get(agentId)` | Get agent with reputation |
| `agents` | `list(params?)` | List agents (auth required) |
| `agents` | `listPublic(params?)` | Public agent registry |
| `agents` | `getByOwner(pubkey)` | Get agents by owner |
| `agents` | `update(agentId, data)` | Update agent metadata |
| `agents` | `revoke(agentId, data)` | Revoke an agent |
| `agents` | `discover(params)` | Discover by capability |
| `agents` | `listByOrg(orgId, params?)` | List org agents |
| `badges` | `get(agentId)` | Badge as JSON |
| `badges` | `getSVG(agentId)` | Badge as SVG |
| `reputation` | `get(agentId)` | Full reputation breakdown |
| `tokens` | `issue(agentId)` | Issue A2A token |
| `tokens` | `verify(token)` | Verify A2A token |
| `credentials` | `get(agentId)` | W3C Verifiable Credential |
| `chains` | `list()` | Supported chains |
| `attestations` | `attest(agentId, data)` | Record attestation |
| `attestations` | `get(agentId)` | Action stats |
| `attestations` | `flag(agentId, data)` | Flag agent |
| `attestations` | `getFlags(agentId)` | Get flags |

## TypeScript Support

This package is written in TypeScript and ships with full type definitions. No `@types/` package needed.

```typescript
import type { Agent, Badge, ReputationScore, A2AToken, VerifiableCredential } from '@agentid/sdk';
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `apiUrl` | `https://api.agentidapp.com` | API base URL |
| `apiKey` | — | API key for auth |
| `accessToken` | — | JWT access token |
| `timeout` | `10000` | Request timeout (ms) |

## Links

- [AgentID Platform](https://agentidapp.com)
- [API Documentation](https://agentidapp.com/docs)
- [GitHub Repository](https://github.com/RunTimeAdmin/AgentID-2.0)

## License

MIT
