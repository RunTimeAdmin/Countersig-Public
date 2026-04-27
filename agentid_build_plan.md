<h1>AgentID — Complete Build Plan</h1><h2>The Bags-Native Trust Layer for AI Agents</h2><p><em>Bags binding layer on top of Solana's Agent Registry + Bags Agent Auth</em></p><hr><h2>EXECUTIVE SUMMARY</h2><p><strong>What it is:</strong> AgentID is the trust verification layer that sits between Bags agents and the humans/apps that interact with them. It wraps Bags' existing Ed25519 agent auth flow (<code>/agent/v2/auth/init</code> + <code>/agent/v2/auth/callback</code>), binds agent identities to the Solana Agent Registry (SAID Protocol), adds Bags-specific reputation scoring, and surfaces a human-readable trust badge inside Bags chat.</p><p><strong>What makes it different from SAID Protocol:</strong> SAID is a general-purpose Solana agent registry. AgentID is Bags-specific — it adds the Bags wallet binding, Bags ecosystem behavior scoring (fee claims, swap execution, token launches), trust badge surfaced inside the Bags app UI, and PKI challenge-response verification for Bags agent actions. SAID has no Bags integration. AgentID builds exactly that.</p><p><strong>Who needs it:</strong> Every one of the 48 AI Agent projects in the hackathon. Every Bags user who interacts with an agent. Every developer building on Bags who wants their agent to display a trust badge.</p><p><strong>Your edge:</strong> The Bags agent auth flow uses Ed25519 challenge-response — the same PKI you know from TLS/CCIE. You understand this cold. Most hackathon builders don't.</p><hr><h2>COMPETITIVE LANDSCAPE</h2><table class="e-rte-table"> <thead> <tr> <th>System</th> <th>What It Does</th> <th>What It Lacks</th> </tr> </thead> <tbody><tr> <td><strong>SAID Identity Gateway</strong></td> <td>On-chain PDA, Ed25519 registration, trust score, A2A discovery</td> <td>Zero Bags integration, no Bags wallet binding, no Bags ecosystem reputation, no trust badge in Bags UI</td> </tr> <tr> <td><strong>Agistry Framework</strong></td> <td>Solana smart contract for agent-tool connections</td> <td>Rust-only, no Bags integration, no trust scoring</td> </tr> <tr> <td><strong>Bags Agent Auth</strong></td> <td>Ed25519 challenge-response to get Bags API key</td> <td>No registry, no reputation, no trust badge, no spoofing detection</td> </tr> <tr> <td><strong>AgentID</strong></td> <td><strong>Wraps Bags auth + binds to SAID + adds Bags reputation + trust badge in Bags UI</strong></td> <td>← This is the gap</td> </tr> </tbody></table><p><strong>Bottom line:</strong> Three partial systems exist. None connects them. AgentID is the connector.</p><hr><h2>ARCHITECTURE</h2><pre><code>┌─────────────────────────────────────────────────────────────────────┐
│                         AGENTID SYSTEM                               │
│                                                                       │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐   │
│  │ SAID Protocol│    │         AgentID Registry Service          │   │
│  │ (said-       │◄───│  Node.js/Express — agentid.yourdomain.io  │   │
│  │ identity-    │    │                                            │   │
│  │ gateway)     │    │  POST /register                            │   │
│  │ PDA + trust  │    │    1. Verify Bags wallet ownership         │   │
│  │ score        │    │       (Bags /agent/v2/auth/init + callback)│   │
│  └──────────────┘    │    2. Bind to SAID registry entry          │   │
│                       │    3. Store AgentID record                 │   │
│  ┌──────────────┐    │    4. Issue AgentID certificate            │   │
│  │ Bags API     │    │                                            │   │
│  │ /agent/v2/   │◄───│  POST /verify                              │   │
│  │ auth/init    │    │    PKI challenge-response                  │   │
│  │ /auth/       │    │    Ed25519 sign AGENTID-VERIFY:{pubkey}    │   │
│  │ callback     │    │    :{nonce}:{timestamp}                    │   │
│  └──────────────┘    │                                            │   │
│                       │  GET /badge/:pubkey                        │   │
│  ┌──────────────┐    │    Returns trust badge JSON                │   │
│  │ Bags API     │    │    ✅ Verified / ⚠️ Unverified / 🔴 Flagged│   │
│  │ /analytics/  │◄───│                                            │   │
│  │ fees/token   │    │  GET /reputation/:pubkey                   │   │
│  │ /state/pools │    │    Bags ecosystem behavior score           │   │
│  └──────────────┘    └──────────────────────────────────────────┘   │
│                                          │                            │
│                                          ▼                            │
│                       ┌──────────────────────────────────────────┐   │
│                       │         Trust Badge Widget                │   │
│                       │  Embeddable iframe/script for Bags devs   │   │
│                       │  agentid.yourdomain.io/widget/:pubkey     │   │
│                       │                                            │   │
│                       │  ✅ VERIFIED AGENT                        │   │
│                       │  DeFiBot • Bags Ecosystem • 94/100        │   │
│                       │  Registered: 2026-01-15 • 47 actions      │   │
│                       └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
</code></pre><hr><h2>CORE COMPONENTS</h2><h3>Component 1 — Bags Agent Auth Wrapper</h3><p>Bags already has a working Ed25519 auth flow. AgentID wraps it to establish wallet ownership as the first step of registration.</p><p><strong>Bags Auth Flow (already documented at docs.bags.fm):</strong></p><pre><code>POST /agent/v2/auth/init  → { message: "&lt;b58&gt;", nonce: "&lt;uuid&gt;" }
Agent signs message with Ed25519 keypair
POST /agent/v2/auth/callback → { apiKey: "..." }
</code></pre><p><strong>AgentID Registration uses this as Step 1:</strong></p><pre><code class="language-javascript">// agentid/src/services/bagsAuthVerifier.js
async function verifyBagsWalletOwnership(pubkey) {
  // Step 1: Get challenge from Bags
  const init = await axios.post(
    'https://public-api-v2.bags.fm/api/v1/agent/v2/auth/init',
    { address: pubkey }
  );
  
  // Step 2: Agent signs the challenge (AgentID issues this as a sub-challenge)
  // AgentID sends the Bags challenge back to the registering agent
  // Agent must sign it — proves they hold the private key
  
  // Step 3: AgentID verifies signature before proceeding
  const isValid = nacl.sign.detached.verify(
    bs58.decode(init.data.response.message),
    bs58.decode(agentSignature),
    bs58.decode(pubkey)
  );
  
  return isValid;
}
</code></pre><p>This is the PKI core — an agent that cannot sign the Bags challenge cannot register. Period. Spoofing defeated at registration.</p><hr><h3>Component 2 — SAID Protocol Binding</h3><p>After wallet ownership is verified, AgentID creates a binding record in the SAID Identity Gateway.</p><pre><code class="language-javascript">// agentid/src/services/saidBinding.js
async function bindToSAID(pubkey, timestamp, signature, metadata) {
  // Register in SAID gateway (or verify existing registration)
  const saidResponse = await axios.post(
    'https://said-identity-gateway.up.railway.app/agents/register',
    {
      pubkey,
      timestamp,
      signature,
      name: metadata.name,
      description: metadata.description,
      capabilities: metadata.capabilities,
      // AgentID-specific extension
      bags_binding: {
        token_mint: metadata.tokenMint,
        bags_wallet: pubkey,
        agentid_registered_at: new Date().toISOString(),
        capability_set: metadata.capabilities
      }
    }
  );
  
  return saidResponse.data;
}
</code></pre><p><strong>What this gives AgentID:</strong></p><ul> <li>Inherits SAID's trust score (0–100) with attestation trail</li> <li>Inherits SAID's A2A discovery (<code>/discover?capability=bags.swap.v1</code>)</li> <li>Adds Bags-specific metadata to SAID entries</li> <li>Agents registered in AgentID are discoverable via SAID's A2A protocol</li> </ul><hr><h3>Component 3 — AgentID Database Record</h3><p>After SAID binding, AgentID stores its own record with Bags-specific data SAID doesn't have.</p><pre><code class="language-javascript">// PostgreSQL schema
CREATE TABLE agent_identities (
  pubkey          VARCHAR(88) PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  token_mint      VARCHAR(88),           -- $AGID token mint or agent's own token
  bags_api_key_id VARCHAR(255),          -- Key ID from Bags auth (not the key itself)
  said_registered BOOLEAN DEFAULT false,
  said_trust_score INTEGER DEFAULT 0,
  capability_set  JSONB,                 -- declared capabilities
  creator_x       VARCHAR(255),          -- X/Twitter handle
  creator_wallet  VARCHAR(88),           -- creator's personal wallet
  registered_at   TIMESTAMPTZ DEFAULT NOW(),
  last_verified   TIMESTAMPTZ,
  status          VARCHAR(20) DEFAULT 'verified', -- verified|unverified|flagged
  flag_reason     TEXT,
  bags_score      INTEGER DEFAULT 0,     -- Bags ecosystem reputation (0-100)
  total_actions   INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  failed_actions  INTEGER DEFAULT 0,
  fee_claims_count INTEGER DEFAULT 0,
  fee_claims_sol  DECIMAL(18,9) DEFAULT 0,
  swaps_count     INTEGER DEFAULT 0,
  launches_count  INTEGER DEFAULT 0
);

