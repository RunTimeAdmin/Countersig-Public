# AgentID Trust Mark — Agent Owner Guide

Welcome! This guide will walk you through registering your AI agent with AgentID and displaying a trust badge that proves your agent's identity to users and other agents in the ecosystem.

---

## What is AgentID?

AgentID is a **trust verification layer** for AI agents operating in the Bags ecosystem. Think of it like a verified badge on social media — but for AI agents.

When you register your agent with AgentID:
- Your agent gets a unique, verifiable identity
- Users can trust that your agent is who it claims to be
- You can display a trust badge on your website, documentation, or GitHub README
- Other agents and systems can verify your agent's reputation and capabilities

**In simple terms:** AgentID proves your AI agent is legitimate and helps users trust it.

---

## Prerequisites — What You Need Before Starting

Before you begin, make sure you have the following:

### 1. An Ed25519 Keypair (Public Key + Private Key)

**What is this?** Think of it like a digital lock and key:
- **Public Key** = Your lock (you can share this with anyone)
- **Private Key** = Your key (keep this secret — it proves you own the lock)

This keypair is used to cryptographically prove you own your agent. Anyone can see your public key, but only you can create signatures with your private key.

#### How to Generate Your Keypair

Open a terminal and run the following commands:

```bash
cd AgentID/backend
node -e "const nacl = require('tweetnacl'); const bs58 = require('bs58'); const kp = nacl.sign.keyPair(); console.log('PUBLIC KEY:', bs58.encode(kp.publicKey)); console.log('PRIVATE KEY:', bs58.encode(kp.secretKey));"
```

**Output will look like:**
```
PUBLIC KEY: 7xKXtg5CwXJHkjXzZW7nTFjKfZJxYfJQFjKxJzQjZJxQ
PRIVATE KEY: 3xKXtJ5CwXJHkjXzZW7nTFjKfZJxYfJQFjKxJzQjZJxQjKxJzQjZJxQjKxJzQjZJxQjKxJzQjZJxQ
```

**CRITICAL SECURITY WARNINGS:**
- **NEVER share your private key with anyone** — not even AgentID support
- **Store your private key securely** — in a password manager, encrypted file, or secure environment variable
- **If you lose your private key, there's no recovery mechanism** (yet) — you'll need to register a new agent
- **Anyone with your private key can impersonate your agent**

### 2. Your Agent's Basic Information

Gather the following details about your agent:
- **Name**: What you want to call your agent (e.g., "TradeBot Pro", "CryptoAssistant")
- **Description**: A brief explanation of what your agent does (1-2 sentences)
- **Capabilities**: What actions your agent can perform (e.g., trading, analysis, notifications)
- **X/Twitter Handle** (optional): For social verification
- **Wallet Address** (optional): Associated blockchain address

### 3. Access to AgentID

The AgentID platform is available at:
**https://agentid.provenanceai.network**

---

## Step 1: Register Your Agent

You have three options for registering your agent. Choose the one that works best for you:

### Option A: Using the Web Interface (Easiest)

The web interface provides a simple 4-step wizard to register your agent:

1. **Go to**: https://agentid.provenanceai.network/register

2. **Step 1 — Agent Identity**:
   - Enter your **Public Key** (from the keypair you generated)
   - Enter your agent's **Name**
   - Click "Next"

3. **Step 2 — Sign Challenge**:
   - The system will generate a challenge message
   - Copy this message and sign it with your private key
   - To sign, you can use the provided tool or your own signing method
   - Paste the signature back into the form
   - Click "Next"

4. **Step 3 — Metadata**:
   - Add a **Description** of your agent
   - List your agent's **Capabilities** (comma-separated)
   - Add your **X/Twitter Handle** (optional)
   - Add your **Wallet Address** (optional)
   - Click "Next"

5. **Step 4 — Confirm**:
   - Review all the information you've entered
   - Click "Submit" to complete registration

**Success!** You'll see your **Agent ID** (a UUID like `550e8400-e29b-41d4-a716-446655440000`).

**IMPORTANT:** Save this Agent ID — you'll need it for everything else!

### Option B: Using the "Try It" Demo (Best for Testing)

The demo page is perfect for understanding the process before using your real keys:

1. **Go to**: https://agentid.provenanceai.network/demo

2. The demo will:
   - Generate a temporary keypair in your browser
   - Walk you through all 4 steps automatically
   - Show you exactly what happens at each stage
   - Display the trust badge at the end

3. Use this to familiarize yourself with the flow, then use Option A or C for your real registration.

### Option C: Using the API Directly (curl)

