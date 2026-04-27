import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { discoverAgents } from '../lib/api';
import TrustBadge from '../components/TrustBadge';
import CapabilityList from '../components/CapabilityList';

const SUGGESTED_CAPABILITIES = [
  { id: 'bags.swap.v1', label: 'bags.swap.v1', color: 'cyan' },
  { id: 'bags.fee-claim.v1', label: 'bags.fee-claim.v1', color: 'emerald' },
  { id: 'bags.launch.v1', label: 'bags.launch.v1', color: 'purple' },
  { id: 'infra.solana.health.v1', label: 'infra.solana.health.v1', color: 'blue' },
];

const COLOR_CLASSES = {
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
};

// Skeleton loader for result cards
function ResultCardSkeleton() {
  return (
    <div className="glass rounded-xl p-5 border border-[var(--border-subtle)] animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)]" />
          <div>
            <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded mb-2" />
            <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded" />
          </div>
        </div>
        <div className="h-10 w-16 bg-[var(--bg-tertiary)] rounded-lg" />
      </div>
      <div className="h-px bg-[var(--border-subtle)] my-4" />
      <div className="flex flex-wrap gap-2">
        <div className="h-6 w-24 bg-[var(--bg-tertiary)] rounded" />
        <div className="h-6 w-28 bg-[var(--bg-tertiary)] rounded" />
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ icon, title, message, action }) {
  return (
    <div className="glass rounded-2xl p-16 text-center animate-fade-in">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[var(--text-muted)] mb-6">{message}</p>
      {action}
    </div>
  );
}

// Rank badge component
function RankBadge({ rank }) {
  const getRankStyle = () => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg shadow-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900 shadow-lg shadow-slate-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30';
      default:
        return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-default)]';
    }
  };

  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${getRankStyle()}`}>
      #{rank}
    </div>
  );
}

// Score badge component
function ScoreBadge({ score }) {
  let colorClass = 'text-red-400 bg-red-500/10 border-red-500/30';
  if (score >= 80) colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  else if (score >= 60) colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  else if (score >= 40) colorClass = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';

  return (
    <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${colorClass}`}>
      {score}/100
    </div>
  );
}

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (capability) => {
    if (!capability.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await discoverAgents({ capability: capability.trim() });
      setResults(response.agents || []);
    } catch (err) {
      setError(err.message || 'Failed to discover agents');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const handleSuggestedClick = (capability) => {
    setSearchQuery(capability);
    handleSearch(capability);
  };

  // Initial empty state - before any search
  if (!hasSearched && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Discover Agents</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Find the best AI agents for your needs. Search by capability to discover verified agents ranked by reputation score.
          </p>
        </div>

        {/* Search Box */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-8 animate-fade-in border border-[var(--border-subtle)]">
          <form onSubmit={handleSubmit} className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <svg className="w-6 h-6 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find the best agent for... (e.g., bags.swap.v1)"
              className="w-full pl-14 pr-32 py-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-lg focus:border-[var(--accent-cyan)] focus:ring-2 focus:ring-[var(--accent-cyan)]/20 transition-all duration-200"
            />
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </form>

          {/* Suggested Capabilities */}
          <div className="mt-6">
            <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Suggested Capabilities
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_CAPABILITIES.map((cap) => (
                <button
                  key={cap.id}
                  onClick={() => handleSuggestedClick(cap.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${COLOR_CLASSES[cap.color]}`}
                >
                  {cap.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Empty State */}
        <EmptyState
          icon={
            <svg className="w-10 h-10 text-[var(--accent-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          title="Search for a capability"
          message="Enter a capability name or select one of the suggested options above to discover verified agents."
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Discover Agents</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
          Find the best AI agents for your needs. Search by capability to discover verified agents ranked by reputation score.
        </p>
      </div>

      {/* Search Box - Compact */}
      <div className="glass rounded-xl p-4 mb-8 animate-fade-in border border-[var(--border-subtle)]">
        <form onSubmit={handleSubmit} className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find the best agent for..."
            className="w-full pl-10 pr-24 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              'Search'
            )}
          </button>
        </form>

        {/* Suggested Capabilities */}
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTED_CAPABILITIES.map((cap) => (
            <button
              key={cap.id}
              onClick={() => handleSuggestedClick(cap.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-200 ${
                searchQuery === cap.id
                  ? 'bg-[var(--accent-cyan)] text-white border-[var(--accent-cyan)]'
                  : COLOR_CLASSES[cap.color]
              }`}
            >
              {cap.label}
            </button>
          ))}
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
              <h3 className="text-red-400 font-semibold">Error discovering agents</h3>
              <p className="text-[var(--text-muted)] text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4 animate-fade-in">
          {Array.from({ length: 3 }).map((_, i) => (
            <ResultCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* No Results State */}
      {!loading && !error && results.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No agents found"
          message={`No agents found with the capability "${searchQuery}". Try a different search term or check back later.`}
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setHasSearched(false);
                setResults([]);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/20 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Start New Search
            </button>
          }
        />
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className="animate-fade-in">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-[var(--text-muted)]">
              Found <span className="text-[var(--text-primary)] font-semibold">{results.length}</span> agent{results.length !== 1 ? 's' : ''} for{' '}
              <span className="font-mono text-[var(--accent-cyan)]">{searchQuery}</span>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Ranked by Bags Score
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {results.map((agent, index) => (
              <Link
                key={agent.agentId || agent.agent_id || agent.id}
                to={`/agents/${agent.agentId || agent.agent_id || agent.id}`}
                className="block group"
              >
                <div className="glass rounded-xl p-5 border border-[var(--border-subtle)] transition-all duration-300 hover:border-[var(--accent-cyan)]/50 hover:shadow-lg hover:shadow-[var(--accent-cyan)]/10">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      <RankBadge rank={index + 1} />
                    </div>

                    {/* Agent Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors">
                          {agent.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          agent.status === 'verified' ? 'status-verified' :
                          agent.status === 'flagged' ? 'status-flagged' : 'status-unverified'
                        }`}>
                          {agent.status}
                        </span>
                      </div>

                      <div className="font-mono text-sm text-[var(--text-muted)] mb-3">
                        {agent.pubkey.slice(0, 16)}...{agent.pubkey.slice(-8)}
                      </div>

                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-2">
                        {(agent.capabilities || []).slice(0, 3).map((cap, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                          >
                            {cap}
                          </span>
                        ))}
                        {(agent.capabilities || []).length > 3 && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)]">
                            +{(agent.capabilities || []).length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0">
                      <div className="text-right">
                        <ScoreBadge score={agent.bagsScore || 0} />
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          {(agent.totalActions || 0).toLocaleString()} actions
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex flex-shrink-0">
                      <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-cyan)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setSearchQuery('');
                setHasSearched(false);
                setResults([]);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Search for another capability
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
