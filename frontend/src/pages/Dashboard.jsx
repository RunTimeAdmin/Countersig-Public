import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { getOrgStats, getOrgAgents } from '../lib/authApi';
import TrustBadge from '../components/TrustBadge';

const STAT_CARDS = [
  { key: 'total_agents', label: 'Total Agents', icon: '🤖', color: 'cyan' },
  { key: 'verified_agents', label: 'Verified', icon: '✅', color: 'emerald' },
  { key: 'flagged_agents', label: 'Flagged', icon: '⚠️', color: 'amber' },
  { key: 'revoked_agents', label: 'Revoked', icon: '🚫', color: 'red' },
  { key: 'total_users', label: 'Team Members', icon: '👥', color: 'purple' },
];

function StatCard({ label, value, icon, color }) {
  const colorMap = {
    cyan: 'from-[var(--accent-cyan)]/20 to-[var(--accent-cyan)]/5 border-[var(--accent-cyan)]/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    purple: 'from-[var(--accent-purple)]/20 to-[var(--accent-purple)]/5 border-[var(--accent-purple)]/20',
  };

  const textMap = {
    cyan: 'text-[var(--accent-cyan)]',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    purple: 'text-[var(--accent-purple)]',
  };

  return (
    <div className={`glass rounded-xl p-5 border bg-gradient-to-br ${colorMap[color]} transition-all duration-200 hover:scale-[1.02]`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${textMap[color]}`}>{value?.toLocaleString() ?? 0}</span>
      </div>
      <div className="text-sm text-[var(--text-muted)] font-medium">{label}</div>
    </div>
  );
}

function AgentRow({ agent }) {
  return (
    <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
      <td className="py-3 px-4">
        <Link to={`/agents/${agent.agentId || agent.agent_id || agent.id}`} className="block">
          <TrustBadge
            status={agent.status}
            name={agent.name}
            score={agent.bagsScore}
            className="w-full"
          />
        </Link>
      </td>
      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
        {agent.capabilities?.slice(0, 2).join(', ')}
        {agent.capabilities?.length > 2 && ' ...'}
      </td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
          agent.status === 'verified' ? 'status-verified' :
          agent.status === 'flagged' ? 'status-flagged' : 'status-unverified'
        }`}>
          {agent.status}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-[var(--text-secondary)] text-right">
        {agent.bagsScore ?? '-'}
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.orgId) {
        setLoading(false);
        return;
      }
      try {
        const [statsRes, agentsRes] = await Promise.all([
          getOrgStats(user.orgId).catch(() => ({ data: {} })),
          getOrgAgents(user.orgId, { limit: 10 }).catch(() => ({ data: { agents: [] } })),
        ]);
        setStats(statsRes.data);
        setAgents(agentsRes.data.agents || []);
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.orgId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 bg-[var(--bg-tertiary)] rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--bg-tertiary)] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
          Welcome back, {user?.name || 'Admin'}
        </h1>
        <p className="text-[var(--text-secondary)]">
          {user?.orgName ? `${user.orgName} Dashboard` : 'Organization Dashboard'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={stats?.[card.key]}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => navigate('/register')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register Agent
        </button>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          View Registry
        </Link>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Manage Team
        </Link>
      </div>

      {/* Recent Agents */}
      <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Agents</h2>
          <Link to="/" className="text-sm text-[var(--accent-cyan)] hover:text-[var(--accent-purple)] transition-colors">
            View all
          </Link>
        </div>
        {agents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">No agents yet</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">Register your first agent to get started.</p>
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Register Agent
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Agent</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Capabilities</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <AgentRow key={agent.agentId || agent.agent_id || agent.id} agent={agent} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