For advanced users who prefer command-line tools:

```bash
# Step 1: Register your agent
# Note: You need to generate the signature first (see Developer Guide for details)
curl -X POST https://agentid.provenanceai.network/register \
  -H "Content-Type: application/json" \
  -d '{
    "pubkey": "YOUR_PUBLIC_KEY",
    "name": "My Agent",
    "description": "An AI agent that helps with trading",
    "capabilities": ["trading", "analysis"],
    "signature": "YOUR_SIGNATURE",
    "message": "YOUR_MESSAGE",
    "nonce": "YOUR_NONCE"
  }'
```

**Note:** The signature fields require Ed25519 signing, which involves encoding and cryptographic operations. If you're not comfortable with this, use the web interface (Option A) instead.

---

## Step 2: Verify Your Agent (PKI Challenge-Response)

Verification proves that you actually control the private key associated with your agent. This is what makes your agent "Verified" instead of just "Registered."

### What Does "Verified" Mean?

| Status | Meaning |
|--------|---------|
| **Unverified** | Your agent is registered but hasn't proven key ownership. The trust badge shows a lower tier. |
| **Verified** | You've completed the challenge-response flow, proving you control the private key. Full trust score applies. |

### The Verification Process

The verification uses a "challenge-response" protocol:

1. **Request a Challenge**: The system sends you a random message (the challenge)
2. **Sign the Challenge**: You use your private key to create a digital signature of that message
3. **Submit the Response**: You send the signature back to the system
4. **Verification**: The system checks that your signature is valid using your public key

**Why this works:** Only someone with the private key can create a valid signature. By proving you can sign the challenge, you prove you own the agent.

### Step-by-Step Verification

#### Using the Web Interface:

1. Go to https://agentid.provenanceai.network and find your agent
2. Click on your agent to open the detail page
3. Click the "Verify Agent" button
4. Follow the prompts to sign the challenge with your private key
5. Submit the signed response
6. Your agent status will change to "Verified"

#### Using curl:

```bash
# Step 1: Request a challenge
curl -X POST https://agentid.provenanceai.network/verify/challenge \
  -H "Content-Type: application/json" \
  -d '{"agentId": "YOUR_AGENT_ID"}'

# Response: {"challenge": "...", "nonce": "..."}

# Step 2: Sign the challenge with your private key
# (Use a signing tool or script — see Developer Guide)

# Step 3: Submit the verification response
curl -X POST https://agentid.provenanceai.network/verify/response \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "YOUR_AGENT_ID",
    "nonce": "NONCE_FROM_STEP_1",
    "signature": "YOUR_SIGNATURE"
  }'
```

**Important:** Nonces expire after 5 minutes, so don't wait too long between requesting the challenge and submitting the response!

---

## Step 3: Display Your Trust Mark

Once your agent is registered (and ideally verified), you can display the trust badge in several ways:

### Option 1: Embeddable Widget (Recommended)

The widget is the most interactive option — it auto-refreshes and shows live data:

```html
<iframe 
  src="https://agentid.provenanceai.network/widget/YOUR_AGENT_ID" 
  width="400" 
  height="300" 
  frameborder="0" 
  style="border-radius: 12px;" 
  title="AgentID Trust Badge">
</iframe>
```

**Features:**
- Auto-refreshes every 60 seconds
- Shows agent name, trust score, verification status
- Displays capabilities as tags
- Responsive design
- Click-through to full agent profile

**To use:** Simply replace `YOUR_AGENT_ID` with your actual Agent ID (the UUID you saved during registration).

### Option 2: SVG Badge (for README, Docs, Websites)

The SVG badge is a static image perfect for GitHub READMEs, documentation, or websites:

```markdown
![AgentID Trust Badge](https://agentid.provenanceai.network/badge/YOUR_AGENT_ID/svg)
```

**Features:**
- Static image (340x80 pixels)
- Shows agent name, tier, and trust score
- Updates when the image is reloaded
- Works anywhere images are supported

**In HTML:**
```html
<img src="https://agentid.provenanceai.network/badge/YOUR_AGENT_ID/svg" 
     alt="AgentID Trust Badge" />
```

### Option 3: JSON API (for Custom Displays)

If you want to build your own display or integrate the data into your application:

```
GET https://agentid.provenanceai.network/badge/YOUR_AGENT_ID
```

**Example Response:**
```json
{
  "status": "success",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Agent",
  "badge": "VERIFIED",
  "label": "Gold",
  "tier": "gold",
  "score": 75,
  "capabilities": ["trading", "analysis"],
  "verificationStatus": "verified",
  "widgetUrl": "https://agentid.provenanceai.network/widget/550e8400-e29b-41d4-a716-446655440000"
}
```

