# Agent Health Monitoring Guide

Comprehensive guide to Countersig's Agent Health Monitoring — real-time visibility into agent availability, automated alerting, and operational dashboards for DevOps and SRE teams.

**Version:** 1.0.0  
**Last Updated:** May 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Health State Machine](#2-health-state-machine)
3. [Heartbeat Protocol](#3-heartbeat-protocol)
4. [Background Health Job](#4-background-health-job)
5. [Health Events](#5-health-events)
6. [Alert Rules](#6-alert-rules)
7. [Setting Up Alert Rules](#7-setting-up-alert-rules)
8. [Webhook Integration](#8-webhook-integration)
9. [Frontend Integration](#9-frontend-integration)
10. [API Reference](#10-api-reference)
11. [Best Practices](#11-best-practices)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

Agent Health Monitoring gives you continuous, real-time insight into the operational status of every registered agent in your organization. It answers the critical question: *"Are my agents actually running?"*

### Why it matters

- **Availability visibility** — Instantly see which agents are healthy, degraded, or offline across your fleet.
- **Proactive alerting** — Configurable alert rules notify your team before minor issues become outages.
- **Operational metrics** — Track heartbeat history, success/failure rates, and health score trends over time.
- **Incident response** — Health event history provides an audit trail of state transitions for post-incident analysis.

### Tier requirement

Health Monitoring is available on **Professional** and **Enterprise** plans. Organizations on Free or Starter tiers will receive a `403` response with:

```json
{
  "error": "feature_not_available",
  "message": "This feature requires a professional plan or higher",
  "required_tier": "professional",
  "current_tier": "starter"
}
```

---

## 2. Health State Machine

Every agent has a `health_status` field that transitions through four states based on heartbeat activity.

### States

| State | Description |
|-------|-------------|
| **unknown** | Agent registered but has never sent a heartbeat |
| **healthy** | Agent is sending heartbeats within the expected interval |
| **stale** | No heartbeat received for 2–10 minutes |
| **offline** | No heartbeat received for more than 10 minutes |

### State diagram

```
                  first heartbeat
    ┌─────────┐ ──────────────────► ┌─────────┐
    │ unknown │                     │ healthy │ ◄──────────────┐
    └─────────┘                     └────┬────┘               │
                                         │                    │
                              no heartbeat for 2 min          │ heartbeat received
                                         │                    │
                                         ▼                    │
                                    ┌─────────┐               │
                                    │  stale  │ ──────────────┘
                                    └────┬────┘               │
                                         │                    │
                              no heartbeat for 10 min         │ heartbeat received
                                         │                    │
                                         ▼                    │
                                    ┌─────────┐               │
                                    │ offline │ ──────────────┘
                                    └─────────┘
```

### Transition rules

| From | To | Trigger |
|------|----|---------|
| `unknown` | `healthy` | First heartbeat received |
| `healthy` | `stale` | No heartbeat for > 2 minutes (background job) |
| `stale` | `offline` | No heartbeat for > 10 minutes (background job) |
| `stale` | `healthy` | Heartbeat received |
| `offline` | `healthy` | Heartbeat received |

Every transition is recorded as a health event and published on the EventBus.

---

## 3. Heartbeat Protocol

Agents report their status by sending periodic heartbeats to the platform.

### Endpoint

```
POST /agents/:agentId/heartbeat
```

**Authentication:** Bearer token with `write` scope.

### Request body (optional metadata)

```json
{
  "metadata": {
    "version": "1.4.2",
    "uptime": 86400,
    "errorCount": 3,
    "memoryUsage": 256,
    "cpuUsage": 12.5
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Agent software version |
| `uptime` | integer | Agent uptime in seconds |
| `errorCount` | integer | Errors since last heartbeat |
| `memoryUsage` | number | Memory usage in MB |
| `cpuUsage` | number | CPU usage as a percentage |

### Response

```json
{
  "status": "ok",
  "next_expected": 120,
  "timestamp": "2026-05-02T12:00:00.000Z"
}
```

- **`next_expected`** — Number of seconds until the server expects the next heartbeat (120 seconds).
- The agent should send heartbeats at or before this interval to stay in the `healthy` state.

### What happens on receipt

1. `last_heartbeat` is updated to `NOW()`.
2. `health_status` is set to `healthy`.
3. If the previous status was not `healthy`, a health event is recorded and an `agent.health_changed` event is published.

---

## 4. Background Health Job

A server-side background job runs **every 60 seconds** to reconcile agent health statuses.

### Process

1. **Mark stale** — Agents with `health_status = 'healthy'` whose `last_heartbeat` is older than **2 minutes** are transitioned to `stale`.
2. **Mark offline** — Agents with `health_status IN ('healthy', 'stale')` whose `last_heartbeat` is older than **10 minutes** are transitioned to `offline`.
3. **Record events** — A health event is persisted for each transition.
4. **Publish events** — An `agent.health_changed` event is published to the EventBus for each transition.
5. **Evaluate alert rules** — All enabled alert rules for affected organizations are evaluated against the transitioned agents.

### Timing considerations

Because the job runs every 60 seconds, there is up to a 60-second delay between when a threshold is crossed and when the status transition occurs. This means:

- An agent may appear `healthy` for up to **~3 minutes** after its last heartbeat before being marked `stale`.
- An agent may appear `stale` for up to **~11 minutes** before being marked `offline`.

---

## 5. Health Events

Every health status transition is permanently recorded in the `agent_health_events` table.

### Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `agent_id` | UUID | The agent that transitioned |
| `org_id` | UUID | Owning organization |
| `previous_status` | VARCHAR(20) | Status before transition (null for first event) |
| `new_status` | VARCHAR(20) | Status after transition |
| `trigger` | VARCHAR(50) | What caused the transition (`heartbeat` or `background_job`) |
| `metadata` | JSONB | Optional runtime metadata from heartbeat |
| `created_at` | TIMESTAMPTZ | When the event was recorded |

### EventBus events

Two event types are published:

#### `agent.health_changed`

Published on every health status transition.

```json
{
  "agentId": "abc-123",
  "orgId": "org-456",
  "previousStatus": "stale",
  "newStatus": "healthy",
  "trigger": "heartbeat"
}
```

#### `agent.alert_triggered`

Published when an alert rule fires.

```json
{
  "agentId": "abc-123",
  "orgId": "org-456",
  "ruleId": "rule-789",
  "ruleName": "Production Offline Alert",
  "condition": "agent_offline",
  "details": {
    "message": "Agent went offline",
    "previousStatus": "stale"
  }
}
```

---

## 6. Alert Rules

Alert rules let you define automated notifications based on agent health conditions. Rules are configured per-organization and evaluated by the background health job.

### Available conditions

| Condition | Description | Threshold |
|-----------|-------------|-----------|
| `agent_offline` | Fires when any agent transitions to `offline` | None |
| `agent_stale` | Fires when any agent transitions to `stale` | None |
| `high_failure_rate` | Fires when an agent's `failed_actions / total_actions` exceeds the threshold | `threshold_percent` (e.g., `25` = 25%) |
| `no_heartbeat` | Fires when an agent has been registered longer than the threshold but has never sent a heartbeat | `threshold_minutes` (e.g., `30`) |

### How evaluation works

- **Transition-based rules** (`agent_offline`, `agent_stale`) are evaluated against agents that transitioned during the current background job cycle.
- **Metric-based rules** (`high_failure_rate`, `no_heartbeat`) are evaluated by querying the database for all agents in affected organizations.
- When a rule fires, an `agent.alert_triggered` event is published to the EventBus.

---

## 7. Setting Up Alert Rules

Manage alert rules through the REST API. All endpoints require authentication and operate within the caller's organization scope.

### Create a rule

```bash
curl -X POST https://api.countersig.ai/agents/health/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Offline Alert",
    "condition": "agent_offline",
    "notifyWebhook": true
  }'
```

### Create a rule with a threshold

```bash
curl -X POST https://api.countersig.ai/agents/health/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Error Rate",
    "condition": "high_failure_rate",
    "thresholdPercent": 25,
    "notifyWebhook": true
  }'
```

### List all rules

```bash
curl https://api.countersig.ai/agents/health/alerts \
  -H "Authorization: Bearer $TOKEN"
```

### Update a rule

```bash
curl -X PUT https://api.countersig.ai/agents/health/alerts/$RULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Renamed Alert",
    "enabled": false
  }'
```

### Disable a rule without deleting

```bash
curl -X PUT https://api.countersig.ai/agents/health/alerts/$RULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

### Delete a rule

```bash
curl -X DELETE https://api.countersig.ai/agents/health/alerts/$RULE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Webhook Integration

Alert events integrate seamlessly with Countersig's existing webhook system. When an alert rule fires with `notify_webhook: true`, the `agent.alert_triggered` event is published on the EventBus and automatically delivered to any webhook subscriptions matching `agent.*` patterns.

### Setup

1. **Create a webhook subscription** for the `agent.alert_triggered` event (or use a wildcard pattern like `agent.*`).
2. **Create alert rules** with `notifyWebhook: true`.
3. When a rule fires, your webhook endpoint receives a POST with the alert payload.

### Example webhook payload

```json
{
  "event": "agent.alert_triggered",
  "timestamp": "2026-05-02T12:01:00.000Z",
  "data": {
    "agentId": "abc-123",
    "orgId": "org-456",
    "ruleId": "rule-789",
    "ruleName": "Production Offline Alert",
    "condition": "agent_offline",
    "details": {
      "message": "Agent went offline",
      "previousStatus": "stale"
    }
  }
}
```

You can also subscribe to `agent.health_changed` events to receive notifications on **every** status transition, not just alert-triggering ones.

### Delivery guarantees

Webhook delivery follows Countersig's standard resilience policy:

- **Retry strategy:** Exponential backoff with up to 6 retries (intervals: 1s, 2s, 4s, 8s, 16s, 32s)
- **Circuit breaker:** Retries disabled for 5 minutes after 5 consecutive failures per destination
- **Rate limiting:** 100 webhooks per minute per destination URL (Redis-backed)
- **Timeout:** 10-second HTTP timeout per delivery attempt
- **Audit logging:** Final delivery failure is logged after all retries are exhausted

---

## 9. Frontend Integration

Health monitoring data is surfaced in two areas of the Countersig dashboard.

### Dashboard health overview

The main Dashboard page includes an organization-wide health overview:

- **Distribution bar** — Visual breakdown of agents by health status (healthy, stale, offline, unknown).
- **Health score** — Percentage of agents in `healthy` status: `Math.round((healthy / total) * 100)`.
- **Needs attention list** — Agents in `stale` or `offline` status, sorted by oldest heartbeat first (up to 20 agents).

### AgentDetail health panel

Each agent's detail page includes a dedicated health tab:

- **Status indicator** — Current health status with color coding (green = healthy, yellow = stale, red = offline, gray = unknown).
- **Success rate** — Calculated from `successful_actions / (successful_actions + failed_actions)`.
- **Last heartbeat** — Timestamp of the most recent heartbeat with relative time display.
- **Event timeline** — The 20 most recent health events showing status transitions, triggers, and timestamps.

### Frontend API helpers

Health data is fetched via the following API helper functions:

```javascript
// Fetch org-wide health summary
const summary = await authApi.getHealthSummary();

// Fetch individual agent health details + event history
const health = await authApi.getAgentHealth(agentId);

// Manage alert rules
const rules  = await authApi.getAlertRules();
const rule   = await authApi.createAlertRule({ name, condition, ... });
const updated = await authApi.updateAlertRule(ruleId, { enabled: false });
await authApi.deleteAlertRule(ruleId);
```

---

## 10. API Reference

All endpoints require a valid Bearer token in the `Authorization` header. Health monitoring endpoints are gated to **Professional** and **Enterprise** tiers.

### POST /agents/:agentId/heartbeat

Send a heartbeat to mark the agent as healthy.

```bash
curl -X POST https://api.countersig.ai/agents/abc-123/heartbeat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "metadata": { "version": "1.4.2", "uptime": 86400 } }'
```

**Response (200):**
```json
{
  "status": "ok",
  "next_expected": 120,
  "timestamp": "2026-05-02T12:00:00.000Z"
}
```

---

### GET /agents/:agentId/health

Get health details and event history for a specific agent.

```bash
curl https://api.countersig.ai/agents/abc-123/health \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "agentId": "abc-123",
  "name": "My Production Agent",
  "healthStatus": "healthy",
  "lastHeartbeat": "2026-05-02T11:59:30.000Z",
  "lastVerified": "2026-05-01T10:00:00.000Z",
  "successfulActions": 1024,
  "failedActions": 12,
  "successRate": 99,
  "events": [
    {
      "id": 42,
      "agent_id": "abc-123",
      "org_id": "org-456",
      "previous_status": "stale",
      "new_status": "healthy",
      "trigger": "heartbeat",
      "metadata": null,
      "created_at": "2026-05-02T11:59:30.000Z"
    }
  ]
}
```

---

### GET /agents/health/summary

Get organization-wide health summary with agents needing attention.

```bash
curl https://api.countersig.ai/agents/health/summary \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "summary": {
    "healthy": 15,
    "stale": 2,
    "offline": 1,
    "unknown": 3,
    "total": 21,
    "healthScore": 71
  },
  "needsAttention": [
    {
      "agent_id": "abc-123",
      "name": "Staging Agent",
      "health_status": "offline",
      "last_heartbeat": "2026-05-02T11:30:00.000Z",
      "successful_actions": 500,
      "failed_actions": 10
    }
  ]
}
```

---

### GET /agents/health/alerts

List all alert rules for the organization.

```bash
curl https://api.countersig.ai/agents/health/alerts \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "rules": [
    {
      "id": "rule-789",
      "org_id": "org-456",
      "name": "Production Offline Alert",
      "enabled": true,
      "condition": "agent_offline",
      "threshold_minutes": null,
      "threshold_percent": null,
      "notify_webhook": true,
      "created_at": "2026-05-01T10:00:00.000Z",
      "updated_at": "2026-05-01T10:00:00.000Z"
    }
  ]
}
```

---

### POST /agents/health/alerts

Create a new alert rule.

```bash
curl -X POST https://api.countersig.ai/agents/health/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "No Heartbeat Warning",
    "condition": "no_heartbeat",
    "thresholdMinutes": 30,
    "notifyWebhook": true
  }'
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable rule name |
| `condition` | string | Yes | One of: `agent_offline`, `agent_stale`, `high_failure_rate`, `no_heartbeat` |
| `thresholdMinutes` | integer | No | Required for `no_heartbeat` condition |
| `thresholdPercent` | integer | No | Required for `high_failure_rate` condition |
| `notifyWebhook` | boolean | No | Send alerts to webhooks (default: `true`) |

**Response (201):**
```json
{
  "rule": {
    "id": "rule-new",
    "org_id": "org-456",
    "name": "No Heartbeat Warning",
    "enabled": true,
    "condition": "no_heartbeat",
    "threshold_minutes": 30,
    "threshold_percent": null,
    "notify_webhook": true,
    "created_at": "2026-05-02T12:00:00.000Z",
    "updated_at": "2026-05-02T12:00:00.000Z"
  }
}
```

---

### PUT /agents/health/alerts/:ruleId

Update an existing alert rule. All fields are optional — only provided fields are updated.

```bash
curl -X PUT https://api.countersig.ai/agents/health/alerts/rule-789 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

**Response (200):**
```json
{
  "rule": { "id": "rule-789", "enabled": false, "..." : "..." }
}
```

**Response (404):**
```json
{ "error": "Alert rule not found" }
```

---

### DELETE /agents/health/alerts/:ruleId

Permanently delete an alert rule.

```bash
curl -X DELETE https://api.countersig.ai/agents/health/alerts/rule-789 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{ "message": "Alert rule deleted" }
```

**Response (404):**
```json
{ "error": "Alert rule not found" }
```

---

## 11. Best Practices

### Heartbeat interval

- Use the server-recommended interval of **120 seconds** (returned in `next_expected`).
- Avoid sending heartbeats too frequently — it adds unnecessary load without improving detection speed since the background job runs every 60 seconds.
- Include metadata (version, uptime, resource usage) with every heartbeat for richer operational insight.

### Alert rule strategies

- **Start simple:** Create `agent_offline` and `agent_stale` rules first — these catch the most common issues.
- **Add `no_heartbeat` rules** with a 30–60 minute threshold to detect agents that were registered but never started.
- **Use `high_failure_rate`** with a 20–30% threshold to catch agents experiencing elevated error rates before they go fully offline.
- **Name rules descriptively** (e.g., "Production Agent Offline" rather than "Rule 1") for clearer webhook notifications.
- **Disable rather than delete** rules you temporarily don't need — you preserve the configuration for easy re-enabling.

### Monitoring at scale

- Use the **health summary endpoint** to get a fleet-wide view without fetching individual agents.
- Monitor the **healthScore** metric from the summary as a single organizational KPI.
- Set up webhook integrations to route alerts to PagerDuty, Slack, or your incident management platform.
- For large fleets (100+ agents), consider staggering heartbeat sends across the interval to avoid thundering-herd effects.

---

## 12. Troubleshooting

### Agents stuck in "unknown" status

**Cause:** The agent has never sent a heartbeat.

**Solution:**
- Verify your agent is configured with the correct `agentId` and API token.
- Confirm the heartbeat endpoint URL is correct: `POST /agents/:agentId/heartbeat`.
- Check that the token has `write` scope and the agent belongs to the authenticated user's organization.
- Use the `no_heartbeat` alert rule to automatically flag agents that remain in `unknown` beyond a threshold.

### False stale alerts

**Cause:** The background job has a 60-second polling interval, so there is a timing window where transient network delays can cause brief misclassification.

**Solution:**
- Ensure your agent sends heartbeats well within the 120-second window (e.g., every 90–100 seconds) to provide margin.
- If you see frequent stale transitions followed by immediate recovery, your agent's heartbeat interval may be too close to the 2-minute threshold.
- Check for network issues between the agent and the Countersig API.

### Alert rules not firing

**Cause:** Several configuration issues can prevent rules from firing.

**Solution:**
1. **Verify the rule is enabled:** `GET /agents/health/alerts` and check `"enabled": true`.
2. **Check the condition matches:** `agent_offline` only fires on transitions *to* offline, not if the agent is already offline.
3. **Verify thresholds:** For `high_failure_rate`, ensure agents have recorded actions (`successful_actions + failed_actions > 0`). For `no_heartbeat`, ensure agents have been registered longer than `threshold_minutes`.
4. **Check webhook subscriptions:** If `notify_webhook` is true but you're not receiving webhooks, verify you have an active webhook subscription for `agent.alert_triggered` or `agent.*` events.
5. **Review EventBus:** Alert events are published to the EventBus — if no subscriber is listening, the event is still fired but no action is taken.

### Agents transitioning directly from healthy to offline

**Cause:** If an agent's last heartbeat is older than 10 minutes when the background job runs, it will jump from `healthy` directly to `offline` (the background job updates `offline` for agents with status `IN ('healthy', 'stale')`).

**Solution:** This can happen when the background job was delayed or if the server restarted. In this case, the recorded `previous_status` in the health event may show `stale` even if the agent was never observed in the stale state during normal polling. This is expected behavior — the transitions are evaluated atomically during each job run.
