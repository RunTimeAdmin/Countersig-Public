# Countersig Policy SDK — `@countersig/policy-client`

Client-side policy enforcement for AI agents. Wraps outbound HTTP calls and enforces destination policy from cryptographically signed bundles.

**Author:** David Cooper (CCIE #14019)  
**Version:** 0.1.0  
**Last Updated:** April 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Quick Start](#3-quick-start)
4. [Configuration Options](#4-configuration-options)
5. [API Reference](#5-api-reference)
6. [Decision Model](#6-decision-model)
7. [Events](#7-events)
8. [Security Model](#8-security-model)
9. [Failure Modes](#9-failure-modes)
10. [Related Documentation](#10-related-documentation)

---

## 1. Overview

The `@countersig/policy-client` SDK is a lightweight Node.js library that enforces Countersig destination policies inside the agent process. It fetches a cryptographically signed policy bundle from the Countersig backend, caches it locally, and evaluates every outbound HTTP call against the agent's effective allow and deny lists — all in microseconds with no network round-trip.

### Important: Client-Side Hints, NOT a Security Boundary

> A compromised or malicious agent can bypass the SDK by importing `node-fetch` or any HTTP client directly. The SDK enforces policy only for calls routed through it. Audit logging happens client-side and can be tampered with.
>
> For hard enforcement that cannot be bypassed by the agent process, deploy the [Countersig Gateway](POLICY_GATEWAY.md) at the network layer.

The recommended pattern for serious deployments is **both** — the SDK catches honest mistakes early, the gateway enforces the actual boundary.

**Use this SDK to:**

- Catch honest mistakes (a developer hardcoding a destination they shouldn't)
- Get fast in-process decisions during development
- Emit policy-violation telemetry from agent runtimes

**Do NOT** use this SDK as the only enforcement mechanism for production deployments handling sensitive data.

---

## 2. Installation

```bash
npm install @countersig/policy-client
```

Requires Node.js 18+.

---

## 3. Quick Start

```ts
import { PolicyClient, PolicyDeniedError } from '@countersig/policy-client';

const client = new PolicyClient({
  apiBase: 'https://api.countersig.com',
  apiKey: process.env.COUNTERSIG_API_KEY!,
  agentId: process.env.COUNTERSIG_AGENT_ID!,
});

// Initialize: fetches and verifies the first policy bundle
await client.init();

// Wrapped fetch: enforces policy before making the call
try {
  const res = await client.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* ... */ }),
  });
  const data = await res.json();
} catch (err) {
  if (err instanceof PolicyDeniedError) {
    console.error(`Blocked: ${err.destination} (${err.decision.reason})`);
  } else {
    throw err;
  }
}

// Cleanup on shutdown
process.on('SIGTERM', () => client.close());
```

---

## 4. Configuration Options

```ts
new PolicyClient({
  // Required
  apiBase: 'https://api.countersig.com',
  apiKey: '...',          // JWT or API key with read scope
  agentId: 'uuid-here',

  // Optional — JWKS source (one of)
  jwksUrl: '...',         // Defaults to {apiBase}/.well-known/jwks.json
  jwks: { keys: [...] },  // Inline key set (skips remote fetch entirely)

  // Optional — refresh and timing
  refreshIntervalMs: 0,   // Defaults to 90% of bundle TTL
  failClosed: true,       // Default: deny all on stale bundle
  clockSkewSeconds: 30,   // Default: 30s tolerance on issued_at
  maxRefreshAttempts: 0,  // Default: 0 (unlimited, exp backoff capped at 5 min)
  fetchImpl: fetch,       // For tests: inject a mock fetch
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiBase` | `string` | — | **Required.** Countersig backend URL |
| `apiKey` | `string` | — | **Required.** API key for authenticating bundle requests |
| `agentId` | `string` | — | **Required.** UUID of the registered agent |
| `jwksUrl` | `string` | `${apiBase}/.well-known/jwks.json` | URL of the JWKS endpoint for signature verification |
| `jwks` | `object` | — | Inline JWKS key set (skips remote fetch) |
| `refreshIntervalMs` | `number` | 90% of TTL | How often to refresh the policy bundle |
| `failClosed` | `boolean` | `true` | Deny all calls when the bundle is stale |
| `clockSkewSeconds` | `number` | `30` | Tolerance for `issued_at` clock drift |
| `maxRefreshAttempts` | `number` | `0` (unlimited) | Max retry attempts before giving up |
| `fetchImpl` | `function` | `globalThis.fetch` | Custom fetch implementation for testing |

---

## 5. API Reference

### `client.init(): Promise<void>`

Fetches the JWKS, downloads the initial policy bundle, verifies the signature, and starts the refresh timer. Must be called before `fetch()` or `check()`.

Throws if the backend is unreachable or the bundle signature is invalid.

### `client.fetch(url, options?): Promise<Response>`

Drop-in replacement for `globalThis.fetch`. Evaluates the destination URL against the loaded policy before making the request.

- If allowed: makes the HTTP call and returns the Response
- If denied: throws `PolicyDeniedError` (in `enforced` mode) or passes through with a `policy_violation` event (in `audit_only` mode)

### `client.check(url): Decision`

Returns a policy decision without making any network request. Use this when you route calls through your own HTTP layer.

```ts
const decision = client.check('https://api.openai.com/v1/chat');
// { allowed: true, reason: 'whitelisted', scope: 'org', mode: 'enforced' }
```

### `client.fetchAgent(targetAgentId, body, options?): Promise<Response>`

For Countersig-internal agent-to-agent calls. Requests a short-lived A2A token from the backend and attaches it as a Bearer token on the outbound call. The target agent verifies the token using `@countersig/verify`.

```ts
const res = await client.fetchAgent(
  'agent:550e8400-e29b-41d4-a716-446655440000',
  JSON.stringify({ task: 'process-this' }),
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-countersig-target-url': 'https://other-agent.internal/api/dispatch',
    },
  }
);
```

### `client.close(): void`

Stops the background refresh timer. Call on process shutdown.

### `PolicyDeniedError`

Thrown by `client.fetch()` when a call is denied in `enforced` mode.

Properties:
- `destination: string` — the blocked URL
- `decision: Decision` — full decision object with `reason`, `scope`, `mode`

---

## 6. Decision Model

### Policy Modes

The bundle's `policy_mode` (set by your org admin) determines behavior:

- **`enforced`** — Default-deny. Calls to non-whitelisted destinations throw `PolicyDeniedError`.
- **`audit_only`** — Calls pass through, but would-be-blocked calls emit a `policy_violation` event with `wouldBlock: true`. Use this for safe rollout.
- **`permissive`** — Whitelist is ignored. Only the deny list blocks calls. Dev/staging only.

### Per-Call Evaluation Order

1. **Stale check** — If `now > bundle.expires_at` and `failClosed: true`, deny immediately
2. **Normalize destination** — Extract hostname from URL, or parse `agent:` prefix for internal references
3. **Global blacklist** — Check against the locally cached global blacklist (refreshed when `global_deny_hash` changes)
4. **Deny list** — Check the bundle's `deny[]` entries. If matched, deny with reason and scope
5. **Allow list** — Check the bundle's `allow[]` entries. If matched, allow
6. **Default action** — Based on mode: `enforced` → deny, `audit_only` → allow + emit event, `permissive` → allow

### Decision Object

```ts
interface Decision {
  allowed: boolean;
  reason: 'whitelisted' | 'not_whitelisted' | 'denied' | 'blacklisted' | 'stale_bundle_fail_closed';
  scope: 'org' | 'agent' | 'global';
  mode: 'enforced' | 'audit_only' | 'permissive';
}
```

---

## 7. Events

The `PolicyClient` extends Node.js `EventEmitter`. Subscribe to these events for observability integration.

| Event | Payload | Emitted When |
|-------|---------|--------------|
| `bundle_loaded` | `{ bundle }` | A fresh bundle has been received and signature-verified |
| `bundle_refresh_failed` | `{ error, attempt }` | A background bundle refresh attempt failed |
| `policy_violation` | `{ destination, reason, wouldBlock }` | A call was denied, or would be denied in `audit_only` mode |
| `signature_invalid` | `{ reason }` | A bundle's Ed25519 signature failed verification |
| `stale_bundle` | `{ expiredAt, failClosed }` | Bundle expired and refresh hasn't recovered yet |

**Example:**

```ts
client.on('bundle_loaded', ({ bundle }) => {
  console.log('policy mode:', bundle.policy_mode);
});

client.on('bundle_refresh_failed', ({ error, attempt }) => {
  console.warn(`refresh attempt ${attempt} failed:`, error.message);
});

client.on('policy_violation', ({ destination, reason, wouldBlock }) => {
  metricsClient.increment('policy.violation', { reason, wouldBlock });
});

client.on('signature_invalid', ({ reason }) => {
  alertClient.fire('countersig.signature_invalid', { reason });
});
```

---

## 8. Security Model

### Bundle Verification

Every policy bundle is signed with Ed25519 (JWS Compact Serialization, `alg: EdDSA`). The client:

1. Fetches JWKS from `{apiBase}/.well-known/jwks.json` (cached 10 minutes)
2. Verifies the signature against the key with `kid: 'a2a-ed25519-1'`
3. Compares signed payload identity fields against the response envelope (defense against replay)
4. Validates timing (`issued_at` not in the future, `expires_at` after `issued_at`)
5. Validates `agent_id` matches the configured agent

Any failure throws and emits `signature_invalid`. The bundle is rejected.

### Comparison with the Gateway

|  | `@countersig/policy-client` | Countersig Gateway |
|---|---|---|
| Where it runs | Inside the agent process | Network layer in front of the agent |
| Latency | Microseconds (in-memory) | Single round-trip per cold-cache call |
| Bypassable | Yes — agent can import `fetch` directly | No — gateway sees all egress |
| Enforces blocks on | Calls routed through this SDK | All HTTP egress |
| Setup | `npm install` + `client.init()` | Deploy proxy/sidecar |

---

## 9. Failure Modes

| Scenario | Behavior |
|----------|----------|
| **Backend unreachable during init** | `client.init()` throws — agent should not start without a valid bundle |
| **Backend unreachable during refresh** | Cached bundle continues to be used until `expires_at` |
| **Bundle expired, refresh failing** | If `failClosed: true`, all calls denied. If `false`, cached bundle used (degraded security) |
| **Signature verification fails** | Bundle rejected, `signature_invalid` event emitted, previous cached bundle retained |
| **Global blacklist hash changed** | Full global blacklist re-fetched and cached locally |
| **Network timeout on fetch** | Standard fetch timeout applies; no policy override |

### Why `failClosed: true` Is the Default

A stale bundle means the agent's policy may have changed — destinations may have been revoked, new blacklist entries may exist. Allowing traffic through on stale data undermines the entire enforcement model. Default-deny on staleness ensures that a network partition or backend outage does not silently open the policy boundary.

### Stale Bundle Recovery

When `failClosed: true` (default):

- A stale bundle (past `expires_at`) causes every call to deny with `reason: 'stale_bundle_fail_closed'`
- Background refresh attempts continue with exponential backoff (5s → 10s → 20s → ... capped at 5 min)
- A successful refresh recovers all functionality immediately

When `failClosed: false`:

- A stale bundle is used until refreshed. Calls evaluate against the last-known policy
- Use this in development if you want to keep working when the backend is unreachable

---

## 10. Related Documentation

- [Policy Overview](POLICY_OVERVIEW.md) — Architecture and concepts for the Trust Layer
- [Policy Gateway Guide](POLICY_GATEWAY.md) — Network-side enforcement deployment
- [Policy Migration Guide](POLICY_MIGRATION.md) — Rolling out enforcement on existing agents
- [Developer Guide](DEVELOPER_GUIDE.md) — General Countersig platform documentation
- [npm package](https://www.npmjs.com/package/@countersig/policy-client) — Published SDK on npm