CREATE TABLE agent_verifications (
  id              SERIAL PRIMARY KEY,
  pubkey          VARCHAR(88) REFERENCES agent_identities(pubkey),
  nonce           VARCHAR(64) UNIQUE NOT NULL,
  challenge       TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  completed       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_flags (
  id              SERIAL PRIMARY KEY,
  pubkey          VARCHAR(88) REFERENCES agent_identities(pubkey),
  reporter_pubkey VARCHAR(88),
  reason          TEXT NOT NULL,
  evidence        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved        BOOLEAN DEFAULT false
);
</code></pre><hr><h3>Component 4 — PKI Challenge-Response (Spoofing Prevention)</h3><p>The ongoing verification mechanism. After registration, any time an agent wants to execute a Bags action, it can be challenged.</p><p><strong>Challenge-response message format:</strong></p><pre><code>AGENTID-VERIFY:{pubkey}:{nonce}:{timestamp}
</code></pre><p>This is identical to SAID's pattern but scoped to AgentID actions.</p><pre><code class="language-javascript">// agentid/src/services/pkiChallenge.js

// Issue a challenge
async function issueChallenge(pubkey) {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const challenge = `AGENTID-VERIFY:${pubkey}:${nonce}:${timestamp}`;
  
  // Store with 5-minute expiry (replay protection)
  await db.query(
    `INSERT INTO agent_verifications (pubkey, nonce, challenge, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [pubkey, nonce, challenge]
  );
  
  return { nonce, challenge: bs58.encode(Buffer.from(challenge)), expiresIn: 300 };
}

// Verify a challenge response
async function verifyChallenge(pubkey, nonce, signature) {
  // Fetch challenge
  const { rows } = await db.query(
    `SELECT challenge, expires_at FROM agent_verifications
     WHERE pubkey = $1 AND nonce = $2 AND completed = false`,
    [pubkey, nonce]
  );
  
  if (!rows.length) throw new Error('Challenge not found or already used');
  if (new Date() &gt; new Date(rows[0].expires_at)) throw new Error('Challenge expired');
  
  // Verify Ed25519 signature
  const messageBytes = Buffer.from(rows[0].challenge, 'utf8');
  const sigBytes = bs58.decode(signature);
  const pubkeyBytes = bs58.decode(pubkey);
  
  const valid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
  
  if (!valid) throw new Error('Invalid signature — possible spoofing attempt');
  
  // Mark challenge used (one-time use, prevents replay)
  await db.query(
    `UPDATE agent_verifications SET completed = true WHERE nonce = $1`,
    [nonce]
  );
  
  // Update last_verified timestamp
  await db.query(
    `UPDATE agent_identities SET last_verified = NOW() WHERE pubkey = $1`,
    [pubkey]
  );
  
  return { verified: true, pubkey, timestamp: new Date().toISOString() };
}
</code></pre><p><strong>Why this defeats spoofing:</strong> A malicious agent can copy an agent's name, description, token mint, and X handle. It cannot copy the Ed25519 private key. The challenge-response fails without the private key. The trust badge shows 🔴 FLAGGED. The Bags action is blocked.</p><hr><h3>Component 5 — Bags Ecosystem Reputation Score</h3><p>Pulls live data from Bags API to compute a Bags-specific reputation score.</p><pre><code class="language-javascript">// agentid/src/services/bagsReputation.js

async function computeBagsScore(pubkey) {
  const scores = {};
  
  // 1. Fee claiming activity (30 points max)
  // GET /api/v1/analytics/fees/token/{mint}
  try {
    const feeData = await bagsApi.getTokenFees(pubkey);
    const feeScore = Math.min(30, Math.floor(feeData.totalFeesSOL * 10));
    scores.feeActivity = feeScore;
  } catch { scores.feeActivity = 0; }
  
  // 2. Successful action rate (25 points max)
  const { total, successful } = await db.getAgentActions(pubkey);
  const successRate = total &gt; 0 ? successful / total : 0;
  scores.successRate = Math.floor(successRate * 25);
  
  // 3. Registration age (20 points max — +1 per day, capped at 20)
  const { registered_at } = await db.getAgent(pubkey);
  const ageDays = Math.floor((Date.now() - new Date(registered_at)) / 86400000);
  scores.age = Math.min(20, ageDays);
  
  // 4. SAID trust score contribution (15 points max)
  try {
    const saidScore = await saidApi.getTrustScore(pubkey);
    scores.saidTrust = Math.floor((saidScore.score / 100) * 15);
  } catch { scores.saidTrust = 0; }
  
  // 5. Community verification (10 points max)
  // No flags = +10, 1 unresolved flag = +5, 2+ = 0
  const flags = await db.getUnresolvedFlags(pubkey);
  scores.community = flags === 0 ? 10 : flags === 1 ? 5 : 0;
  
  const total_score = Object.values(scores).reduce((a, b) =&gt; a + b, 0);
  
  return {
    score: total_score,
    label: total_score &gt;= 80 ? 'HIGH' : total_score &gt;= 60 ? 'MEDIUM' : 
           total_score &gt;= 40 ? 'LOW' : 'UNVERIFIED',
    breakdown: scores
  };
}
</code></pre><hr><h3>Component 6 — Trust Badge API + Widget</h3><p>The deliverable that 48 AI agent teams can embed in their own apps.</p><p><strong>Badge API response:</strong></p><pre><code class="language-json">GET /badge/:pubkey

{
  "pubkey": "DngYMKx2VpAJiotUuXjZXZ3BD52A1qVu47ZYsyUzP4WS",
  "name": "DeFiBot",
  "status": "verified",
  "badge": "✅",
  "label": "VERIFIED AGENT",
  "bags_score": 87,
  "said_trust_score": 82,
  "said_label": "HIGH",
  "registered_at": "2026-03-15T00:00:00Z",
  "last_verified": "2026-04-16T02:28:00Z",
  "total_actions": 147,
  "success_rate": 0.94,
  "capabilities": ["bags.swap.v1", "bags.fee-claim.v1"],
  "token_mint": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "widget_url": "https://agentid.yourdomain.io/widget/DngYMKx2..."
}
</code></pre><p><strong>Embeddable widget (iframe):</strong></p><pre><code class="language-html">&lt;!-- Any Bags app can embed this --&gt;
&lt;iframe 
  src="https://agentid.yourdomain.io/widget/DngYMKx2VpAJiotUuXjZXZ3BD52A1qVu47ZYsyUzP4WS"
  width="320" height="80" frameborder="0"&gt;
&lt;/iframe&gt;
</code></pre><p>Widget renders:</p><pre><code>┌─────────────────────────────────────────┐
│ ✅ VERIFIED AGENT          Score: 87/100 │
│ DeFiBot • Bags Ecosystem                 │
│ Registered: Mar 15, 2026 • 147 actions  │
└─────────────────────────────────────────┘
</code></pre><hr><h2>FULL API REFERENCE</h2><h3>Registration &amp; Verification</h3><table class="e-rte-table"> <thead> <tr> <th>Method</th> <th>Endpoint</th> <th>Description</th> </tr> </thead> <tbody><tr> <td><code>POST</code></td> <td><code>/register</code></td> <td>Register agent — Bags auth + SAID binding</td> </tr> <tr> <td><code>POST</code></td> <td><code>/verify/challenge</code></td> <td>Issue PKI challenge to agent</td> </tr> <tr> <td><code>POST</code></td> <td><code>/verify/response</code></td> <td>Submit signed challenge response</td> </tr> <tr> <td><code>PUT</code></td> <td><code>/agents/:pubkey/update</code></td> <td>Update metadata (signature required)</td> </tr> </tbody></table><h3>Trust &amp; Reputation</h3><table class="e-rte-table"> <thead> <tr> <th>Method</th> <th>Endpoint</th> <th>Description</th> </tr> </thead> <tbody><tr> <td><code>GET</code></td> <td><code>/badge/:pubkey</code></td> <td>Get trust badge JSON</td> </tr> <tr> <td><code>GET</code></td> <td><code>/reputation/:pubkey</code></td> <td>Full reputation breakdown</td> </tr> <tr> <td><code>GET</code></td> <td><code>/agents</code></td> <td>List all agents (filter by capability, status)</td> </tr> <tr> <td><code>GET</code></td> <td><code>/agents/:pubkey</code></td> <td>Get agent detail</td> </tr> <tr> <td><code>GET</code></td> <td><code>/discover</code></td> <td>A2A discovery — agents ranked by Bags score</td> </tr> <tr> <td><code>GET</code></td> <td><code>/discover?capability=bags.swap.v1</code></td> <td>Find best agent for capability</td> </tr> </tbody></table><h3>Attestation &amp; Flagging</h3><table class="e-rte-table"> <thead> <tr> <th>Method</th> <th>Endpoint</th> <th>Description</th> </tr> </thead> <tbody><tr> <td><code>POST</code></td> <td><code>/agents/:pubkey/attest</code></td> <td>Record successful action</td> </tr> <tr> <td><code>POST</code></td> <td><code>/agents/:pubkey/flag</code></td> <td>Flag suspicious behavior</td> </tr> <tr> <td><code>GET</code></td> <td><code>/agents/:pubkey/attestations</code></td> <td>View attestation history</td> </tr> <tr> <td><code>GET</code></td> <td><code>/agents/:pubkey/flags</code></td> <td>View flag history</td> </tr> </tbody></table><h3>Widget</h3><table class="e-rte-table"> <thead> <tr> <th>Method</th> <th>Endpoint</th> <th>Description</th> </tr> </thead> <tbody><tr> <td><code>GET</code></td> <td><code>/widget/:pubkey</code></td> <td>Embeddable trust badge HTML</td> </tr> <tr> <td><code>GET</code></td> <td><code>/badge/:pubkey/svg</code></td> <td>SVG badge for README/docs</td> </tr> </tbody></table><hr><h2>TECH STACK</h2><table class="e-rte-table"> <thead> <tr> <th>Layer</th> <th>Technology</th> <th>Why</th> </tr> </thead> <tbody><tr> <td>Backend</td> <td>Node.js 20, Express</td> <td>Same as InfraWatch — consistent stack</td> </tr> <tr> <td>Auth</td> <td>tweetnacl (Ed25519), bs58</td> <td>Same libs Bags uses</td> </tr> <tr> <td>Database</td> <td>PostgreSQL</td> <td>Agent registry, verifications, flags</td> </tr> <tr> <td>Cache</td> <td>Redis</td> <td>Challenge nonce store, badge cache</td> </tr> <tr> <td>External</td> <td>Bags API, SAID Gateway</td> <td>Data sources</td> </tr> <tr> <td>Frontend</td> <td>React 18, Vite, Tailwind</td> <td>Registry explorer UI</td> </tr> <tr> <td>Deployment</td> <td>Hostinger VPS (same server)</td> <td>Port 3002 — fits alongside InfraWatch</td> </tr> </tbody></table><hr><h2>REPOSITORY STRUCTURE</h2><pre><code>AgentID/
├── backend/
│   ├── server.js                    # Express + routes
│   ├── src/
│   │   ├── config/index.js
│   │   ├── routes/
│   │   │   ├── register.js          # POST /register
│   │   │   ├── verify.js            # POST /verify/*
│   │   │   ├── badge.js             # GET /badge/:pubkey
│   │   │   ├── reputation.js        # GET /reputation/:pubkey
│   │   │   ├── agents.js            # GET /agents, /discover
│   │   │   ├── attestations.js      # POST /attest, /flag
│   │   │   └── widget.js            # GET /widget/:pubkey
│   │   ├── services/
│   │   │   ├── bagsAuthVerifier.js  # Bags /agent/v2/auth/* wrapper
│   │   │   ├── saidBinding.js       # SAID Protocol integration
│   │   │   ├── pkiChallenge.js      # Ed25519 challenge-response
│   │   │   ├── bagsReputation.js    # Bags ecosystem scoring
│   │   │   └── badgeBuilder.js      # Trust badge generation
│   │   ├── models/
│   │   │   ├── db.js
│   │   │   ├── redis.js
│   │   │   ├── queries.js
│   │   │   └── migrate.js
│   │   └── middleware/
│   │       ├── errorHandler.js
│   │       └── rateLimit.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Registry.jsx         # Browse all registered agents
│   │   │   ├── AgentDetail.jsx      # Single agent detail + badge
│   │   │   ├── Register.jsx         # Self-registration flow
│   │   │   └── Discover.jsx         # A2A discovery explorer
│   │   ├── components/
│   │   │   ├── TrustBadge.jsx       # The badge component
│   │   │   ├── ReputationBreakdown.jsx
│   │   │   ├── CapabilityList.jsx
│   │   │   └── FlagModal.jsx
│   │   └── widget/
│   │       └── Widget.jsx           # Standalone embeddable widget
│   └── package.json
├── README.md
└── LICENSE
</code></pre><hr><h2>SPRINT PLAN</h2><h3>Week 1 — Core Auth + Registration (Days 1–7)</h3><p><strong>Day 1–2: Project scaffold + DB</strong></p><pre><code class="language-bash">mkdir AgentID &amp;&amp; cd AgentID
git init
# Set up Express backend (same pattern as InfraWatch)
# Create PostgreSQL schema (agent_identities, agent_verifications, agent_flags)
# Create Redis connection for nonce storage
</code></pre><p><strong>Day 3–4: Bags Auth Wrapper</strong></p><ul> <li>Implement <code>bagsAuthVerifier.js</code></li> <li>Wire <code>POST /agent/v2/auth/init</code> → challenge issuance</li> <li>Wire <code>POST /agent/v2/auth/callback</code> → ownership proof</li> <li>Test with a real Bags agent wallet</li> </ul><p><strong>Day 5–6: SAID Binding</strong></p><ul> <li>Implement <code>saidBinding.js</code></li> <li>Register test agent in SAID gateway</li> <li>Verify SAID trust score polling works</li> <li>Store AgentID record in PostgreSQL</li> </ul><p><strong>Day 7: PKI Challenge-Response</strong></p><ul> <li>Implement <code>pkiChallenge.js</code></li> <li><code>POST /verify/challenge</code> → issue nonce</li> <li><code>POST /verify/response</code> → verify Ed25519 signature</li> <li>Replay attack prevention (nonce expiry + single-use)</li> </ul><p><strong>Week 1 Deliverable:</strong> <code>/register</code> flow works end-to-end. Agent can register, ownership verified, SAID bound, PKI challenge passes.</p><hr><h3>Week 2 — Reputation + Badge + Frontend (Days 8–14)</h3><p><strong>Day 8–9: Bags Reputation Engine</strong></p><ul> <li>Implement <code>bagsReputation.js</code></li> <li>Wire Bags API calls: <code>/analytics/fees/token/{mint}</code>, <code>/state/pools</code></li> <li>Implement 5-factor scoring algorithm</li> <li>Wire attestation endpoint: <code>POST /agents/:pubkey/attest</code></li> </ul><p><strong>Day 10–11: Trust Badge</strong></p><ul> <li>Implement <code>GET /badge/:pubkey</code> — JSON response</li> <li>Implement <code>GET /widget/:pubkey</code> — embeddable HTML</li> <li>Implement <code>GET /badge/:pubkey/svg</code> — SVG for READMEs</li> <li>Build <code>TrustBadge.jsx</code> React component</li> </ul><p><strong>Day 12–13: Frontend Registry</strong></p><ul> <li>React 18 + Vite + Tailwind (same stack as InfraWatch)</li> <li><code>Registry.jsx</code> — browse all agents, filter by status/capability</li> <li><code>AgentDetail.jsx</code> — full agent profile + reputation breakdown</li> <li><code>Discover.jsx</code> — A2A explorer: "find best agent for bags.swap.v1"</li> </ul><p><strong>Day 14: Deployment</strong></p><ul> <li>Deploy to Hostinger VPS on port 3002</li> <li>Nginx server block for <code>agentid.yourdomain.io</code></li> <li>SSL via certbot</li> <li>PM2 process: <code>agentid-api</code></li> </ul><p><strong>Week 2 Deliverable:</strong> Full working MVP. Register, verify, score, badge, discover. Live at <code>agentid.yourdomain.io</code>.</p><hr><h3>Week 3 — Polish + Hackathon Integration (Days 15–21)</h3><p><strong>Day 15–16: Register InfraWatch as first agent</strong></p><ul> <li>Register <code>app.infrastructureintel.io</code> as an AgentID-verified agent</li> <li>Declare capability: <code>infra.solana.health.v1</code></li> <li>Display InfraWatch trust badge on its own README</li> </ul><p><strong>Day 17–18: Outreach to 48 AI Agent teams</strong></p><ul> <li>Post in Bags Discord with widget embed code</li> <li>"Your agent can get a verified badge in 5 minutes"</li> <li>This drives registrations = traction = hackathon score</li> </ul><p><strong>Day 19–20: Flag system + admin dashboard</strong></p><ul> <li><code>POST /agents/:pubkey/flag</code> — community reporting</li> <li>Admin view for reviewing flags</li> <li>Auto-downgrade to 🔴 FLAGGED on 3+ confirmed reports</li> </ul><p><strong>Day 21: README + screenshots + submit</strong></p><ul> <li>Live demo screenshots</li> <li>Launch $AGID token at bags.fm/launch</li> <li>Submit at bags.fm/apply</li> </ul><hr><h2>ENVIRONMENT VARIABLES</h2><pre><code class="language-bash"># backend/.env.example
PORT=3002
NODE_ENV=production

# Bags API
BAGS_API_KEY=your_bags_api_key

# SAID Protocol Gateway
SAID_GATEWAY_URL=https://said-identity-gateway.up.railway.app

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agentid

# Redis (nonce store + badge cache)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=https://agentid.yourdomain.io

# Badge cache TTL (seconds)
BADGE_CACHE_TTL=60
CHALLENGE_EXPIRY_SECONDS=300
</code></pre><hr><h2>DOMAIN FROM YOUR PORTFOLIO</h2><p><strong>Best fit:</strong> <code>provenanceai.network</code></p><ul> <li>"Provenance" = verifiable origin, chain of custody — exactly what AgentID establishes</li> <li><code>.network</code> implies protocol/infrastructure</li> <li>Active until 2026-12-14</li> </ul><p><strong>Runner-up:</strong> <code>runtimefence.io</code></p><ul> <li>"Runtime Fence" = enforcement at runtime — maps to spoofing prevention</li> <li>Already associated with your dev identity</li> </ul><p><strong>Live URL would be:</strong> <code>https://agentid.provenanceai.network</code> or <code>agentid.runtimefence.io</code></p><hr><h2>HACKATHON APPLICATION</h2><table class="e-rte-table"> <thead> <tr> <th>Field</th> <th>Value</th> </tr> </thead> <tbody><tr> <td><strong>App Name</strong></td> <td>AgentID</td> </tr> <tr> <td><strong>Category</strong></td> <td>Bags API</td> </tr> <tr> <td><strong>Description</strong></td> <td><em>"Trust verification layer for Bags AI agents. AgentID wraps Bags' Ed25519 agent auth flow, binds identities to the Solana Agent Registry (SAID Protocol), and adds Bags-specific reputation scoring — then surfaces a human-readable trust badge inside Bags chat. Prevents agent spoofing via PKI challenge-response. Every AI agent project in the hackathon can embed a verified badge in 5 minutes. Built by a CCIE network engineer using the same PKI principles as TLS."</em></td> </tr> <tr> <td><strong>Website</strong></td> <td><code>https://agentid.provenanceai.network</code></td> </tr> <tr> <td><strong>GitHub</strong></td> <td><code>https://github.com/RunTimeAdmin/AgentID</code></td> </tr> <tr> <td><strong>Token</strong></td> <td>$AGID</td> </tr> </tbody></table><hr><h2>REVENUE MODEL</h2><p><strong>Free tier:</strong></p><ul> <li>Register up to 3 agents</li> <li>Public badge + basic reputation score</li> <li>SAID binding included</li> </ul><p><strong>$AGID token holders (premium):</strong></p><ul> <li>Unlimited agent registrations</li> <li>API access for other apps to query AgentID trust scores</li> <li>Extended reputation data (full attestation history)</li> <li>Custom capability declarations</li> <li>Priority flag resolution</li> </ul><p><strong>Enterprise (Bags app builders):</strong></p><ul> <li>Whitelabel AgentID trust verification</li> <li>SDK for embedding badge in any Bags app</li> <li>SLA for badge API uptime</li> <li>Custom scoring weights for your ecosystem</li> </ul><hr><h2>YOUR UNFAIR ADVANTAGES</h2><ol> <li><strong>PKI expertise</strong> — Ed25519 challenge-response is CCIE-adjacent. You understand key material, replay protection, certificate chains. Most hackathon builders treat crypto primitives as black boxes. </li> <li><strong>First-mover on Bags + SAID binding</strong> — SAID launched recently with zero Bags integration. AgentID is the first Bags-native binding layer. First to ship wins the positioning. </li> <li><strong>48 potential customers inside the hackathon</strong> — Every AI Agent team in the hackathon is a potential AgentID user. You're building infrastructure for your own competitors, which is a moat. </li> <li><strong>InfraWatch already running</strong> — You have a working Solana monitoring tool at <code>app.infrastructureintel.io</code>. Register it as AgentID's first verified agent. That's your demo: "Here's a real agent with a verified badge." </li> <li><strong>Same VPS, same stack</strong> — Node.js 20, Express, PostgreSQL, PM2, nginx — all already configured. Port 3002 is free. Deployment is ~30 minutes. </li> </ol><hr><h2>SUMMARY</h2><table class="e-rte-table"> <thead> <tr> <th>Item</th> <th>Detail</th> </tr> </thead> <tbody><tr> <td><strong>Build time</strong></td> <td>2 weeks to MVP</td> </tr> <tr> <td><strong>Deployment</strong></td> <td>Hostinger VPS, port 3002</td> </tr> <tr> <td><strong>Domain</strong></td> <td>provenanceai.network or runtimefence.io</td> </tr> <tr> <td><strong>Token</strong></td> <td>$AGID</td> </tr> <tr> <td><strong>Stack</strong></td> <td>Node.js 20, Express, PostgreSQL, Redis, React 18, Vite, Tailwind</td> </tr> <tr> <td><strong>External APIs</strong></td> <td>Bags API, SAID Identity Gateway</td> </tr> <tr> <td><strong>Key differentiator</strong></td> <td>Bags-native binding layer — SAID has no Bags integration</td> </tr> <tr> <td><strong>Hackathon category</strong></td> <td>Bags API</td> </tr> <tr> <td><strong>Traction driver</strong></td> <td>48 AI Agent teams = 48 potential badge adopters</td> </tr> </tbody></table>