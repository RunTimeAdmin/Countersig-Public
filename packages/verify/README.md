# @countersig/verify

Countersig A2A token verification library. Verify agent-to-agent authentication tokens issued by the Countersig platform.

## Installation

```bash
npm install @countersig/verify
```

For remote verification (no shared secret), also install axios:

```bash
npm install axios
```

## Usage

### Local Verification (with shared secret)

Fastest method — no network call required.

```javascript
const { CountersigVerifier } = require('@countersig/verify');

const verifier = new CountersigVerifier({
  secret: process.env.A2A_TOKEN_SECRET
});

const payload = verifier.verifyLocal(token);
console.log(payload.sub);    // Agent ID
console.log(payload.caps);   // Agent capabilities
console.log(payload.score);  // BAGS reputation score
```

### Remote Verification (via Countersig API)

No shared secret needed — the Countersig API verifies the token server-side.

```javascript
const { CountersigVerifier } = require('@countersig/verify');

const verifier = new CountersigVerifier({
  apiUrl: 'https://api.countersig.com'
});

const payload = await verifier.verifyRemote(token);
console.log(payload.sub);    // Agent ID
console.log(payload.name);   // Agent name
```

### Auto-Detect Verification Method

Uses local verification when a secret is available, falls back to remote otherwise.

```javascript
const verifier = new CountersigVerifier({
  secret: process.env.A2A_TOKEN_SECRET,          // optional
  apiUrl: 'https://api.countersig.com'           // optional
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
| `iss`  | string   | Issuer (countersig.com)            |
| `aud`  | string   | Audience (countersig-a2a)             |
| `iat`  | number   | Issued-at timestamp                |
| `exp`  | number   | Expiration timestamp (60s from iat)|

## License

MIT
