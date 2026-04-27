import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import authClient from '../lib/authApi';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'register', label: 'Register' },
  { value: 'update', label: 'Update' },
  { value: 'verify', label: 'Verify' },
  { value: 'revoke', label: 'Revoke' },
  { value: 'flag', label: 'Flag' },
  { value: 'login', label: 'Login' },
  { value: 'create_api_key', label: 'Create API Key' },
  { value: 'delete', label: 'Delete' },
];

const LIMIT = 50;

function formatTimestamp(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getRiskColor(score) {
  if (score == null) return 'text-[var(--text-muted)]';
  if (score <= 30) return 'text-emerald-400';
  if (score <= 60) return 'text-amber-400';
  if (score <= 80) return 'text-orange-400';
  return 'text-red-400';
}

function getRiskBg(score) {
  if (score == null) return 'bg-[var(--bg-tertiary)]';
  if (score <= 30) return 'bg-emerald-500/10 border-emerald-500/30';
  if (score <= 60) return 'bg-amber-500/10 border-amber-500/30';
  if (score <= 80) return 'bg-orange-500/10 border-orange-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function getActionBadge(action) {
  const map = {
    register: 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border-[var(--accent-cyan)]/30',
    verify: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    revoke: 'bg-red-500/10 text-red-400 border-red-500/30',
    flag: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    login: 'bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] border-[var(--accent-purple)]/30',
    update: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    create_api_key: 'bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] border-[var(--accent-purple)]/30',
    delete: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return map[action?.toLowerCase()] || 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
}

export default function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const [filters, setFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
  });

  const fetchLogs = useCallback(async () => {
    if (!user?.orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (appliedFilters.action) params.action = appliedFilters.action;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;

      const res = await authClient.get(`/orgs/${user.orgId}/audit`, { params });
      setLogs(res.data?.logs || []);
      setTotal(res.data?.total || 0);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user?.orgId, page, appliedFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const handleResetFilters = () => {
    setFilters({ action: '', startDate: '', endDate: '' });
    setAppliedFilters({ action: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const handleVerify = async () => {
    if (!user?.orgId) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await authClient.get(`/orgs/${user.orgId}/audit/verify`);
      setVerifyResult(res.data);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.response?.data?.error || 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async (format) => {
    if (!user?.orgId) return;
    setExportOpen(false);
    try {
      const params = { format };
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;

      const res = await authClient.get(`/orgs/${user.orgId}/audit/export`, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${user.orgId}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed. Please try again.');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Audit Log</h1>
          <p className="text-[var(--text-secondary)]">Review and verify all organization activity</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl glass border border-[var(--border-subtle)] shadow-lg overflow-hidden z-20 animate-fade-in">
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Export CSV
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/20 transition-all duration-200 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {verifying ? 'Verifying...' : 'Verify Chain'}
          </button>
        </div>
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

      {/* Verify Result Modal */}
      {verifyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-2xl border border-[var(--border-subtle)] shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              {verifyResult.valid ? (
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {verifyResult.valid ? 'Chain Verified' : 'Chain Tampered'}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {verifyResult.valid
                    ? `${verifyResult.totalEntries?.toLocaleString() ?? 'All'} entries verified`
                    : verifyResult.error || `First invalid entry: #${verifyResult.firstInvalidEntry}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVerifyResult(null)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6 border border-[var(--border-subtle)]">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Action
            </label>
            <div className="relative">
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full sm:w-48 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors appearance-none cursor-pointer"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full sm:w-44 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors"
            />
          </div>

          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full sm:w-44 px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors"
            />
          </div>

          <div className="flex items-end gap-3">
            <button
              onClick={handleApplyFilters}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
            >
              Apply
            </button>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-xl" />
          ))}
        </div>
      )}

      {/* Log Table */}
      {!loading && (
        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Timestamp</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Action</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Actor</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Resource</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Risk Score</th>
                  <th className="py-3 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">No audit logs found</h3>
                      <p className="text-sm text-[var(--text-muted)]">Try adjusting your filters.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${getActionBadge(log.action)}`}>
                            {log.action?.replace(/_/g, ' ') || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-primary)]">{log.actor || '—'}</td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)] truncate max-w-xs">{log.resource || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRiskBg(log.risk_score)} ${getRiskColor(log.risk_score)}`}>
                            {log.risk_score ?? '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                            log.status === 'success' ? 'text-emerald-400' :
                            log.status === 'failure' ? 'text-red-400' :
                            'text-[var(--text-muted)]'
                          }`}>
                            {log.status === 'success' && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {log.status === 'failure' && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            {log.status || '—'}
                          </span>
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr className="animate-fade-in">
                          <td colSpan={6} className="px-4 py-4 bg-[var(--bg-tertiary)]/20">
                            <div className="space-y-3">
                              {log.changes && (
                                <div>
                                  <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Changes</h4>
                                  <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)]">
                                    {JSON.stringify(log.changes, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.metadata && (
                                <div>
                                  <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Metadata</h4>
                                  <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)]">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {!log.changes && !log.metadata && (
                                <p className="text-sm text-[var(--text-muted)]">No additional details available.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="text-sm text-[var(--text-muted)]">
                Page <span className="text-[var(--text-primary)] font-semibold">{page}</span> of{' '}
                <span className="text-[var(--text-primary)] font-semibold">{totalPages}</span>
                <span className="hidden sm:inline"> · {total} total</span>
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
