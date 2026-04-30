# @agentidapp/verify

AgentID A2A token verification library. Verify agent-to-agent authentication tokens issued by the AgentID platform.

## Installation

```bash
npm install @agentidapp/verify
```

For remote verification (no shared secret), also install axios:

```bash
npm install axios
```

## Usage

### Local Verification (with shared secret)

Fastest method — no network call required.

```javascript
const { AgentIDVerifier } = require('@agentidapp/verify');

const verifier = new AgentIDVerifier({
  secret: process.env.A2A_TOKEN_SECRET
});

const payload = verifier.verifyLocal(token);
console.log(payload.sub);    // Agent ID
console.log(payload.caps);   // Agent capabilities
console.log(payload.score);  // BAGS reputation score
```

### Remote Verification (via AgentID API)

No shared secret needed — the AgentID API verifies the token server-side.

```javascript
const { AgentIDVerifier } = require('@agentidapp/verify');

const verifier = new AgentIDVerifier({
  apiUrl: 'https://api.agentidapp.com'
});

const payload = await verifier.verifyRemote(token);
console.log(payload.sub);    // Agent ID
console.log(payload.name);   // Agent name
```

### Auto-Detect Verification Method

Uses local verification when a secret is available, falls back to remote otherwise.

```javascript
const verifier = new AgentIDVerifier({
  secret: process.env.A2A_TOKEN_SECRET,          // optional
  apiUrl: 'https://api.agentidapp.com'           // optional
});

const payload = await verifier.verify(token);
```

### Inspect Token (no verification)

```javascript
const decoded = verifier.decode(token);
console.log(decoded);  // Raw payload — DO NOT trust for auth decisions
```

## Token Payload

A verified A2A token contains:

| Field  | Type     | Description                        |
| ------ | -------- | ---------------------------------- |
| `sub`  | string   | Agent ID                           |
| `type` | 'a2a'    | Token type identifier              |
| `name` | string   | Agent display name                 |
| `pubkey` | string | Agent's public key                 |
| `chain` | string  | Blockchain type (solana, ethereum) |
| `caps` | string[] | Agent capabilities                 |
| `score` | number  | BAGS reputation score              |
| `iss`  | string   | Issuer (agentidapp.com)            |
| `aud`  | string   | Audience (agentid-a2a)             |
| `iat`  | number   | Issued-at timestamp                |
| `exp`  | number   | Expiration timestamp (60s from iat)|

## License

MIT
