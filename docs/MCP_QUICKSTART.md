# MCP Server Quick Start — Using Countersig with Claude

## Overview

Countersig's MCP server lets AI agents (Claude, etc.) register identities, build reputation, issue verifiable credentials, and communicate agent-to-agent — all through natural conversation. Instead of writing code or calling APIs manually, you simply talk to Claude and it handles everything behind the scenes.

---

## Prerequisites

- **Claude Desktop** or **Claude Code** installed
- **Node.js 18+** (for `npx`)
- An **Countersig account** — [countersig.com/signup](https://countersig.com/signup)

---

## Step 1: Create Your API Key

1. Log into [countersig.com](https://countersig.com)
2. Go to **Settings → API Keys**
3. Click **"Create API Key"**
4. Set a name (e.g., `Claude MCP`) and scope: `read,write`
5. **Copy the key immediately** — it's only shown once
6. Key format: `cs_xxxxxxxxxxxxxxx`

> ⚠️ Store your API key securely. If you lose it, you'll need to generate a new one.

---

## Step 2: Install the MCP Server

### Claude Code (one command)

```bash
claude mcp add countersig -- npx -y @countersig/mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "countersig": {
      "command": "npx",
      "args": ["-y", "@countersig/mcp"],
      "env": {
        "COUNTERSIG_API_KEY": "cs_xxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Environment Variable (alternative)

```bash
export COUNTERSIG_API_KEY=cs_xxxxxxxxxxxxxxx
```

Configuration is stored in `~/.countersig/config.json`.

---

## Step 3: Configure (First Conversation)

Tell Claude:

> "Configure my Countersig with API key `cs_xxxxx`"

- Claude calls the `configure` tool
- Config saved locally to `~/.countersig/config.json`
- **Only needed once** — persists across sessions

---

## Step 4: Register Your First Agent

Tell Claude:

> "Register a new agent called my-research-bot with web-search and analysis capabilities"

What happens:
- Claude calls `register_agent`
- Auto-generates an **Ed25519 keypair**
- Returns your `agentId` + public key
- Private key stored securely in config

---

## Step 5: Verify Your Agent

Tell Claude:

> "Verify my agent"

What happens:
- Claude calls `verify_agent`
- Automatic **challenge-response** (signs with stored private key)
- Agent status: **verified** ✓
- Now eligible for trust badges and higher reputation

---

## Available Tools Reference

| Tool | What It Does | Requires Auth | Example Prompt |
|------|-------------|---------------|----------------|
| `configure` | Set API key and agent ID | No | "Configure my Countersig with key cs_xxx" |
| `register_agent` | Create new agent identity | Yes | "Register an agent called my-bot" |
| `verify_agent` | Complete PKI verification | Yes + Key | "Verify my agent" |
| `get_agent` | Check agent status & reputation | Yes | "What's my agent's status?" |
| `get_reputation` | Full reputation breakdown | Yes | "Show reputation for agent X" |
| `get_trust_badge` | Retrieve trust badge (JSON/SVG) | Yes | "Get my trust badge" |
| `get_verifiable_credential` | Export W3C Verifiable Credential | Yes | "Export my verifiable credential" |
| `attest_action` | Record action success/failure | Yes | "Record that I completed a web search" |
| `issue_a2a_token` | Generate agent-to-agent JWT (60s) | Yes | "Generate an A2A token" |
| `verify_a2a_token` | Verify token from another agent | Yes | "Verify this token: eyJ..." |
| `authenticated_fetch` | HTTP with auto A2A token injection | Yes | "Fetch https://api.example.com/data" |

---

## Common Workflows

### Building Reputation

```
You: "Record that I successfully completed a data analysis task"
Claude: ✓ Attested action 'data-analysis' (success). Your BAGS score is now 72.
```

### Agent-to-Agent Communication

```
You: "Generate an A2A token for calling the payment-agent"
Claude: Here's your token (valid 60 seconds): eyJhbG...
        Send this in the Authorization header when calling the other agent.
```

### Fetching with Identity

```
You: "Call https://api.partner.com/verify with my agent identity"
Claude: ✓ Response (200): { "verified": true, "agent": "my-research-bot" }
        (Automatically included X-AgentID-Token and Authorization headers)
```

### Exporting Credentials

```
You: "Export my verifiable credential"
Claude: Here's your W3C Verifiable Credential:
        - Issuer: did:web:countersig.com
        - Subject: your-agent-id
        - Status: verified
        - BAGS Score: 72
```

---

## Two Registration Paths

- **MCP-First (Developers):** Get API key from web → install MCP → Claude handles registration + verification
- **Dashboard-First (Visual Users):** Register agent on web UI → get agentId → configure MCP with both `apiKey` and `agentId`

---

## Public Endpoints (No Auth Required)

These work without any configuration:

| Endpoint | Description |
|----------|-------------|
| `GET /public/agents` | Browse agent registry |
| `GET /badge/:agentId` | View trust badges |
| `POST /agents/verify-token` | Verify A2A tokens |
| `GET /agents/chains` | List supported chains |

---

## Configuration Reference

| Setting | Environment Variable | Config File Key | Default |
|---------|---------------------|-----------------|---------|
| API Key | `COUNTERSIG_API_KEY` | `apiKey` | *(required)* |
| Agent ID | `COUNTERSIG_AGENT_ID` | `agentId` | *(set after registration)* |
| API URL | `COUNTERSIG_API_URL` | `apiUrl` | `https://api.countersig.com` |
| Private Key | — | `privateKey` | *(generated on registration)* |

> Environment variables override config file values.

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "API key not configured" | Run `configure` tool or set `COUNTERSIG_API_KEY` |
| "Agent not found" | Run `register_agent` first |
| "Verification failed" | Agent must be registered first; private key must exist in config |
| "Invalid API key format" | Keys must start with `cs_` |
| "HTTPS required" | API URLs must use HTTPS (localhost exempt for development) |

---

## Security Notes

- Private keys stored in `~/.countersig/config.json` (Unix: mode `0600`)
- API keys validated for format (`cs_*` prefix)
- `authenticated_fetch` blocks private/internal IP addresses (SSRF protection)
- A2A tokens expire after 60 seconds
- All API communication uses HTTPS

---

## Links

**Packages:**

- **SDK:** `npm install @countersig/sdk` | [npm](https://www.npmjs.com/package/@countersig/sdk) | [Source](https://github.com/RunTimeAdmin/Countersig-Public/tree/main/packages/sdk)
- **MCP Server:** `npx -y @countersig/mcp` | [npm](https://www.npmjs.com/package/@countersig/mcp) | [Source](https://github.com/RunTimeAdmin/Countersig-Public/tree/main/packages/mcp)
- **React Components:** `npm install @countersig/react` | [npm](https://www.npmjs.com/package/@countersig/react)
- **Verifier:** `npm install @countersig/verify` | [npm](https://www.npmjs.com/package/@countersig/verify)

**Guides:**

- [API Reference](API_REFERENCE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Widget Guide](WIDGET_GUIDE.md)
