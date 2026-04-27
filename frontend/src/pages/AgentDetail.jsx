import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAgent, getBadge, getReputation, flagAgent, getAttestations, getFlags } from '../lib/api';
import TrustBadge from '../components/TrustBadge';
import ReputationBreakdown from '../components/ReputationBreakdown';
import CapabilityList from '../components/CapabilityList';
import FlagModal from '../components/FlagModal';

// Skeleton loader for the entire page
function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
      {/* Hero skeleton */}
      <div className="glass rounded-2xl p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)]" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded mb-3" />
            <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded mb-3" />
            <div className="h-4 w-96 bg-[var(--bg-tertiary)] rounded" />
          </div>
          <div className="h-12 w-32 bg-[var(--bg-tertiary)] rounded-xl" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6 h-64 bg-[var(--bg-tertiary)]/30" />
          <div className="glass rounded-2xl p-6 h-48 bg-[var(--bg-tertiary)]/30" />
        </div>
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 h-40 bg-[var(--bg-tertiary)]/30" />
          <div className="glass rounded-2xl p-6 h-40 bg-[var(--bg-tertiary)]/30" />
        </div>
      </div>
    </div>
  );
}

// Copy button component
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// Truncate pubkey for display
function truncatePubkey(pubkey) {
  if (!pubkey || pubkey.length < 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}

// Format date nicely
function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  // Check if date is valid
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Success rate indicator
function SuccessRateIndicator({ success, failed }) {
  const total = success + failed;
  const rate = total > 0 ? Math.round((success / total) * 100) : 0;

  let colorClass = 'text-red-400';
  if (rate >= 90) colorClass = 'text-emerald-400';
  else if (rate >= 70) colorClass = 'text-amber-400';

  return (
    <div className="flex items-center gap-4">
      <div className={`text-3xl font-bold ${colorClass}`}>{rate}%</div>
      <div className="flex-1">
        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-400' : rate >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${rate}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>{success.toLocaleString()} successful</span>
          <span>{failed.toLocaleString()} failed</span>
        </div>
      </div>
    </div>
  );
}

// Attestation/Flag history item
function HistoryItem({ item, type }) {
  const isFlag = type === 'flag';
  const iconColor = isFlag ? 'text-red-400' : 'text-emerald-400';
  const bgColor = isFlag ? 'bg-red-500/10' : 'bg-emerald-500/10';

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isFlag ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-medium ${isFlag ? 'text-red-400' : 'text-emerald-400'}`}>
            {isFlag ? 'Flagged' : 'Attested'}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {formatDate(item.created_at)}
          </span>
        </div>
        {item.reason && (
          <p className="text-sm text-[var(--text-secondary)]">{item.reason}</p>
        )}
        {item.attestation_type && (
          <p className="text-sm text-[var(--text-secondary)]">{item.attestation_type}</p>
        )}
        <div className="text-xs text-[var(--text-muted)] mt-1">
          by {truncatePubkey(item.attestor_pubkey || item.reporter_pubkey)}
        </div>
      </div>
    </div>
  );
}

export default function AgentDetail() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agent, setAgent] = useState(null);
  const [badge, setBadge] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [attestations, setAttestations] = useState([]);
  const [flags, setFlags] = useState([]);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [agentData, badgeData, repData, attestData, flagsData] = await Promise.all([
          getAgent(agentId).catch(() => null),
          getBadge(agentId).catch(() => null),
          getReputation(agentId).catch(() => null),
          getAttestations(agentId).catch(() => ({ attestations: [] })),
          getFlags(agentId).catch(() => ({ flags: [] })),
        ]);

        if (!agentData) {
          setError('Agent not found');
          return;
        }

        setAgent(agentData?.agent || agentData);
        setBadge(badgeData);
        setReputation(repData);
        setAttestations(attestData || {});
        setFlags(flagsData.flags || []);
      } catch (err) {
        setError(err.message || 'Failed to load agent details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentId]);

  const handleFlagSubmit = async (flagData) => {
    setFlagSubmitting(true);
    try {
      await flagAgent(agentId, flagData);
      // Refresh flags after submission
      const flagsData = await getFlags(agentId);
      setFlags(flagsData.flags || []);
      setIsFlagModalOpen(false);
    } catch (err) {
      throw new Error(err.message || 'Failed to submit flag');
    } finally {
      setFlagSubmitting(false);
    }
  };

  // 404 State
  if (!loading && error === 'Agent not found') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="glass rounded-2xl p-16 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">Agent Not Found</h2>
          <p className="text-[var(--text-muted)] mb-6">The agent you're looking for doesn't exist or has been removed.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return <PageSkeleton />;
  }

  // Error State
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="glass rounded-2xl p-12 text-center border border-red-500/30 bg-red-500/10 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Agent</h2>
          <p className="text-[var(--text-muted)] mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] hover:bg-[var(--border-default)] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Note: flagHistory only contains flags since attestations are shown as aggregate stats elsewhere
  const flagHistory = [
    ...flags.map((f) => ({ ...f, type: 'flag' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      {/* Hero Section */}
      <div className="glass rounded-2xl p-6 md:p-8 mb-8 border border-[var(--border-subtle)]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* Large Trust Badge Icon */}
          <div className="flex-shrink-0">
            <TrustBadge
              status={agent.status}
              name={agent.name}
              score={badge?.bagsScore ?? badge?.bags_score}
              tier={badge?.tier}
              tierColor={badge?.tierColor}
              className="w-full lg:w-80"
            />
          </div>

          {/* Agent Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                agent.status === 'verified' ? 'status-verified' :
                agent.status === 'flagged' ? 'status-flagged' : 'status-unverified'
              }`}>
                {agent.status}
              </span>
              {badge?.tier && agent.status === 'verified' && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  badge.tier === 'verified' 
                    ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                    : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/50'
                }`}>
                  {badge.tier === 'verified' ? '★ VERIFIED' : 'TRUSTED'} TIER
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3">
              {agent.name}
            </h1>

            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1.5 rounded-lg">
                {truncatePubkey(agent?.pubkey || agentId)}
              </span>
              <CopyButton text={agent?.pubkey || agentId} label="pubkey" />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setIsFlagModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Flag this agent
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Reputation & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reputation Section */}
          {reputation && (
            <ReputationBreakdown breakdown={reputation.breakdown} />
          )}

          {/* Details Section */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Agent Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agent.tokenMint && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Token Mint</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)] break-all">
                    {truncatePubkey(agent.tokenMint)}
                  </div>
                </div>
              )}
              {agent.creatorX && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Creator X</div>
                  <a
                    href={`https://x.com/${agent.creatorX.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--accent-cyan)] hover:underline flex items-center gap-1"
                  >
                    {agent.creatorX}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
              {agent.creatorWallet && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Creator Wallet</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)] break-all">
                    {truncatePubkey(agent.creatorWallet)}
                  </div>
                </div>
              )}
              {agent.registeredAt && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Registered</div>
                  <div className="text-sm text-[var(--text-secondary)]">{formatDate(agent.registeredAt)}</div>
                </div>
              )}
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Last Verified</div>
                <div className="text-sm text-[var(--text-secondary)]">{formatDate(agent.lastVerified)}</div>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Action Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {(attestations.totalActions || agent.totalActions || 0).toLocaleString()}
                </div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Actions</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-2xl font-bold text-emerald-400">
                  {(attestations.successfulActions || agent.successfulActions || 0).toLocaleString()}
                </div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Successful</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-2xl font-bold text-red-400">
                  {(attestations.failedActions || agent.failedActions || 0).toLocaleString()}
                </div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Failed</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-2xl font-bold text-[var(--accent-cyan)]">
                  {(attestations.bagsScore || agent.bagsScore || 0).toLocaleString()}
                </div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">BAGS Score</div>
              </div>
            </div>
            <SuccessRateIndicator
              success={attestations.successfulActions || agent.successfulActions || 0}
              failed={attestations.failedActions || agent.failedActions || 0}
            />
          </div>
        </div>

        {/* Right Column - Capabilities & History */}
        <div className="space-y-6">
          {/* Capabilities Section */}
          <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Capabilities</h3>
            <CapabilityList capabilities={agent.capabilities || []} showLabel={false} />
          </div>

          {/* Description */}
          {agent.description && (
            <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Description</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{agent.description}</p>
            </div>
          )}

          {/* Flag History */}
          {flagHistory.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Activity History
                <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                  ({flagHistory.length})
                </span>
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {flagHistory.slice(0, 10).map((item, index) => (
                  <HistoryItem key={index} item={item} type={item.type} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flag Modal */}
      <FlagModal
        isOpen={isFlagModalOpen}
        onClose={() => setIsFlagModalOpen(false)}
        onSubmit={handleFlagSubmit}
        agentPubkey={agent?.pubkey || agentId}
      />
    </div>
  );
}