Use this data to create custom visualizations or integrate into your own UI.

---

## Understanding Your Trust Score

Your trust score is a number from 0-100 that represents how trustworthy your agent is perceived to be. The score is calculated based on five factors:

### The 5 Factors

| Factor | Weight | Description | How to Improve |
|--------|--------|-------------|----------------|
| **Fee Activity** | 30 points | On-chain transaction volume and fees paid | More active usage on-chain |
| **Success Rate** | 25 points | Ratio of successful actions to failed ones | Ensure your agent operates reliably |
| **Registration Age** | 20 points | How long your agent has been registered | Wait — 1 point per day, max 20 |
| **SAID Trust** | 15 points | Cross-chain reputation via SAID Protocol | Build reputation across chains |
| **Community** | 10 points | Flag status (no flags = full points) | Avoid being flagged by users |

### Score Tiers

| Tier | Score Range | Badge Color | Meaning |
|------|-------------|-------------|---------|
| **Gold** | 70-100 | Gold/Yellow | Highly trusted, verified agent |
| **Blue** | 0-69 | Blue | Trusted, but lower reputation or newer agent |

### Important Notes for New Agents

- **New agents start at 10/100** — this is normal!
- Your score will grow over time as your agent accumulates activity and age
- The Registration Age factor alone can give you up to 20 points after 20 days
- Focus on building legitimate on-chain activity to increase your Fee Activity score

---

## Common Pitfalls to Avoid

### 1. NEVER Share Your Private Key
Your private key is the proof of ownership. Anyone with your private key can impersonate your agent, modify its registration, or steal its reputation.

### 2. Don't Lose Your Private Key
Currently, there is no recovery mechanism. If you lose your private key, you cannot:
- Verify your agent
- Update your agent's information
- Prove ownership of the agent

**Recommendation:** Store your private key in multiple secure locations (password manager, encrypted backup, hardware security module).

### 3. The Signature Must Be Base58-Encoded
When creating signatures, they must be encoded in base58 format. Using raw bytes or other encodings will cause verification to fail.

### 4. The Message Must Be Base58-Encoded
Similarly, the message you sign must also be base58-encoded when submitting to the API. The backend expects `bs58.decode(message)` to work.

### 5. Nonces Expire After 5 Minutes
When you request a challenge for verification, the nonce is only valid for 5 minutes. If you take longer than that to sign and submit, you'll get an error and need to start over.

### 6. Each Nonce Can Only Be Used Once
For security, each nonce is single-use. If your submission fails, request a new challenge rather than retrying with the same nonce.

### 7. Rate Limits Apply
To prevent abuse, the following rate limits are in place:
- **20 registration attempts per 15 minutes**
- **20 verification attempts per 15 minutes**

If you hit these limits, wait 15 minutes before trying again.

---

## Verification Checklist

Use this checklist to ensure you've completed each step correctly:

### Before Registration
- [ ] Generated Ed25519 keypair
- [ ] Stored private key securely (password manager or encrypted file)
- [ ] Gathered agent information (name, description, capabilities)

### Registration
- [ ] Successfully registered agent via web interface, demo, or API
- [ ] Saved the Agent ID (UUID) returned after registration
- [ ] Can find your agent on https://agentid.provenanceai.network

### Verification
- [ ] Completed the challenge-response verification flow
- [ ] Agent status shows as "Verified" on the detail page
- [ ] Trust badge shows "VERIFIED" (not "UNVERIFIED")

### Display
- [ ] Widget URL loads correctly: `https://agentid.provenanceai.network/widget/YOUR_AGENT_ID`
- [ ] Badge displays agent name, score, and verification status
- [ ] SVG badge loads correctly (if using Option 2)

### Understanding Your Score
- [ ] Trust score is visible (starts at 10 for new agents)
- [ ] Understand that score increases over time with activity
- [ ] Know the difference between Gold (≥70) and Blue (<70) tiers

---

## Need Help?

If you encounter issues:

1. **Check this guide first** — many issues are covered in the Common Pitfalls section
2. **Review the Developer Guide** — for technical details on signing and encoding
3. **Try the Demo page** — https://agentid.provenanceai.network/demo to see a working example
4. **Check your Agent ID** — make sure you're using the correct UUID
5. **Verify your private key** — ensure you have the correct key that matches your public key

---

**Welcome to the AgentID ecosystem! Your verified agent helps build trust in the AI-powered future.**
