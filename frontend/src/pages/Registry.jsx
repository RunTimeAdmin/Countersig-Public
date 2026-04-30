import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAgents, getChains } from '../lib/api';
import { getOrgAgents } from '../lib/authApi';
import { useAuth } from '../components/AuthProvider';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'flagged', label: 'Flagged' },
];

const ITEMS_PER_PAGE = 12;

const REGISTRY_TABS = [
  { key: 'all', label: 'All Agents' },
  { key: 'capability', label: 'By Capability' },
  { key: 'chain', label: 'By Chain' },
  { key: 'verified', label: 'Verified Only' },
];

const CAPABILITY_CATEGORIES = {
  'DeFi & Finance': ['defi.', 'bags.', 'swap.', 'lend.', 'stake.'],
  'AI & ML': ['text-generation', 'code-review', 'image-', 'nlp.', 'ml.'],
  'NFT & Digital Assets': ['nft.', 'mint.', 'token.'],
  'Data & Analytics': ['data.', 'analytics.', 'monitor.'],
  'Infrastructure': ['infra.', 'deploy.', 'ci.', 'devops.'],
  'Other': [],
};

const AUTH_BADGE_CONFIG = {
  crypto: { label: 'Ed25519', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  oauth: { label: 'OAuth2', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  api_key: { label: 'API Key', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  entra_id: { label: 'Entra ID', color: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
};

function getAuthBadge(credentialType) {
  if (!credentialType) return AUTH_BADGE_CONFIG.crypto;
  return AUTH_BADGE_CONFIG[credentialType] || { label: credentialType, color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
}

function getScoreColor(score) {
  if (score == null || score === undefined) return 'bg-gray-500/20 text-gray-400';
  if (score >= 70) return 'bg-emerald-500/20 text-emerald-400';
  if (score >= 40) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

function categorizeAgent(agent) {
  const caps = agent.capabilities || agent.capabilitySet || [];
  if (!Array.isArray(caps) || caps.length === 0) return 'Other';
  for (const [category, prefixes] of Object.entries(CAPABILITY_CATEGORIES)) {
    if (category === 'Other') continue;
    for (const cap of caps) {
      if (prefixes.some(p => String(cap).toLowerCase().startsWith(p))) return category;
    }
  }
  return 'Other';
}

// Skeleton loader for agent cards
function AgentCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 border border-[var(--border-subtle)] animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)]" />
        <div className="flex-1">
          <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded mb-2" />
          <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
        </div>
        <div className="h-8 w-16 bg-[var(--bg-tertiary)] rounded" />
      </div>
      <div className="h-px bg-[var(--border-subtle)] my-3" />
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded" />
        <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded" />
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ message, submessage }) {
  return (
    <div className="glass rounded-2xl p-16 text-center animate-fade-in">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
        <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{message}</h3>
      {submessage && <p className="text-[var(--text-muted)]">{submessage}</p>}
    </div>
  );
}

// Enriched Agent Card
function AgentCard({ agent }) {
  const agentId = agent.agentId || agent.agent_id || agent.id;
  const capabilities = agent.capabilities || agent.capabilitySet || [];
  const capsArray = Array.isArray(capabilities) ? capabilities : [];
  const description = agent.description || '';
  const truncatedDesc = description.length > 100 ? description.slice(0, 100) + '...' : description;
  const authBadge = getAuthBadge(agent.credentialType || agent.credential_type);
  const score = agent.bagsScore ?? agent.bags_score ?? null;
  const scoreColor = getScoreColor(score);

  const CHAIN_CONFIG = {
    'solana-bags': { label: 'BAGS', color: '#9945FF' },
    'solana': { label: 'SOL', color: '#14F195' },
    'ethereum': { label: 'ETH', color: '#627EEA' },
    'base': { label: 'BASE', color: '#0052FF' },
    'polygon': { label: 'MATIC', color: '#8247E5' },
  };
  const chain = agent.chainType || agent.chain_type;
  const chainCfg = chain ? CHAIN_CONFIG[chain] : null;

  return (
    <Link
      to={`/agents/${agentId}`}
      className="block glass rounded-xl border border-[var(--border-subtle)] hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1 group"
    >
      <div className="p-5">
        {/* Row 1: Name + Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--text-primary)] truncate group-hover:text-emerald-400 transition-colors">
              {agent.name || 'Unnamed Agent'}
            </h3>
          </div>
          {/* Verified / Flagged badge */}
          {agent.status === 'verified' ? (
            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              Verified
            </span>
          ) : agent.status === 'flagged' ? (
            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01" /></svg>
              Flagged
            </span>
          ) : null}
        </div>

        {/* Description */}
        {truncatedDesc && (
          <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-3 line-clamp-2">
            {truncatedDesc}
          </p>
        )}

        {/* Row 2: Auth method + Chain badge */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${authBadge.color}`}>
            {authBadge.label}
          </span>
          {chainCfg && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${chainCfg.color}20`,
                color: chainCfg.color,
                border: `1px solid ${chainCfg.color}40`,
              }}
            >
              {chainCfg.label}
            </span>
          )}
          {/* Reputation score */}
          {score != null && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${scoreColor}`}>
              {score}/100
            </span>
          )}
        </div>

        {/* Capability tags */}
        {capsArray.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {capsArray.slice(0, 3).map((cap) => (
              <span key={cap} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                {cap}
              </span>
            ))}
            {capsArray.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-[var(--text-muted)]">
                +{capsArray.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent my-2" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            {agent.registeredAt || agent.registered_at
              ? new Date(agent.registeredAt || agent.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
          </span>
          <span className="text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
            View Details
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Registry() {
  const { user, isAuthenticated } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [capability, setCapability] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [scope, setScope] = useState('public');
  const [chains, setChains] = useState([]);
  const [chainFilter, setChainFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (scope === 'org' && isAuthenticated && user?.orgId) {
        const res = await getOrgAgents(user.orgId, {
          status: status || undefined,
          capability: capability || undefined,
          chain: chainFilter || undefined,
          limit: ITEMS_PER_PAGE,
          offset,
        });
        response = res.data;
      } else {
        response = await getAgents({
          status: status || undefined,
          capability: capability || undefined,
          chain: chainFilter || undefined,
          limit: ITEMS_PER_PAGE,
          offset,
        });
      }
      setAgents(response.agents || []);
      setTotal(response.total || 0);
      setHasMore((response.agents || []).length === ITEMS_PER_PAGE);
    } catch (err) {
      setError(err.message || 'Failed to fetch agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [status, capability, chainFilter, offset, scope, isAuthenticated, user?.orgId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    getChains().then(setChains).catch(() => {});
  }, []);

  // Reset offset when filters or scope change
  useEffect(() => {
    setOffset(0);
  }, [status, capability, chainFilter, scope]);

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - ITEMS_PER_PAGE));
  };

  const handleNextPage = () => {
    if (hasMore) {
      setOffset(offset + ITEMS_PER_PAGE);
    }
  };

  const currentPage = Math.floor(offset / ITEMS_PER_PAGE) + 1;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Derive filtered agents based on active tab (client-side filtering on fetched page)
  const filteredAgents = (() => {
    if (activeTab === 'verified') return agents.filter(a => a.status === 'verified');
    return agents;
  })();

  // Group agents by capability category when "By Capability" tab is active
  const groupedAgents = (() => {
    if (activeTab !== 'capability') return null;
    const groups = {};
    for (const cat of Object.keys(CAPABILITY_CATEGORIES)) groups[cat] = [];
    for (const agent of filteredAgents) {
      const cat = categorizeAgent(agent);
      groups[cat].push(agent);
    }
    // Filter out empty categories
    return Object.fromEntries(Object.entries(groups).filter(([, arr]) => arr.length > 0));
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16 animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight">
          <span className="gradient-text">Universal Identity for AI Agents</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-xl max-w-3xl mx-auto leading-relaxed mb-4">
          Countersig 2.0 is the only identity platform built from the ground up with a pluggable, multi-provider authentication architecture. Prove who you are — by wallet, by enterprise SSO, by API key, or by direct agent-to-agent trust.
        </p>
        <p className="text-[var(--text-muted)] text-sm max-w-2xl mx-auto mb-8">
          Not crypto-only. Not enterprise-only. Every identity. One platform.
        </p>
        <a href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg transition-all duration-300 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5">
          Get Started Free
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>

      {/* Authentication Methods Grid */}
      <div className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-8">
          <span className="gradient-text">Six Ways to Authenticate</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Cryptographic (Ed25519) */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/40 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:ring-2 group-hover:ring-[var(--accent-cyan)]/30 transition-all">
              <svg className="w-6 h-6 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Cryptographic (Ed25519)</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Wallet-based identity for blockchain-native agents. Prove ownership via challenge-response signature verification.</p>
          </div>

          {/* OAuth2 / OIDC */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-purple)]/40 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:ring-2 group-hover:ring-[var(--accent-purple)]/30 transition-all">
              <svg className="w-6 h-6 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">OAuth2 / OIDC</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Enterprise SSO for managed AI agents. Config-driven allowed issuers and audiences with OpenID Connect.</p>
          </div>

          {/* Microsoft Entra ID */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/40 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:ring-2 group-hover:ring-[var(--accent-cyan)]/30 transition-all">
              <svg className="w-6 h-6 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Microsoft Entra ID</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Azure workload identity for enterprise AI. Tenant-aware strategy with Entra ID Workload Identity Federation.</p>
          </div>

          {/* API Keys */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-purple)]/40 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:ring-2 group-hover:ring-[var(--accent-purple)]/30 transition-all">
              <svg className="w-6 h-6 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">API Keys</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Programmatic machine-to-machine access. SHA-256 hashed keys with prefix matching and org-level scoping.</p>
          </div>

          {/* Agent-to-Agent (A2A) */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/40 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:ring-2 group-hover:ring-[var(--accent-cyan)]/30 transition-all">
              <svg className="w-6 h-6 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Agent-to-Agent (A2A)</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Direct agent-to-agent trust verification. Short-lived JWT tokens (60s) with a JWKS endpoint for key distribution.</p>
          </div>

          {/* PKI Challenge-Response */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-purple)]/40 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 group-hover:ring-2 group-hover:ring-[var(--accent-purple)]/30 transition-all">
              <svg className="w-6 h-6 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.131A8 8 0 008 2.988 8 8 0 008 11c0 2.472.345 4.865.99 7.131M9.832 18.923C10.476 19.558 11.255 20 12 20c.745 0 1.524-.442 2.168-1.077" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">PKI Challenge-Response</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Ongoing cryptographic proof of identity. Nonce-based challenges with replay prevention for continuous verification.</p>
          </div>
        </div>
      </div>

      {/* Why Countersig? */}
      <div className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-8">
          <span className="gradient-text">Why Countersig?</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] text-center hover:bg-[var(--bg-tertiary)]/40 transition-all duration-300">
            <div className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Not Just Crypto</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Works with enterprise identity providers, SSO, and Azure AD — not just blockchain wallets.</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] text-center hover:bg-[var(--bg-tertiary)]/40 transition-all duration-300">
            <div className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-cyan)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Multi-Chain</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Native support for Solana, Ethereum, Base, Polygon, and chain-agnostic identities.</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] text-center hover:bg-[var(--bg-tertiary)]/40 transition-all duration-300">
            <div className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Trust Scoring</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Multi-dimensional reputation from on-chain attestations, community flagging, and verified activity.</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] text-center hover:bg-[var(--bg-tertiary)]/40 transition-all duration-300">
            <div className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-cyan)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Standards-Based</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Built on W3C DID/VC, OAuth2, OIDC, and JWKS — not proprietary lock-in.</p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="mb-16 animate-fade-in">
        <h2 className="text-3xl font-bold text-center mb-3">
          <span className="gradient-text">Simple, Transparent Pricing</span>
        </h2>
        <p className="text-[var(--text-secondary)] text-center mb-10 text-lg">Start free. Scale as you grow.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Free Tier */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] flex flex-col hover:border-[var(--accent-cyan)]/40 transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Free</h3>
            <div className="mb-5">
              <span className="text-3xl font-extrabold text-[var(--text-primary)]">$0</span>
              <span className="text-[var(--text-muted)] text-sm">/mo</span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {['100 attestations', '50 verifications', '500 badge/reputation calls', '100 A2A tokens', 'Community support'].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <svg className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="block text-center px-5 py-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors">Get Started</a>
          </div>

          {/* Starter Tier — Popular */}
          <div className="glass rounded-2xl p-6 border-2 border-emerald-500 flex flex-col relative hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-emerald-500/10">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">Popular</span>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Starter</h3>
            <div className="mb-5">
              <span className="text-3xl font-extrabold text-[var(--text-primary)]">$29</span>
              <span className="text-[var(--text-muted)] text-sm">/mo</span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {['5,000 attestations', '1,000 verifications', '10,000 badge/reputation calls', '1,000 A2A tokens', 'Email support'].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <svg className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <a href="/settings" className="block text-center px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors">Subscribe</a>
          </div>

          {/* Professional Tier */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] flex flex-col hover:border-[var(--accent-purple)]/40 transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Professional</h3>
            <div className="mb-5">
              <span className="text-3xl font-extrabold text-[var(--text-primary)]">$99</span>
              <span className="text-[var(--text-muted)] text-sm">/mo</span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {['50,000 attestations', '10,000 verifications', '100,000 badge/reputation calls', '10,000 A2A tokens', 'Priority support'].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <svg className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <a href="/settings" className="block text-center px-5 py-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors">Subscribe</a>
          </div>

          {/* Enterprise Tier */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)] flex flex-col hover:border-[var(--accent-cyan)]/40 transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Enterprise</h3>
            <div className="mb-5">
              <span className="text-3xl font-extrabold text-[var(--text-primary)]">Custom</span>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {['Unlimited everything', 'Dedicated account manager', 'Custom SLA', 'SSO & SAML'].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <svg className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <a href="mailto:enterprise@countersig.com" className="block text-center px-5 py-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors">Contact Us</a>
          </div>
        </div>
      </div>

      {/* Developer Quick Start */}
      <div className="mb-16 animate-fade-in rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border-subtle)] p-8 md:p-10">
        <h2 className="text-2xl font-bold text-center mb-8">
          <span className="gradient-text">Get Started in Seconds</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* TypeScript SDK */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">TypeScript SDK</h3>
            <div className="relative group">
              <pre className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-4 overflow-x-auto text-sm text-emerald-400 font-mono">npm install @countersig/sdk</pre>
              <button
                onClick={() => { navigator.clipboard.writeText('npm install @countersig/sdk'); }}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all"
                title="Copy"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </div>
          </div>
          {/* Claude MCP Integration */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Claude MCP Integration</h3>
            <div className="relative group">
              <pre className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-4 overflow-x-auto text-sm text-emerald-400 font-mono">claude mcp add countersig -- npx -y @countersig/mcp</pre>
              <button
                onClick={() => { navigator.clipboard.writeText('claude mcp add countersig -- npx -y @countersig/mcp'); }}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all"
                title="Copy"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </div>
          </div>
        </div>
        <div className="text-center">
          <Link to="/guides" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors">
            View All Guides
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-16">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
        <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] opacity-60" />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent" />
      </div>

      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Agent Registry</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
          Browse verified AI agents across all identity providers and chains. Trust scores are computed from on-chain activity and community attestations.
        </p>
      </div>

      {/* Registry Tab Bar */}
      <div className="flex justify-center mb-6 animate-fade-in">
        <div className="inline-flex p-1 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] gap-1">
          {REGISTRY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                activeTab === tab.key
                  ? 'text-white bg-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope Toggle */}
      {isAuthenticated && (
        <div className="flex justify-center mb-8 animate-fade-in">
          <div className="inline-flex p-1 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
            <button
              onClick={() => setScope('public')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                scope === 'public'
                  ? 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Public Registry
              </span>
            </button>
            <button
              onClick={() => setScope('org')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                scope === 'org'
                  ? 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                My Organization
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass rounded-xl p-4 mb-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Dropdown — hidden on "Verified Only" tab since it's redundant */}
          {activeTab !== 'verified' && (
            <div className="flex-1 sm:flex-none">
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full sm:w-48 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors appearance-none cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* Capability Search */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Capability
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                placeholder="e.g., defi.swap, text-generation"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors"
              />
              {capability && (
                <button
                  onClick={() => setCapability('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Chain Dropdown — prominent on "By Chain" tab, available on others */}
          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Chain
            </label>
            <div className="relative">
              <select
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value)}
                className={`w-full sm:w-48 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors appearance-none cursor-pointer ${
                  activeTab === 'chain' ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-[var(--border-default)]'
                }`}
              >
                <option value="">All Chains</option>
                {chains.map(c => (
                  <option key={c.chainType} value={c.chainType}>{c.name}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-end">
            <div className="text-sm text-[var(--text-muted)]">
              {loading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  <span className="text-[var(--text-primary)] font-semibold">{activeTab === 'verified' ? filteredAgents.length : total}</span> agent{(activeTab === 'verified' ? filteredAgents.length : total) !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="glass rounded-xl p-6 mb-8 border border-red-500/30 bg-red-500/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-red-400 font-semibold">Error loading agents</h3>
              <p className="text-[var(--text-muted)] text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAgents.length === 0 && (
        <EmptyState
          message="No agents registered yet"
          submessage="Be the first to register your agent in the ecosystem."
        />
      )}

      {/* Agent Grid */}
      {!loading && !error && filteredAgents.length > 0 && (
        <>
          {activeTab === 'capability' && groupedAgents ? (
            // Grouped by capability category
            <div className="space-y-10 animate-fade-in">
              {Object.entries(groupedAgents).map(([category, catAgents]) => (
                <div key={category}>
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-3">
                    <span className="w-1.5 h-6 rounded-full bg-emerald-500" />
                    {category}
                    <span className="text-sm font-normal text-[var(--text-muted)]">({catAgents.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catAgents.map((agent) => (
                      <AgentCard key={agent.agentId || agent.agent_id || agent.id} agent={agent} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat grid for other tabs
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.agentId || agent.agent_id || agent.id} agent={agent} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-8 animate-fade-in">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="text-sm text-[var(--text-muted)]">
                Page <span className="text-[var(--text-primary)] font-semibold">{currentPage}</span> of{' '}
                <span className="text-[var(--text-primary)] font-semibold">{totalPages}</span>
              </div>

              <button
                onClick={handleNextPage}
                disabled={!hasMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
