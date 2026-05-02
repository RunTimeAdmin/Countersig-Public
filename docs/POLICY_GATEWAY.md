# Countersig Policy Gateway — Network-Side Enforcement

Network-layer policy enforcement for AI agents registered with Countersig. A Caddy module that sits in front of your AI agents and enforces destination allow-lists at the network layer — it cannot be bypassed by the agent process.

**Author:** David Cooper (CCIE #14019)  
**Version:** 1.0.0  
**Last Updated:** April 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Installation](#3-installation)
4. [Configuration Reference](#4-configuration-reference)
5. [Deployment Patterns](#5-deployment-patterns)
6. [Fail Modes](#6-fail-modes)
7. [Authentication](#7-authentication)
8. [Observability](#8-observability)
9. [Security Model](#9-security-model)
10. [Performance](#10-performance)
11. [Related Documentation](#11-related-documentation)

---

## 1. Overview

The Countersig Gateway is a network-side enforcement layer deployed as a proxy in front of AI agent egress traffic. All outbound HTTPS from agents flows through it. The gateway evaluates every request against the agent's policy by calling the Countersig backend — and blocks unauthorized destinations at the network layer.

**This IS the security boundary.** Unlike the [SDK](POLICY_SDK.md), which operates inside the agent process and can be bypassed by a compromised agent, the gateway sits outside the agent's trust boundary. A malicious or compromised agent that imports `node-fetch` directly cannot circumvent network-level enforcement.

### Why Both SDK and Gateway?

The recommended deployment for production uses **both** enforcement layers:

- **SDK** catches honest mistakes with zero-latency local evaluation — fast developer feedback during development
- **Gateway** enforces the actual boundary at the network layer — security teams sleep at night

Use the [SDK alone](POLICY_SDK.md) when you're in dev/staging, control all the code in the agent, and want microsecond decision latency without a network hop.

**Repository:** [github.com/RunTimeAdmin/countersig-gateway](https://github.com/RunTimeAdmin/countersig-gateway)  
**Implementation:** Custom Caddy module (pure Go)  
**Docker Image:** `ghcr.io/runtimeadmin/countersig-gateway:latest`

---

## 2. Architecture

```
┌──────────────┐     HTTPS_PROXY=     ┌──────────────────┐     ┌──────────────────┐
│   AI Agent   │ ───────────────────▶ │ Countersig       │────▶│  Destination     │
│              │     :8080            │ Gateway (Caddy)  │     │  (OpenAI, etc.)  │
└──────────────┘                      └──────────────────┘     └──────────────────┘
                                              │
                                              │ POST /v1/policy/check
                                              ▼
                                      ┌──────────────────┐
                                      │ Countersig API   │
                                      │ (your backend)   │
                                      └──────────────────┘
```

### Request Lifecycle (6 Steps)

For each outbound request, the gateway performs:

1. **Extract destination** — Parse the target from the request. In forward proxy mode, this is the CONNECT host. In reverse proxy mode, it comes from the `X-Target-Upstream` header.
2. **Verify agent identity** — Validate the agent's JWT signature against the Countersig JWKS endpoint, or accept an API key via the `X-Countersig-Agent` header as a fallback.
3. **Extract claims** — Read `agent_id` and `org_id` from the verified JWT claims (or from the API key headers).
4. **Check local cache** — Look up `(agent_id, destination)` in the LRU cache (default: 10,000 entries, TTL 300s).
5. **On cache miss** — Call `POST /v1/policy/check` on the Countersig backend with `{ agent_id, destination }` and cache the result.
6. **Enforce decision** — If allowed, forward the request to the destination. If denied, return `403 Forbidden` with a reason header. Record metrics and structured logs.

---

## 3. Installation

### Option 1: Pre-built Docker Image (Recommended)

```bash
docker run -d \
  --name countersig-gateway \
  -p 8080:8080 \
  -e COUNTERSIG_GATEWAY_API_KEY=$YOUR_GATEWAY_API_KEY \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro \
  ghcr.io/runtimeadmin/countersig-gateway:latest
```

### Option 2: Build with xcaddy

```bash
xcaddy build \
  --with github.com/RunTimeAdmin/countersig-gateway/module \
  --with github.com/caddyserver/forwardproxy@caddy2

./caddy run --config Caddyfile
```

### Option 3: Build from Source

```bash
git clone https://github.com/RunTimeAdmin/countersig-gateway
cd countersig-gateway
go build -o caddy ./cmd/caddy
./caddy run --config Caddyfile
```

---

## 4. Configuration Reference

The gateway is configured entirely through Caddyfile directives. Environment variables are referenced using Caddy's `{env.VAR}` syntax.

### Example Caddyfile

```caddy
{
    order countersig_policy before forward_proxy
}

:8080 {
    countersig_policy {
        api_base        https://api.countersig.com
        api_key         {env.COUNTERSIG_GATEWAY_API_KEY}
        cache_ttl       300
        cache_size      10000
        fail_mode       closed
        require_auth    true
        request_timeout 5s
        metrics_path    /metrics
    }

    forward_proxy {
        basic_auth {env.PROXY_USER} {env.PROXY_PASS}
    }
}
```

### Directive Reference

| Directive | Required | Default | Description |
|-----------|----------|---------|-------------|
| `api_base` | Yes | — | Countersig API base URL (e.g., `https://api.countersig.com`) |
| `api_key` | Yes | — | Service API key for the gateway itself (supports `{env.VAR}` syntax) |
| `cache_ttl` | No | `300` | Decision cache TTL in seconds |
| `cache_size` | No | `10000` | LRU cache maximum entries |
| `fail_mode` | No | `closed` | Behavior when backend is unreachable: `closed`, `open`, or `cached_only` |
| `require_auth` | No | `true` | Require valid agent JWT or API key on every request |
| `jwks_url` | No | `{api_base}/.well-known/jwks.json` | JWKS endpoint for verifying agent JWTs |
| `request_timeout` | No | `5s` | Timeout for `/v1/policy/check` backend calls |
| `metrics_path` | No | *(disabled)* | Path to expose Prometheus metrics (e.g., `/metrics`) |

---

## 5. Deployment Patterns

Three supported deployment patterns, each with a Caddyfile example.

### Forward Proxy (Recommended)

Agents use the gateway as their `HTTPS_PROXY`. **Zero code changes required.** The gateway intercepts all outbound HTTPS traffic at the system level.

```bash
export HTTPS_PROXY=http://gateway:8080
export HTTP_PROXY=http://gateway:8080
# All outbound HTTPS now flows through the gateway
```

```caddy
{
    order countersig_policy before forward_proxy
}

:8080 {
    countersig_policy {
        api_base     https://api.countersig.com
        api_key      {env.COUNTERSIG_GATEWAY_API_KEY}
        fail_mode    closed
    }

    forward_proxy {
        basic_auth {env.PROXY_USER} {env.PROXY_PASS}
    }
}
```

- **Best for:** Production deployments requiring non-bypassable enforcement
- **Latency:** One network hop to the proxy
- **Advantage:** System-level HTTPS_PROXY is transparent to agent code

### Reverse Proxy

Agents call the gateway directly, specifying the upstream destination via the `X-Target-Upstream` header. Useful when `HTTPS_PROXY` cannot be set at the system level.

```caddy
:8080 {
    countersig_policy {
        api_base     https://api.countersig.com
        api_key      {env.COUNTERSIG_GATEWAY_API_KEY}
        fail_mode    closed
    }

    reverse_proxy {header.X-Target-Upstream}
}
```

- **Best for:** Environments where system-level proxy configuration is not feasible
- **Latency:** One network hop to the proxy
- **Note:** Requires agent code to set the `X-Target-Upstream` header

### Sidecar

One gateway instance per agent pod, listening on localhost only. The agent makes all outbound calls through `localhost:8080`.

```caddy
localhost:8080 {
    countersig_policy {
        api_base     https://api.countersig.com
        api_key      {env.COUNTERSIG_GATEWAY_API_KEY}
        fail_mode    closed
    }

    forward_proxy
}
```

```yaml
# docker-compose sidecar example
services:
  agent:
    image: your-agent:latest
    environment:
      - HTTPS_PROXY=http://localhost:8080
    network_mode: "service:gateway"

  gateway:
    image: ghcr.io/runtimeadmin/countersig-gateway:latest
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    environment:
      - COUNTERSIG_GATEWAY_API_KEY=${GATEWAY_API_KEY}
```

- **Best for:** Kubernetes deployments, per-agent isolation
- **Latency:** Minimal (loopback network)
- **Isolation:** Each agent has its own enforcement instance

---

## 6. Fail Modes

The `fail_mode` directive controls gateway behavior when the Countersig backend is unreachable.

### `closed` (Default — Recommended)

If the policy backend is unreachable **and** the cache has no entry for the `(agent, destination)` pair, the request is **denied**. A backend outage does not silently open the policy boundary. This is the secure default for production.

### `open`

If the policy backend is unreachable, requests are **allowed**. Acceptable for dev/staging where availability outranks security. Not recommended for production.

### `cached_only`

If the policy backend is unreachable, serve decisions from cache regardless of TTL expiry. Cache misses are **denied**. This is the best middle ground for production deployments that need to survive short backend outages without opening the boundary for unknown destinations.

---

## 7. Authentication

The gateway supports two ways for agents to identify themselves on each request.

### Bearer JWT (Recommended)

```
Authorization: Bearer <countersig-issued-jwt>
```

The gateway verifies the JWT signature against your JWKS endpoint (`jwks_url`), extracts `agent_id` and `org_id` from the claims, and uses them for the policy check. Public keys are cached locally after the first fetch.

### API Key Fallback

```
X-Countersig-Agent: <api-key>
X-Countersig-Agent-Id: <agent-uuid>
```

For runtimes that cannot easily set an `Authorization` header. The API key is treated opaquely — the backend validates it on the policy check call. You can configure your existing API key permissions to constrain which agent IDs each key can act as.

When `require_auth` is set to `true` (the default), requests without a valid JWT or API key are rejected with `401 Unauthorized`.

---

## 8. Observability

### Prometheus Metrics

When `metrics_path` is configured (e.g., `metrics_path /metrics`), the gateway exposes the following counters and histograms:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `countersig_gateway_allowed_total` | Counter | `reason`, `mode` | Requests allowed through |
| `countersig_gateway_denied_total` | Counter | `reason`, `scope`, `mode` | Requests denied |
| `countersig_gateway_cache_hits_total` | Counter | — | Policy decisions served from cache |
| `countersig_gateway_cache_misses_total` | Counter | — | Policy decisions requiring backend call |
| `countersig_gateway_auth_failures_total` | Counter | `reason` | Authentication failures |
| `countersig_gateway_backend_errors_total` | Counter | `fallback` | Backend call failures (labeled by fail mode applied) |
| `countersig_gateway_check_latency_seconds` | Histogram | — | End-to-end policy check latency |

### Structured Logs

Caddy emits JSON logs by default. The Countersig module writes:

- **`info`** on each policy denial — includes `agent_id`, `destination`, `reason`, `scope`
- **`warn`** on backend call failures — includes the fail mode applied
- **`debug`** on unauthenticated allows when `require_auth: false`

Configure log routing through standard Caddy log directives.

### Audit Trail

Every policy decision (allow and deny) flows through the Countersig backend's hash-chained audit log. The gateway is intentionally **not** the source of truth for audit records — your backend `audit_logs` table is. Gateway logs and metrics are operational telemetry, not compliance evidence.

---

## 9. Security Model

### What the Gateway Protects Against

- **Compromised agent code.** A malicious or buggy agent that imports `node-fetch` directly cannot bypass the gateway. The `HTTPS_PROXY` environment variable is a system-level setting; subverting it requires container escape.
- **Unauthorized destinations.** Calls to non-whitelisted destinations are denied at the network layer regardless of what the agent code attempts.
- **Stolen agent credentials within their authorized scope.** A leaked JWT can only access destinations in that agent's policy bundle.

### What the Gateway Does NOT Protect Against

- **Container escape.** If an attacker breaks out of the agent container, they can configure outbound traffic to bypass the gateway. Use container hardening, kernel sandboxing, and network policy as defense in depth.
- **DNS exfiltration.** The gateway sees HTTP/HTTPS. DNS queries to attacker-controlled nameservers can leak data outside the gateway's view. Use DNS egress filtering separately.
- **Side-channel data leakage.** An agent that's allowed to call OpenAI can still send arbitrary data in its OpenAI API request body. Egress allow-listing controls *where*, not *what*.
- **Trust in the agent JWT itself.** If your Countersig backend issues a JWT to a compromised agent, the gateway will honor it. Revocation through your backend remains the source of truth.

### Threat Model Summary

The gateway raises the bar for adversaries from "any code in the agent process" to "kernel-level container escape." That is a meaningful security improvement, not a panacea. Combine it with container hardening, network policy, and runtime monitoring for defense in depth.

---

## 10. Performance

- **Cache hit:** Sub-millisecond (in-memory LRU lookup, no network)
- **Cache miss:** 20–100ms (single round-trip to Countersig API)
- **Steady state:** For agents making thousands of calls per minute to a small set of destinations (typical), the cache hit rate is >99% and per-request overhead is negligible

A single gateway instance handles thousands of cached requests per second. For very high traffic, deploy multiple gateway instances behind a load balancer; each instance maintains its own independent cache.

---

## 11. Related Documentation

- [Policy Overview](POLICY_OVERVIEW.md) — Architecture and concepts for the Trust Layer
- [Policy SDK Guide](POLICY_SDK.md) — Client-side enforcement with `@countersig/policy-client`
- [Policy Migration Guide](POLICY_MIGRATION.md) — Rolling out enforcement on existing agents
- [Gateway Repository](https://github.com/RunTimeAdmin/countersig-gateway) — Source code, examples, and issue tracker
