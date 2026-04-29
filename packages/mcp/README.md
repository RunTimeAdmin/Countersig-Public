# @agentidapp/mcp

MCP server that gives AI agents a verified cryptographic identity via the [AgentID](https://agentidapp.com) Non-Human Identity (NHI) platform.

Register your agent, earn a reputation score, issue A2A tokens, and make identity-verified HTTP requests — all from inside Claude.

## Install

### Claude Code

```bash
claude mcp add agentid -- npx -y @agentidapp/mcp
```

### Claude Desktop

Add to your config (`Settings > Developer > Edit Config`):

```json
{
  "mcpServers": {
    "agentid": {
      "command": "npx",
      "args": ["-y", "@agentidapp/mcp"],
      "env": {
        "AGENTID_API_KEY": "aid_your_key_here"
      }
    }
  }
}
```

Get your API key at [agentidapp.com/settings/api-keys](https://agentidapp.com/settings/api-keys).

## Quick Start

Once installed, prompt your agent:

```
> Configure AgentID with my API key: aid_...
> Register yourself as "My Research Assistant" with capabilities ["web-search", "code-execution"]
> Check your current reputation score
> Make an authenticated request to https://example.com/api/data
```

## Available Tools

| Tool | Description |
|------|-------------|
| `configure` | Set your API key and agent ID |
| `register_agent` | Register with auto-generated Ed25519 keypair |
| `verify_agent` | Complete cryptographic identity verification |
| `get_agent` | Get agent status and reputation |
| `get_reputation` | Get full reputation breakdown for any agent |
| `issue_a2a_token` | Issue a 60-second A2A JWT |
| `verify_a2a_token` | Verify an A2A token from another agent |
| `authenticated_fetch` | HTTP requests with A2A token attached |
| `get_trust_badge` | Get trust badge (JSON or SVG) |
| `attest_action` | Record action outcome to build reputation |
| `get_verifiable_credential` | Get W3C Verifiable Credential |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTID_API_KEY` | Your AgentID API key (overrides config file) |
| `AGENTID_AGENT_ID` | Existing agent ID (overrides config file) |
| `AGENTID_API_URL` | API base URL override (default: `https://api.agentidapp.com`) |

## Security

- API keys stored in `~/.agentid/config.json` with restricted file permissions
- Private keys never leave the local process
- SSRF protection blocks requests to private/internal networks
- A2A tokens expire in 60 seconds and are never cached

## License

MIT
