# SIEM Integration Guide

Stream Countersig audit events to your Security Information and Event Management (SIEM) platform in real time — enabling centralized threat detection, compliance monitoring, and incident response across your AI agent fleet.

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Tier Requirement:** Enterprise

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Supported Formats](#3-supported-formats)
4. [Connector Types](#4-connector-types)
5. [Getting Started](#5-getting-started)
6. [Connector Configuration](#6-connector-configuration)
7. [Event Filtering](#7-event-filtering)
8. [Delivery & Reliability](#8-delivery--reliability)
9. [Testing Connectors](#9-testing-connectors)
10. [Monitoring Deliveries](#10-monitoring-deliveries)
11. [Frontend Integration](#11-frontend-integration)
12. [API Reference](#12-api-reference)
13. [Troubleshooting](#13-troubleshooting)
14. [Security](#14-security)

---

## 1. Overview

Countersig generates tamper-evident audit logs for every significant action in your organization — agent registrations, identity verifications, policy changes, API key operations, and more. The SIEM Integration feature forwards these events to external security platforms so your security team can:

- **Correlate** AI agent activity with other infrastructure events
- **Detect** anomalous patterns (off-hours operations, high-risk actions, bulk revocations)
- **Satisfy compliance** requirements by centralizing audit data in your SOC's toolchain
- **Trigger automated responses** via SIEM alerting rules

### Enterprise Tier Requirement

SIEM Integration is available exclusively on the **Enterprise** plan. Requests from organizations on Free, Starter, or Professional tiers receive a `403` response:

```json
{
  "error": "feature_not_available",
  "message": "This feature requires a enterprise plan or higher",
  "required_tier": "enterprise",
  "current_tier": "professional"
}
```

Upgrade your organization's plan to Enterprise to enable SIEM connectors.

---

## 2. Architecture

Audit events flow through an asynchronous, fault-tolerant pipeline before reaching your SIEM:

```
┌─────────────┐     ┌──────────┐     ┌─────────────────┐     ┌───────────┐
│ auditService │────▶│ EventBus │────▶│ siemService      │────▶│ BullMQ    │
│ logAction()  │     │ audit.   │     │ listener         │     │ Queue     │
│              │     │ created  │     │ (filter + match) │     │           │
└─────────────┘     └──────────┘     └─────────────────┘     └─────┬─────┘
                                                                    │
                                                              ┌─────▼─────┐
                                                              │  Worker   │
                                                              │ (conc: 5) │
                                                              └─────┬─────┘
                                                                    │
                                                         ┌──────────▼──────────┐
                                                         │  Format Adapter     │
                                                         │  (JSON / CEF /      │
                                                         │   Syslog)           │
                                                         └──────────┬──────────┘
                                                                    │
                                                              ┌─────▼─────┐
                                                              │ HTTP POST │
                                                              │ to SIEM   │
                                                              └───────────┘
```

**Step-by-step flow:**

1. **Audit event created** — `auditService.logAction()` inserts a hash-chained audit record and publishes an `audit.created` event on the in-process EventBus (non-blocking).
2. **SIEM listener receives event** — `siemService.initSiemListeners()` subscribes to `audit.created`. For each event, it queries all **enabled** connectors for the event's organization.
3. **Filter evaluation** — Each connector's `filter_actions` (glob patterns) and `min_risk_score` threshold are checked. Events that don't match are skipped.
4. **Job enqueued** — Matching events are added to the `siem-delivery` BullMQ queue with retry and backoff settings.
5. **Worker processes job** — A worker with concurrency 5 picks up the job, applies the connector's format adapter, builds authentication headers, and sends an HTTP POST to the endpoint.
6. **Delivery logged** — Success or failure is recorded in `siem_delivery_logs`. On failure, the consecutive failure counter increments; on success, it resets to 0.
7. **Circuit breaker** — If a connector accumulates 5 consecutive failures, it is automatically disabled.

---

## 3. Supported Formats

Each connector can be configured to deliver events in one of three formats.

### 3.1 JSON (default)

The JSON format wraps events in a Countersig envelope with metadata:

```json
{
  "source": "countersig",
  "version": "2.0",
  "connector": "My Splunk Connector",
  "timestamp": "2026-05-02T14:30:00.000Z",
  "events": [
    {
      "id": 12345,
      "timestamp": "2026-05-02T14:29:58.000Z",
      "action": "agent.registered",
      "actor": { "id": "user-uuid", "type": "user" },
      "resource": { "type": "agent", "id": "agent-uuid" },
      "riskScore": 10,
      "orgId": "org-uuid",
      "changes": { "name": "my-agent" },
      "metadata": { "ip": "192.168.1.1", "offHours": false }
    }
  ]
}
```

**Content-Type:** `application/json`  
**Best for:** Generic HTTP endpoints, Datadog, Elasticsearch, custom pipelines.

### 3.2 CEF (Common Event Format)

CEF is widely supported by Splunk, ArcSight, and other enterprise SIEM platforms. Each event produces one CEF line:

```
CEF:0|Countersig|AgentID|2.0|agent.registered|agent.registered|1|act=agent.registered src=192.168.1.1 suid=user-uuid cs1=org-uuid cs1Label=orgId cs2=agent cs2Label=resourceType cs3=agent-uuid cs3Label=resourceId rt=1746192598000
```

**Header format:** `CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension`

**Severity mapping** (based on `riskScore`):

| Risk Score | CEF Severity | Meaning  |
|-----------|-------------|----------|
| 80–100    | 10          | Critical |
| 50–79     | 7           | High     |
| 20–49     | 4           | Medium   |
| 0–19      | 1           | Low      |

**Content-Type:** `text/plain`  
**Best for:** Splunk HEC (with sourcetype `cef`), ArcSight, QRadar.

### 3.3 Syslog (RFC 5424)

Events are formatted per RFC 5424 with structured data elements:

```
<110>1 2026-05-02T14:29:58.000Z countersig agentid - 12345 [audit action="agent.registered" orgId="org-uuid" actorId="user-uuid" resourceType="agent" riskScore="10"] agent.registered
```

**PRI calculation:** `facility × 8 + severity`  
- **Facility:** 13 (log audit)
- **Severity mapping:**

| Risk Score | Syslog Severity | Keyword  |
|-----------|----------------|----------|
| 80–100    | 2              | Critical |
| 50–79     | 4              | Warning  |
| 0–49      | 6              | Info     |

**Content-Type:** `text/plain`  
**Best for:** Syslog collectors, rsyslog/syslog-ng over HTTP, SIEM platforms expecting RFC 5424.

---

## 4. Connector Types

The `connectorType` field determines how authentication headers are constructed:

| Type              | Auth Header                       | Notes                                  |
|-------------------|-----------------------------------|----------------------------------------|
| `splunk_hec`      | `Authorization: Splunk <token>`   | Splunk HTTP Event Collector format     |
| `datadog`         | `DD-API-KEY: <token>`             | Datadog API key header                 |
| `elasticsearch`   | `Authorization: Bearer <token>`   | Standard bearer token                  |
| `generic_http`    | `<authHeaderName>: Bearer <token>`| Customizable header name (defaults to `Authorization`) |
| `syslog`          | `<authHeaderName>: Bearer <token>`| Same as generic, for syslog-over-HTTP  |

For `generic_http` and `syslog` types, you can customize the authentication header name using the `authHeaderName` field.

---

## 5. Getting Started

### 5.1 Via the API

Create your first SIEM connector by sending a POST request:

```bash
curl -X POST https://api.countersig.com/orgs/{orgId}/siem/connectors \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Splunk Production",
    "connectorType": "splunk_hec",
    "endpointUrl": "https://splunk.example.com:8088/services/collector",
    "authToken": "your-hec-token",
    "format": "cef"
  }'
```

Then test the connector:

```bash
curl -X POST https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId}/test \
  -H "Authorization: Bearer <your-token>"
```

### 5.2 Via the UI

1. Navigate to **Settings → Integrations**
2. Click **Add Connector**
3. Fill in the connector form (name, type, endpoint URL, auth token, format)
4. Click **Save**, then click the **Test** button on the connector card
5. Verify the test status shows **success**

---

## 6. Connector Configuration

All available configuration fields when creating or updating a connector:

| Field                    | Type       | Required | Default          | Description |
|-------------------------|------------|----------|------------------|-------------|
| `name`                  | string     | Yes      | —                | Human-readable connector name |
| `connectorType`         | string     | Yes      | —                | One of: `splunk_hec`, `datadog`, `elasticsearch`, `generic_http`, `syslog` |
| `endpointUrl`           | string     | Yes      | —                | HTTPS URL of the SIEM ingestion endpoint |
| `authToken`             | string     | No       | `null`           | Authentication token (masked in responses) |
| `authHeaderName`        | string     | No       | `Authorization`  | Custom auth header name (for `generic_http`/`syslog` types) |
| `format`                | string     | No       | `json`           | Output format: `json`, `cef`, or `syslog` |
| `filterActions`         | string[]   | No       | `null` (all)     | Array of action patterns to include (supports glob `*`) |
| `minRiskScore`          | integer    | No       | `0`              | Minimum risk score threshold (0–100) |
| `batchSize`             | integer    | No       | `50`             | Maximum events per delivery batch |
| `flushIntervalSeconds`  | integer    | No       | `30`             | Seconds between flush cycles |
| `enabled`               | boolean    | No       | `true`           | Whether the connector is active |

---

## 7. Event Filtering

Connectors support two filtering mechanisms that are evaluated before an event is queued for delivery.

### 7.1 Action Patterns (`filterActions`)

An array of action name patterns. Events are delivered only if the action matches **at least one** pattern. If `filterActions` is `null` or empty, all actions are forwarded.

**Glob support:** Use `*` as a wildcard to match any sequence of characters.

```json
{
  "filterActions": [
    "agent.*",
    "policy.updated",
    "security.*",
    "bulk_revoke"
  ]
}
```

| Pattern           | Matches                                                   |
|-------------------|-----------------------------------------------------------|
| `agent.*`         | `agent.registered`, `agent.verified`, `agent.revoked`     |
| `policy.updated`  | Exactly `policy.updated`                                  |
| `security.*`      | `security.login_failed`, `security.key_rotated`           |
| `*`               | Every action (same as omitting `filterActions`)           |

### 7.2 Minimum Risk Score (`minRiskScore`)

Only events with a `riskScore` at or above this threshold are delivered. Useful for high-signal connectors that should only receive security-critical events.

```json
{
  "minRiskScore": 50
}
```

This would filter out routine actions (register = 10, update = 20) and only forward higher-risk events (flag = 50, revoke = 80, bulk_revoke = 95, delete = 90).

---

## 8. Delivery & Reliability

### 8.1 BullMQ Queue

Events are delivered through a Redis-backed BullMQ queue with the following settings:

| Setting             | Value                           |
|---------------------|---------------------------------|
| Queue name          | `siem-delivery`                 |
| Max attempts        | **6**                           |
| Backoff strategy    | Exponential                     |
| Base delay          | **2,000 ms** (2 seconds)        |
| Retry delays        | 2s → 4s → 8s → 16s → 32s → 64s |
| Worker concurrency  | **5** parallel jobs             |
| HTTP timeout        | 15,000 ms per request           |
| Max payload size    | 10 MB                           |
| Completed job retention | Last 100 jobs               |
| Failed job retention    | Last 500 jobs               |

### 8.2 Circuit Breaker

To protect against cascading failures from a misconfigured or unreachable endpoint, Countersig implements an automatic circuit breaker:

- **Threshold:** 5 consecutive delivery failures
- **Action:** The connector is **automatically disabled** (`enabled = false`)
- **Recovery:** An administrator must manually re-enable the connector after resolving the underlying issue (fix endpoint URL, rotate auth token, etc.)

The `consecutive_failures` counter resets to `0` on any successful delivery.

### 8.3 Delivery Logging

Every delivery attempt — successful or failed — is recorded in the `siem_delivery_logs` table with:

- `batch_count` — Number of events in the batch
- `success` — Boolean delivery result
- `status_code` — HTTP response status code
- `error` — Error message (truncated to 500 characters)
- `delivery_time_ms` — Round-trip time in milliseconds

---

## 9. Testing Connectors

Before relying on a connector for production traffic, use the test endpoint to verify connectivity and authentication.

```bash
curl -X POST https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId}/test \
  -H "Authorization: Bearer <your-token>"
```

**What happens during a test:**

1. A **synthetic test event** is generated with:
   - `action`: `siem.test`
   - `resourceType`: `siem_connector`
   - `riskScore`: `0`
   - `metadata.source`: `countersig-test`
2. The event is formatted using the connector's configured format adapter
3. An HTTP POST is sent directly (bypassing the BullMQ queue) with a **10-second timeout**
4. The connector's `test_status` is updated to `success` or `failed`
5. On failure, `test_error` stores the error message

**Response:**

```json
// Success
{ "success": true, "statusCode": 200 }

// Failure
{ "success": false, "statusCode": 401, "error": "Unauthorized" }
```

---

## 10. Monitoring Deliveries

Retrieve the delivery history for a specific connector:

```bash
curl "https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId}/deliveries?limit=20&offset=0" \
  -H "Authorization: Bearer <your-token>"
```

**Response:**

```json
{
  "deliveries": [
    {
      "id": 1042,
      "connector_id": "connector-uuid",
      "batch_count": 12,
      "success": true,
      "status_code": 200,
      "error": null,
      "delivery_time_ms": 340,
      "created_at": "2026-05-02T14:30:00.000Z"
    },
    {
      "id": 1041,
      "connector_id": "connector-uuid",
      "batch_count": 5,
      "success": false,
      "status_code": 503,
      "error": "Service Unavailable",
      "delivery_time_ms": 15002,
      "created_at": "2026-05-02T14:29:00.000Z"
    }
  ]
}
```

**Pagination:** Use `limit` (max 100) and `offset` query parameters. Results are ordered by `created_at DESC`.

---

## 11. Frontend Integration

The SIEM management UI is located in **Settings → Integrations**.

### Connector Cards

Each configured connector is displayed as a card showing:

- Connector name and type
- Endpoint URL
- Format (JSON / CEF / Syslog)
- Enabled/disabled toggle
- Test status badge (`untested`, `success`, `failed`)
- Last delivery timestamp

### Adding a Connector

1. Click **Add Connector**
2. Fill in the form:
   - **Name** — descriptive label
   - **Connector Type** — select from dropdown
   - **Endpoint URL** — your SIEM ingestion URL
   - **Auth Token** — authentication credential
   - **Format** — output format
   - **Filter Actions** — comma-separated action patterns
   - **Min Risk Score** — numeric threshold
3. Click **Save**

### Testing

Click the **Test** button on any connector card. The UI sends a test request and displays the result inline.

### Delivery Logs

Expand a connector card to view its recent delivery log table with batch count, status, HTTP code, error message, and delivery time.

---

## 12. API Reference

All SIEM endpoints are scoped under `/orgs/:orgId/siem/connectors` and require:

- **Authentication:** Valid bearer token
- **Organization context:** Valid `orgId` parameter
- **Authorization:** Admin role (Manager or Admin for read-only endpoints)
- **Tier:** Enterprise plan (`siem_integration` feature)

### 12.1 List Connectors

```
GET /orgs/:orgId/siem/connectors
```

**Required role:** Manager or Admin

```bash
curl https://api.countersig.com/orgs/{orgId}/siem/connectors \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "connectors": [
    {
      "id": "connector-uuid",
      "org_id": "org-uuid",
      "name": "Splunk Production",
      "connector_type": "splunk_hec",
      "endpoint_url": "https://splunk.example.com:8088/services/collector",
      "auth_token_hash": "••••••••",
      "auth_header_name": "Authorization",
      "format": "cef",
      "filter_actions": ["agent.*", "security.*"],
      "min_risk_score": 0,
      "batch_size": 50,
      "flush_interval_seconds": 30,
      "enabled": true,
      "test_status": "success",
      "test_error": null,
      "last_delivery_at": "2026-05-02T14:30:00.000Z",
      "consecutive_failures": 0,
      "created_at": "2026-05-01T10:00:00.000Z",
      "updated_at": "2026-05-02T14:30:00.000Z"
    }
  ]
}
```

### 12.2 Create Connector

```
POST /orgs/:orgId/siem/connectors
```

**Required role:** Admin

```bash
curl -X POST https://api.countersig.com/orgs/{orgId}/siem/connectors \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Datadog Security",
    "connectorType": "datadog",
    "endpointUrl": "https://http-intake.logs.datadoghq.com/api/v2/logs",
    "authToken": "your-dd-api-key",
    "format": "json",
    "filterActions": ["security.*", "policy.*"],
    "minRiskScore": 20
  }'
```

**Validation:**

- `name`, `connectorType`, and `endpointUrl` are required
- `connectorType` must be one of: `splunk_hec`, `datadog`, `elasticsearch`, `generic_http`, `syslog`
- `format` must be one of: `json`, `cef`, `syslog`

**Response:** `201 Created`

### 12.3 Update Connector

```
PUT /orgs/:orgId/siem/connectors/:connectorId
```

**Required role:** Admin

```bash
curl -X PUT https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "minRiskScore": 50,
    "enabled": true
  }'
```

Only the provided fields are updated; omitted fields remain unchanged.

### 12.4 Delete Connector

```
DELETE /orgs/:orgId/siem/connectors/:connectorId
```

**Required role:** Admin

```bash
curl -X DELETE https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId} \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{ "message": "Connector deleted" }
```

Deleting a connector also removes all associated delivery logs (cascading delete).

### 12.5 Test Connector

```
POST /orgs/:orgId/siem/connectors/:connectorId/test
```

**Required role:** Admin

```bash
curl -X POST https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId}/test \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{ "success": true, "statusCode": 200 }
```

### 12.6 List Delivery Logs

```
GET /orgs/:orgId/siem/connectors/:connectorId/deliveries
```

**Required role:** Manager or Admin

```bash
curl "https://api.countersig.com/orgs/{orgId}/siem/connectors/{connectorId}/deliveries?limit=25&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Query parameters:**

| Param    | Type    | Default | Max | Description              |
|----------|---------|---------|-----|--------------------------|
| `limit`  | integer | 50      | 100 | Number of records        |
| `offset` | integer | 0       | —   | Pagination offset        |

---

## 13. Troubleshooting

### Circuit breaker tripped (connector auto-disabled)

**Symptom:** Connector shows `enabled: false` and `consecutive_failures: 5`.

**Resolution:**
1. Check the delivery logs for error details: `GET .../deliveries?limit=5`
2. Verify the endpoint URL is reachable from the Countersig server
3. Confirm the auth token is valid and not expired
4. Fix the underlying issue, then re-enable the connector via `PUT` with `"enabled": true`
5. Run a test to confirm: `POST .../test`

### Authentication failures (401/403)

**Symptom:** Deliveries fail with `status_code: 401` or `403`.

**Resolution by connector type:**
- **splunk_hec** — Verify the HEC token is valid and the HEC endpoint is enabled in Splunk
- **datadog** — Confirm the DD-API-KEY has log ingestion permissions
- **generic_http** — Check that `authHeaderName` matches what your endpoint expects and the token format is correct (the system prepends `Bearer ` automatically)

### Format mismatches

**Symptom:** SIEM receives data but cannot parse it.

**Resolution:**
- Ensure the connector's `format` matches what your SIEM expects (e.g., use `cef` for Splunk with sourcetype `cef`, `json` for Datadog)
- Send a test event and inspect the raw payload in your SIEM to verify the format

### Tier gating error

**Symptom:** `403` response with `"error": "feature_not_available"`.

**Resolution:** SIEM integration requires the Enterprise plan. Check your organization's current tier in Settings → Billing, and upgrade if needed.

### Events not appearing in SIEM

**Symptom:** Connector is enabled and tested successfully, but expected events don't arrive.

**Resolution:**
1. Check `filterActions` — your action patterns may be too restrictive
2. Check `minRiskScore` — routine actions have low risk scores (register = 10, update = 20)
3. Verify the connector is still `enabled` (circuit breaker may have tripped)
4. Confirm Redis is running — BullMQ requires Redis for the delivery queue

---

## 14. Security

### Token Storage

Auth tokens are stored in the `auth_token_hash` column. Despite the column name, tokens are stored in their original form because they must be sent as HTTP headers during delivery. **All API responses mask tokens** as `••••••••` to prevent accidental exposure in logs or UI.

### Transport Security

- **HTTPS is strongly recommended** for all SIEM endpoint URLs. Tokens are transmitted in HTTP headers; using plain HTTP exposes them to network interception.
- Delivery requests are sent with `maxRedirects: 0` to prevent token leakage through redirects.

### Access Control

- **Creating, updating, deleting, and testing** connectors requires the **Admin** role.
- **Listing** connectors and delivery logs requires **Manager** or **Admin** role.
- All endpoints are scoped to the requesting user's organization.

### Request Identification

All SIEM delivery requests include a `User-Agent: Countersig-SIEM/2.0` header, making it easy to identify Countersig traffic in your SIEM's access logs.
