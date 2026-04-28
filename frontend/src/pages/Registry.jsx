import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAgents, getChains } from '../lib/api';
import { getOrgAgents } from '../lib/authApi';
import { useAuth } from '../components/AuthProvider';
import TrustBadge from '../components/TrustBadge';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'flagged', label: 'Flagged' },
];

const ITEMS_PER_PAGE = 12;

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Agent Registry</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
          Browse verified AI agents across supported chains. Trust scores are computed from on-chain activity and community attestations.
        </p>
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
          {/* Status Dropdown */}
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
                placeholder="e.g., bags.swap.v1"
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

          {/* Chain Dropdown */}
          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Chain
            </label>
            <div className="relative">
              <select
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value)}
                className="w-full sm:w-48 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors appearance-none cursor-pointer"
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
                  <span className="text-[var(--text-primary)] font-semibold">{total}</span> agent{total !== 1 ? 's' : ''} found
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
      {!loading && !error && agents.length === 0 && (
        <EmptyState
          message="No agents registered yet"
          submessage="Be the first to register your agent in the ecosystem."
        />
      )}

      {/* Agent Grid */}
      {!loading && !error && agents.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
            {agents.map((agent) => (
              <Link
                key={agent.agentId || agent.agent_id || agent.id}
                to={`/agents/${agent.agentId || agent.agent_id || agent.id}`}
                className="block transition-transform duration-200 hover:scale-[1.02]"
              >
                <TrustBadge
                  status={agent.status}
                  name={agent.name}
                  score={agent.bagsScore}
                  registeredAt={agent.registeredAt}
                  totalActions={agent.totalActions}
                  agent={agent}
                  className="h-full"
                />
              </Link>
            ))}
          </div>

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
