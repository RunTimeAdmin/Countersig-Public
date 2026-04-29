import { useState } from "react";
import { Link } from "react-router-dom";

const BookOpenIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>);
const UserIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const CodeIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>);
const ExternalLinkIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>);
const ArrowRightIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>);
const PuzzleIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>);
const ServerIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 01-2 2v4a2 2 0 012 2h14a2 2 0 012-2v-4a2 2 0 01-2-2m-2-4h.01M17 16h.01" /></svg>);
const LockIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>);
const RefreshIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>);

export default function Guides() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="text-center mb-12 animate-fade-in">
        <div className="glass rounded-2xl p-8 md:p-12 border border-gray-700 relative overflow-hidden">
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 mb-6">
              <BookOpenIcon className="w-10 h-10 text-cyan-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4"><span className="gradient-text">Documentation</span></h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">Everything you need to register your AI agent, verify its identity, and integrate AgentID trust badges.</p>
            <a 
              href="/docs/index.html" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/25"
            >
              <span>View Full Documentation</span>
              <ArrowRightIcon className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Agent Owner Guide</h2>
          </div>
          <p className="text-gray-400 mb-4">Learn how to register your AI agent, complete PKI verification, and display trust badges on your website or documentation.</p>
          <a href="/docs/index.html#agent-owner" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
            <span>Read Guide</span>
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-purple-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <CodeIcon className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Developer Guide</h2>
          </div>
          <p className="text-gray-400 mb-4">Technical documentation for integrating AgentID into your applications, including API reference, widget embedding, and SDK usage.</p>
          <a href="/docs/index.html#trustmark" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
            <span>Read Guide</span>
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <PuzzleIcon className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Widget & Trust Badges</h2>
          </div>
          <p className="text-gray-400 mb-4">Embed verifiable trust badges on your website. Customize appearance, configure real-time verification, and display agent reputation.</p>
          <a href="/docs/index.html#trustmark" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors">
            <span>Read Guide</span>
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-amber-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ServerIcon className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Deployment Guide</h2>
          </div>
          <p className="text-gray-400 mb-4">Deploy AgentID to production with Docker Compose, configure PostgreSQL, Redis, and Caddy reverse proxy for HTTPS.</p>
          <a href="https://github.com/RunTimeAdmin/AgentID-2.0/blob/main/docs/DEPLOYMENT_GUIDE.md" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors">
            <span>Read Guide</span>
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-rose-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <LockIcon className="w-6 h-6 text-rose-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Authentication</h2>
          </div>
          <p className="text-gray-400 mb-4">Configure pluggable authentication providers including Ed25519 crypto, OAuth2/OIDC, Microsoft Entra ID, API keys, and A2A JWT tokens.</p>
          <a href="/docs/index.html#api" className="inline-flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors">
            <span>Read Guide</span>
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-yellow-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <RefreshIcon className="w-6 h-6 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Migration Guide</h2>
          </div>
          <p className="text-gray-400 mb-4">Upgrade between AgentID versions with step-by-step migration instructions, schema changes, and backward compatibility notes.</p>
          <a href="https://github.com/RunTimeAdmin/AgentID-2.0/blob/main/docs/MIGRATION_GUIDE.md" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors">
            <span>Read Guide</span>
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="mt-6 glass rounded-2xl p-6 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">API Reference</h3>
            <p className="text-gray-400 text-sm">Complete endpoint documentation with request/response examples</p>
          </div>
          <a href="/docs/index.html#api" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors border border-gray-600">
            <span>View API Docs</span>
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>
      </div>

      <section className="mt-16 mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2 text-center">Technical Reference</h2>
        <p className="text-[var(--text-secondary)] text-center mb-8">In-depth technical documentation for advanced integrations</p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Multi-Chain Registration</h2>
        <p className="text-[var(--text-secondary)]">
          AgentID 2.0 supports agent registration across multiple blockchains. Each chain uses its native signing algorithm for identity verification.
        </p>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Supported Chains</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 text-[var(--text-muted)] font-medium">Chain</th>
                  <th className="text-left py-2 text-[var(--text-muted)] font-medium">Algorithm</th>
                  <th className="text-left py-2 text-[var(--text-muted)] font-medium">Address Format</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <tr className="border-b border-[var(--border-subtle)]"><td className="py-2">Solana (BAGS)</td><td>Ed25519</td><td>Base58 public key</td></tr>
                <tr className="border-b border-[var(--border-subtle)]"><td className="py-2">Solana (Generic)</td><td>Ed25519</td><td>Base58 public key</td></tr>
                <tr className="border-b border-[var(--border-subtle)]"><td className="py-2">Ethereum</td><td>SECP256K1</td><td>0x hex address (42 chars)</td></tr>
                <tr className="border-b border-[var(--border-subtle)]"><td className="py-2">Base</td><td>SECP256K1</td><td>0x hex address (42 chars)</td></tr>
                <tr className="border-b border-[var(--border-subtle)]"><td className="py-2">Polygon</td><td>SECP256K1</td><td>0x hex address (42 chars)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">EVM Agent Registration</h3>
          <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-secondary)]">
              <li>Select an EVM chain (Ethereum, Base, or Polygon) during registration</li>
              <li>Enter your wallet address (0x format, 42 characters)</li>
              <li>Request a challenge from the AgentID server</li>
              <li>Sign the challenge using MetaMask (<code className="bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-xs">personal_sign</code>) or ethers.js</li>
              <li>Submit the signature to complete verification</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Agent-to-Agent (A2A) Tokens</h2>
        <p className="text-[var(--text-secondary)]">
          A2A tokens enable secure communication between agents. These are short-lived JWTs that prove an agent&apos;s identity to other agents or services.
        </p>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Issuing a Token</h3>
          <pre className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] overflow-x-auto text-xs text-[var(--text-secondary)]"><code>{`POST /agents/:agentId/issue-token
Authorization: Bearer <your-jwt>

Response:
{
  "token": "eyJhbG...",
  "expiresIn": "15m"
}`}</code></pre>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Verifying a Token</h3>
          <pre className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] overflow-x-auto text-xs text-[var(--text-secondary)]"><code>{`POST /agents/verify-token
Content-Type: application/json

{ "token": "eyJhbG..." }

Response:
{
  "valid": true,
  "agentId": "agent-123",
  "chainType": "ethereum"
}`}</code></pre>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Using the Verify Package</h3>
          <pre className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] overflow-x-auto text-xs text-[var(--text-secondary)]"><code>{`import { AgentIDVerifier } from '@agentidapp/verify';

const verifier = new AgentIDVerifier({
  baseURL: 'https://agentidapp.com'
});

const result = await verifier.verify(token);
console.log(result.valid, result.agentId);`}</code></pre>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">W3C Verifiable Credentials</h2>
        <p className="text-[var(--text-secondary)]">
          AgentID can export agent identity data as W3C Verifiable Credentials, enabling interoperability with standard identity systems.
        </p>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Exporting a Credential</h3>
          <pre className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] overflow-x-auto text-xs text-[var(--text-secondary)]"><code>{`GET /agents/:agentId/credential

Response:
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "AgentIdentityCredential"],
  "issuer": "did:web:agentidapp.com",
  "credentialSubject": {
    "id": "did:web:agentidapp.com:agents:agent-123",
    "name": "My Agent",
    "chainType": "ethereum",
    "capabilities": ["defi.swap.v1"],
    "reputationScore": 85
  }
}`}</code></pre>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">DID Document</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            The platform&apos;s DID document is available at <code className="bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-xs">/.well-known/did.json</code> and contains the public keys used for credential verification.
          </p>
        </div>
      </section>
    </div>
  );
}
