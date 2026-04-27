import { useState, useEffect, useRef } from 'react';
import authClient from '../lib/authApi';

const ACTION_ICONS = {
  register: '➕',
  verify: '✅',
  revoked: '🔴',
  revoke: '🔴',
  flag: '⚠️',
  flagged: '⚠️',
  login: '🔑',
  update: '✏️',
  create_api_key: '🔐',
  delete: '🗑️',
};

function getActionIcon(action) {
  return ACTION_ICONS[action?.toLowerCase()] || '📋';
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActivityFeed({ orgId, limit = 20 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prevIdsRef = useRef(new Set());

  const fetchActivity = async () => {
    if (!orgId) return;
    try {
      const res = await authClient.get(`/orgs/${orgId}/audit`, {
        params: { limit, page: 1 },
      });
      const logs = res.data?.logs || [];
      const newIds = new Set(logs.map((l) => l.id));
      const hasNew = logs.some((l) => !prevIdsRef.current.has(l.id));
      prevIdsRef.current = newIds;
      setItems((prev) => {
        if (prev.length === 0 || !hasNew) return logs;
        return logs;
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [orgId, limit]);

  if (loading) {
    return (
      <div className="glass rounded-xl border border-[var(--border-subtle)] p-4">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)]" />
              <div className="flex-1 h-4 bg-[var(--bg-tertiary)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-xl border border-[var(--border-subtle)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Activity Feed</h3>
        <span className="text-xs text-[var(--text-muted)]">Updates every 30s</span>
      </div>
      <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-tertiary)]/20 transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
              {getActionIcon(item.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)]">
                <span className="font-medium capitalize">{item.action?.replace(/_/g, ' ') || 'Unknown'}</span>
                {' '}on{' '}
                <span className="text-[var(--text-secondary)]">{item.resource || 'unknown resource'}</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-[var(--text-muted)]">by {item.actor || 'system'}</span>
                <span className="text-xs text-[var(--text-muted)]">·</span>
                <span className="text-xs text-[var(--accent-cyan)]">{formatRelativeTime(item.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
