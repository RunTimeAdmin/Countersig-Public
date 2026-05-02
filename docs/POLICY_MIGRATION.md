# Countersig Policy Migration Guide

How to deploy policy enforcement on existing agents without breaking anything — a step-by-step rollout using audit mode, real traffic data, and incremental tightening.

**Author:** David Cooper (CCIE #14019)  
**Version:** 1.0.0  
**Last Updated:** April 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step 1: Inventory Your Agents](#step-1-inventory-your-agents)
4. [Step 2: Deploy in audit_only Mode](#step-2-deploy-in-audit_only-mode)
5. [Step 3: Monitor Audit Logs](#step-3-monitor-audit-logs)
6. [Step 4: Build Your Whitelist](#step-4-build-your-whitelist)
7. [Step 5: Review the Effective Bundle](#step-5-review-the-effective-bundle)
8. [Step 6: Flip to enforced](#step-6-flip-to-enforced)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Timeline Recommendation](#10-timeline-recommendation)
11. [Common Pitfalls](#11-common-pitfalls)

---

## 1. Overview

Countersig's Trust Layer supports three policy modes: `permissive`, `audit_only`, and `enforced`. The recommended migration path takes existing agents from no policy enforcement to full enforcement **without a single outage**, by using `audit_only` mode to observe real traffic before locking anything down.

The process:
1. See what you have (inventory)
2. Turn on logging without blocking (audit_only)
3. Watch what your agents actually call (monitor)
4. Allow what's legitimate (whitelist)
5. Verify the bundle looks right (review)
6. Start blocking everything else (enforced)

---

## 2. Prerequisites

Before starting the migration:

- **Countersig v2.x** with the Trust Layer v1 migration applied (`migrate-v6.js`). Verify by checking that the `org_policy_settings` table exists in your database.
- **At least one registered organization** with one or more agents. Agents must have valid `org_id` associations.
- **Admin-level API access.** Policy settings and whitelist management require the `ADMIN` role. Ensure you have a valid Bearer token with admin privileges.
- **API base URL.** All examples below use `$API` as a placeholder. Set it to your Countersig backend URL:

```bash
export API="https://api.countersig.com/v1"
export TOKEN="your-admin-bearer-token"
```

---

## Step 1: Inventory Your Agents

Before changing any policy settings, understand what you're working with. List all agents in your organization:

```bash
curl -s "$API/agents" \
  -H "Authorization: Bearer $TOKEN" | jq '.agents[] | {id: .agent_id, name: .name, status: .status}'
```

Record the agent IDs and names. For each agent, note what external services it is expected to call (LLM APIs, webhooks, data sources, other agents). This becomes your baseline for building the whitelist later.

If you have many agents, prioritize by risk: agents handling sensitive data or making calls to internal services should be migrated first.

---

## Step 2: Deploy in `audit_only` Mode

Set your organization's policy mode to `audit_only`. This enables policy evaluation and logging **without blocking any traffic**. All calls continue to flow normally.

```bash
curl -X PUT "$API/policy/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_mode": "audit_only",
    "inherit_global_defaults": true,
    "bundle_ttl_seconds": 300
  }'
```

**Expected response:**

```json
{
  "policy_mode": "audit_only",
  "inherit_global_defaults": true,
  "bundle_ttl_seconds": 300,
  "updated_at": "2026-04-30T12:00:00.000Z"
}
```

**What `inherit_global_defaults` does:** When `true`, the 11 default AI API destinations (OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, Perplexity, Azure OpenAI, AWS Bedrock, Tavily, Serper) are automatically included in your org's effective whitelist. Leave this enabled unless you want to explicitly manage every destination.

---

## Step 3: Monitor Audit Logs

With `audit_only` active, every call that **would have been blocked** under `enforced` mode is logged as a `policy_violation_audit_only` event. No traffic is actually blocked.

Let your agents run normally for **1–2 weeks**. Then review the audit logs:

```bash
curl -s "$API/audit-logs?action=policy_violation_audit_only&limit=100" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {
    agent_id: .metadata.agent_id,
    destination: .metadata.destination,
    reason: .metadata.reason,
    timestamp: .created_at
  }'
```

This shows every destination your agents attempted to reach that is **not** on any whitelist. These are the calls that will be blocked once you switch to `enforced` mode.

**What to look for:**

- **Legitimate destinations** your agents need — these go on the whitelist (Step 4)
- **Unexpected destinations** you didn't know about — investigate before allowing
- **Malicious or suspicious destinations** — these validate that enforcement will add value

---

## Step 4: Build Your Whitelist

Using the violation data from Step 3, add legitimate destinations to your org whitelist.

### Add a single domain

```bash
curl -X POST "$API/policy/whitelist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "api.openai.com",
    "destination_type": "domain",
    "notes": "GPT-4 API access for all agents"
  }'
```

### Add a wildcard entry

For services that use subdomains (common with Azure OpenAI, AWS Bedrock):

```bash
curl -X POST "$API/policy/whitelist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "*.openai.azure.com",
    "destination_type": "wildcard",
    "notes": "Azure OpenAI — all regional endpoints"
  }'
```

### Review your current whitelist

```bash
curl -s "$API/policy/whitelist" \
  -H "Authorization: Bearer $TOKEN" | jq '.entries[] | {id: .id, destination: .destination, type: .destination_type}'
```

### Pre-loaded defaults

If you set `inherit_global_defaults: true` in Step 2, the following 11 AI API destinations are already in your effective whitelist:

| Destination | Type |
|-------------|------|
| `api.openai.com` | domain |
| `api.anthropic.com` | domain |
| `generativelanguage.googleapis.com` | domain |
| `api.groq.com` | domain |
| `api.mistral.ai` | domain |
| `api.deepseek.com` | domain |
| `api.perplexity.ai` | domain |
| `*.openai.azure.com` | wildcard |
| `*.bedrock.amazonaws.com` | wildcard |
| `api.tavily.com` | domain |
| `google.serper.dev` | domain |

You only need to add destinations beyond these defaults.

---

## Step 5: Review the Effective Bundle

Before switching to `enforced`, verify that the policy bundle for a test agent matches your expectations. The bundle is the compiled result of all precedence rules.

```bash
curl -s "$API/policy/bundle/$AGENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    mode: .bundle.policy_mode,
    allow_count: (.bundle.allow | length),
    deny_count: (.bundle.deny | length),
    allow: [.bundle.allow[] | .destination],
    deny: [.bundle.deny[] | {dest: .destination, reason: .reason}],
    expires: .bundle.expires_at
  }'
```

**Check that:**

- `mode` is `audit_only` (it should still be — you haven't switched yet)
- `allow` contains all the destinations your agent needs
- `deny` contains anything you've explicitly blacklisted
- No legitimate destinations are missing from the allow list

Repeat this for several agents, especially any with agent-level whitelist or blacklist entries.

---

## Step 6: Flip to `enforced`

When you're confident the whitelist is complete, switch to `enforced` mode:

```bash
curl -X PUT "$API/policy/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_mode": "enforced"
  }'
```

**From this point forward, any destination not on the effective allow list is blocked.** The change takes effect on the next bundle refresh cycle (maximum 5 minutes, based on your `bundle_ttl_seconds` setting).

Blocked calls are logged as `policy_block` events in the audit log. Monitor immediately after switching:

```bash
curl -s "$API/audit-logs?action=policy_block&limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[] | {agent: .metadata.agent_id, destination: .metadata.destination, reason: .metadata.reason}'
```

---

## 9. Rollback Procedure

If agents break after switching to `enforced`, roll back immediately:

```bash
# Option A: Back to audit_only (logs violations, blocks nothing)
curl -X PUT "$API/policy/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"policy_mode": "audit_only"}'

# Option B: Back to permissive (only blacklists block)
curl -X PUT "$API/policy/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"policy_mode": "permissive"}'
```

**Rollback is instant** on the backend side. Agents and gateways will pick up the change on their next bundle refresh (within `bundle_ttl_seconds`, default 5 minutes).

**No data is lost.** Whitelist entries, blacklist entries, and audit logs are all preserved across mode changes. You can flip between modes as many times as needed.

---

## 10. Timeline Recommendation

| Week | Action | Mode |
|------|--------|------|
| **1** | Deploy `audit_only`, start collecting violation data | `audit_only` |
| **2** | Review logs, add missing destinations to whitelist | `audit_only` |
| **3** | Continue monitoring, refine whitelist, review bundles | `audit_only` |
| **4** | Switch to `enforced` on a **Tuesday or Wednesday** | `enforced` |

Adjust based on your agent count and traffic patterns:

- **< 10 agents:** 1–2 weeks in audit mode is likely sufficient
- **10–100 agents:** 2–3 weeks recommended
- **100+ agents:** Consider rolling out enforcement org-by-org or agent-group-by-agent-group

---

## 11. Common Pitfalls

### Forgetting wildcard entries

Azure OpenAI uses regional subdomains like `myinstance.openai.azure.com`. Adding only `openai.azure.com` as a `domain` entry won't match. Use `*.openai.azure.com` with `destination_type: "wildcard"` instead. The same applies to AWS Bedrock (`*.bedrock.amazonaws.com`).

### Missing agent-to-agent traffic

If your agents communicate with each other through Countersig, those internal calls also need policy entries. Use `destination_type: "agent"` with the target agent's UUID:

```bash
curl -X POST "$API/policy/whitelist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "agent:550e8400-e29b-41d4-a716-446655440000",
    "destination_type": "agent",
    "notes": "Allow communication with data-processor agent"
  }'
```

### Deploying enforced mode on a Friday

Don't. If something breaks, you want your team available to respond. Switch to `enforced` on a **Tuesday or Wednesday morning** with the team online and monitoring.

### Assuming the default AI APIs cover everything

The 11 pre-loaded defaults cover the most common LLM providers. They do **not** cover your own internal APIs, webhook endpoints, third-party SaaS tools, or custom model hosting. Review your audit logs thoroughly.

### Not checking agent-level policies

If individual agents have agent-level whitelist or blacklist entries, those interact with the org policy via the precedence model. An agent whitelist can only **narrow** the org whitelist (intersection), never expand it. Verify bundles for agents with custom policies using Step 5.

---

## Further Reading

- [Policy Overview](POLICY_OVERVIEW.md) — Architecture and concepts for the Trust Layer
- [Policy API Reference](POLICY_API.md) — Full endpoint documentation
- [Policy SDK Guide](POLICY_SDK.md) — Integrating `@countersig/policy-client`
- [Developer Guide](DEVELOPER_GUIDE.md) — General Countersig platform documentation
