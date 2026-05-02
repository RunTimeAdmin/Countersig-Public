# Countersig Policy Enforcement — Trust Layer v1 Overview

How Countersig turns AI agent identity into a real security boundary — controlling which destinations your agents can reach, and proving it.

**Author:** David Cooper (CCIE #14019)  
**Version:** 1.0.0  
**Last Updated:** April 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [Two Enforcement Modes](#3-two-enforcement-modes)
4. [Policy Precedence Model](#4-policy-precedence-model)
5. [Three Policy Modes](#5-three-policy-modes)
6. [Destination Types](#6-destination-types)
7. [Global Threat Intelligence](#7-global-threat-intelligence)
8. [Bundle Architecture](#8-bundle-architecture)
9. [Pricing Implications](#9-pricing-implications)
10. [Security Considerations](#10-security-considerations)
11. [What's Coming](#11-whats-coming)

---

## 1. Executive Summary

Countersig's Trust Layer v1 extends the platform from an identity service into a **policy enforcement boundary** for AI agents. Every registered agent receives a cryptographically signed policy bundle that defines exactly which external destinations it is allowed to contact — and which are denied.

Policy is enforced at two layers: a developer-facing SDK that catches honest mistakes before they leave the process, and an enterprise-grade network gateway that blocks unauthorized egress at the infrastructure level. Both layers consume the same policy data, and both produce immutable audit records.

The result: organizations gain verifiable control over what their AI agents can do on the network, with a clear audit trail for compliance.

---

## 2. The Problem

AI agents make outbound HTTP calls. That is their primary mechanism of action — calling LLM APIs, reading data sources, posting results to webhooks, communicating with other agents. Without policy enforcement, those calls are **unconstrained**.

This creates concrete security risks:

- **Data exfiltration.** A compromised or misconfigured agent sends sensitive data to an attacker-controlled endpoint.
- **Unauthorized API access.** An agent calls internal services it was never intended to reach.
- **Supply chain exposure.** An agent dependency pulls from a malicious package registry or analytics endpoint.
- **Lateral movement.** An agent-to-agent call chain reaches a service outside its trust boundary.
- **Shadow IT.** Developers deploy agents that call arbitrary third-party APIs with no visibility or approval.

Traditional network security (firewalls, VPNs, security groups) was designed for human-operated services with static egress patterns. AI agents are dynamic — their destinations change based on prompts, tool calls, and runtime decisions. Static rules don't work.

Countersig's policy layer solves this by binding destination control to agent identity. The agent's cryptographic identity determines what it can reach.

---

## 3. Two Enforcement Modes

The Trust Layer provides two complementary enforcement paths. They share the same backend policy data and can be deployed independently or together.

### Mode A — SDK Enforcement (Client-Side)

The `@countersig/policy-client` SDK wraps outbound HTTP in the agent process. Before every call, the SDK checks the agent's policy bundle and blocks calls to non-allowed destinations.

**Characteristics:**
- Microsecond latency (no network round-trip — bundle is cached locally)
- Developer-friendly integration (`client.fetch()` drop-in for `fetch()`)
- Voluntary — enforcement depends on the agent routing calls through the SDK
- Best for: catching configuration errors, enforcing team conventions, developer adoption

**Limitation:** A compromised agent that bypasses the SDK (e.g., imports `node-fetch` directly) will not be enforced. The SDK is a policy hint layer, not a security boundary.

### Mode B — Gateway Enforcement (Network-Side)

A reverse proxy (Caddy module or Envoy sidecar) sits in front of all agent egress traffic. Every outbound request passes through the gateway, which calls the Countersig backend to evaluate the destination against the agent's policy.

**Characteristics:**
- Real security boundary — cannot be bypassed by the agent process
- Per-call evaluation with local caching (LRU, TTL-aligned)
- Supports sidecar, egress proxy, and service mesh deployment patterns
- Best for: production environments, compliance-sensitive workloads, enterprise customers

**Recommendation:** For serious deployments, use **both**. The SDK catches honest mistakes early (fast feedback loop for developers). The gateway enforces the actual boundary (security teams sleep at night).

---

## 4. Policy Precedence Model

When org-level and agent-level policies conflict, the org always wins. This matches the inheritance model used by AWS IAM and Azure RBAC.

### Evaluation Order (Highest Priority First)

| Priority | Layer | Effect | Override Possible? |
|----------|-------|--------|--------------------|
| 1 | **Global Blacklist** | Deny | No — Countersig-managed, no tenant override |
| 2 | **Org Blacklist** | Deny | No — always wins over any allow |
| 3 | **Org Whitelist** | Allow | Defines the maximum allowed set for the org |
| 4 | **Agent Whitelist** | Allow | Intersection only — can narrow, never expand |
| 5 | **Agent Blacklist** | Deny | Adds agent-specific denies on top of org policy |

### Key Principle

**Org admins set the boundary. Agent-level policies can only narrow that boundary, never expand it.**

An agent whitelist entry for `api.example.com` has no effect if the org whitelist does not also include it. An org blacklist entry for `evil.com` cannot be overridden by any agent-level allow. This ensures that security teams retain final authority regardless of what individual agent configurations specify.

---

## 5. Three Policy Modes

Each organization configures one of three policy modes that govern how the enforcement layer handles destinations not explicitly allowed.

### `enforced` (Default)

Default-deny. Any destination not present in the effective allow list is blocked. This is the production mode for organizations that have completed their rollout.

### `audit_only`

Would-be-blocked calls are **logged but allowed through**. The audit log records `policy_violation_audit_only` events showing exactly which destinations would have been denied under `enforced` mode.

This is the **critical adoption tool**. Organizations deploy in `audit_only` first, observe the logs for 1–2 weeks to understand their agents' actual traffic patterns, build their whitelist from real data, then flip to `enforced` with confidence.

### `permissive`

Whitelist enforcement is skipped entirely. Only explicit blacklist entries block traffic. Intended for development and staging environments where teams need unrestricted agent access during active development.

---

## 6. Destination Types

Policy entries support four destination types, covering the range of targets AI agents typically contact.

| Type | Format | Matching Behavior | Example |
|------|--------|-------------------|---------|
| `domain` | Exact hostname | Exact string match | `api.openai.com` |
| `wildcard` | `*.suffix` | Suffix match on hostname | `*.openai.com` matches `api.openai.com` |
| `agent` | `agent:<uuid>` | Countersig-internal agent reference | `agent:550e8400-e29b-41d4-...` |
| `cidr` | IP/prefix | IP range membership | `10.0.0.0/8` |

CIDR matching applies only when the destination resolves to a literal IP address. Hostname-to-IP resolution is handled by the gateway layer, not the policy evaluator.

---

## 7. Global Threat Intelligence

Countersig maintains a global blacklist fed by automated threat intelligence. In v1, the source is **URLhaus by abuse.ch** — a well-maintained, freely available feed of malicious URLs updated hourly.

**Key properties:**

- **No tenant override.** The global blacklist cannot be overridden by any org or agent policy. If a destination is on the global list, it is denied unconditionally.
- **7-day TTL.** Entries expire automatically if the feed stops updating, preventing stale threat data from persisting indefinitely.
- **Ingestion cadence.** The feed is ingested every 6 hours via a scheduled job. Entries are upserted with a sliding TTL.
- **Categories.** Entries carry a threat category (e.g., `malware`, `phishing`) which appears in audit log entries and bundle deny reasons.

Future versions will add additional threat intelligence sources, including an AI-specific curated feed as a paid tier feature.

---

## 8. Bundle Architecture

The policy bundle is the core data contract between the Countersig backend and all consumers (SDK, gateway, future tooling).

### What's in a Bundle

Each agent receives a signed bundle containing its effective policy — the result of evaluating the full precedence model for that agent within its org context. The bundle includes:

- **Allow list** — all destinations this agent may contact (after precedence resolution)
- **Deny list** — all explicitly denied destinations with scope and reason metadata
- **Policy mode** — the org's current enforcement mode
- **Global deny hash** — SHA-256 of the global blacklist (clients refresh the full list on hash change)
- **Timestamps** — `issued_at`, `expires_at`, and `ttl_seconds` for cache management

### Signing

Bundles are signed with **Ed25519** using the same keypair that backs A2A tokens, published at the existing `/.well-known/jwks.json` endpoint. Signature verification is offline once the public key is fetched. Canonical JSON serialization ensures byte-identical payloads regardless of key ordering.

### Caching and Staleness

Bundles include a `Cache-Control` header with TTL. SDKs and gateways cache bundles locally and refresh before expiry. If a bundle becomes stale (past `expires_at`) and cannot be refreshed:

- In `enforced` mode with `failClosed: true` — **all calls are denied** until a fresh bundle is obtained
- This fail-closed behavior ensures that a network partition or backend outage does not silently open the policy boundary

---

## 9. Pricing Implications

The Trust Layer changes Countersig's value proposition from identity-only to identity + enforcement. Pricing tiers reflect this:

| Tier | Price | Whitelist Limit | Enforcement | Audit Retention |
|------|-------|-----------------|-------------|-----------------|
| **Free** | $0 | 10 destinations | Identity only | — |
| **Starter** | $29/mo | 50 destinations | SDK | — |
| **Professional** | $99/mo | 500 destinations | SDK + Gateway docs | 90 days |
| **Enterprise** | Custom | Unlimited | SDK + Gateway + SLA | 1 year |

The gateway is free and open-source. Revenue comes from the backend service (closed source), audit retention, and the upcoming AI-curated threat intelligence feed.

---

## 10. Security Considerations

### Key Compromise Mitigation

The bundle signing key is the same Ed25519 keypair used for A2A tokens. If compromised, an attacker could mint arbitrary bundles. Mitigations include existing key rotation procedures, `kid`-based key identification via JWKS for revocation, and a maximum 1-hour bundle TTL that limits the window of exposure.

### Replay Protection

Bundles carry `issued_at` and `expires_at` timestamps. Consumers must reject bundles with `issued_at` more than 30 seconds in the future (clock skew tolerance) and bundles past their `expires_at`. Replaying a bundle outside its validity window fails verification.

### SSRF Prevention

Destination inputs are user-supplied strings parsed via `new URL()`. CIDR matching only applies to literal IP addresses. The gateway layer handles hostname-to-IP resolution and should apply existing `urlValidator.assertPublicHttpsUrl` patterns to prevent DNS rebinding attacks.

### Tenant Isolation

Every API endpoint validates that the requesting user's org matches the target agent's org. A user from Org A cannot fetch bundles, evaluate destinations, or manage policy for agents belonging to Org B. This is enforced at the route layer.

### Audit Integrity

All policy modifications and enforcement decisions (including `audit_only` logical denies) flow through Countersig's existing hash-chained audit log. Every entry is cryptographically linked to its predecessor, making tampering detectable. The chain covers settings changes, whitelist and blacklist CRUD, block events, and audit-mode violation events.

---

## 11. What's Coming

The Trust Layer v1 establishes the foundation. Planned additions include:

- **`@countersig/policy-client`** — The SDK package for client-side enforcement, available on npm
- **Countersig Gateway** — The Caddy-based network enforcement module, open-source on GitHub
- **Dashboard UI** — Visual policy management, audit log explorer, and violation analytics (v2)
- **AI-Curated Threat Feed** — Domain intelligence specific to AI agent attack patterns (v2, paid tier)
- **Policy Templates** — Pre-built policy sets for common compliance frameworks (HIPAA, SOC 2)
- **Time-Bound Entries** — Temporary destination access with automatic expiry
- **Real-Time Push** — WebSocket-based policy updates for latency-sensitive deployments

---

## Further Reading

- [Policy API Reference](POLICY_API.md) — Endpoint documentation for direct API integration
- [Policy SDK Guide](POLICY_SDK.md) — Getting started with `@countersig/policy-client`
- [Policy Migration Guide](POLICY_MIGRATION.md) — Rolling out enforcement on existing agents
- [Developer Guide](DEVELOPER_GUIDE.md) — General Countersig platform documentation
