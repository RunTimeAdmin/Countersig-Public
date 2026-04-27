import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// NOTE: The widget intentionally uses its own axios instance (not the shared lib/api.js)
// because it's built as a standalone bundle for iframe embedding and cannot share imports
// with the main app.
const API_BASE_URL = window.__AGENTID_API_URL__ || import.meta.env.VITE_AGENTID_API_URL || 'https://agentid.provenanceai.network';
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const statusConfig = {
  verified: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    label: 'VERIFIED AGENT',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    glowClass: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    textColor: 'text-emerald-400',
  },
  unverified: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    label: 'UNVERIFIED',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    glowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.12)]',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    textColor: 'text-amber-400',
  },
  flagged: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'FLAGGED',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    glowClass: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    textColor: 'text-red-400',
  },
};

function Widget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract pubkey from URL path: /widget/:pubkey
  const getPubkey = useCallback(() => {
    const path = window.location.pathname;
    const match = path.match(/\/widget\/([^/]+)/);
    return match ? match[1] : null;
  }, []);

  const fetchBadgeData = useCallback(async () => {
    const pubkey = getPubkey();
    if (!pubkey) {
      setError('Invalid widget URL');
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/badge/${pubkey}`);
      setData(response.data);
      setError(null);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Agent not found');
      } else {
        setError('Failed to load badge');
      }
    } finally {
      setLoading(false);
    }
  }, [getPubkey]);

  useEffect(() => {
    fetchBadgeData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchBadgeData, 60000);
    return () => clearInterval(interval);
  }, [fetchBadgeData]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full h-full min-h-[80px] bg-slate-900/80 rounded-lg border border-slate-700/50 p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-700/50" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-slate-700/50 rounded" />
            <div className="h-4 w-32 bg-slate-700/50 rounded" />
          </div>
          <div className="h-6 w-12 bg-slate-700/50 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-full min-h-[80px] bg-slate-900/90 rounded-lg border border-red-500/30 p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-red-500/20 flex items-center justify-center text-red-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider">Error</div>
          <div className="text-sm text-slate-300">{error}</div>
        </div>
      </div>
    );
  }

  const status = data?.status || 'unverified';
  const config = statusConfig[status] || statusConfig.unverified;

  return (
    <div
      className={`
        w-full h-full min-h-[80px] rounded-lg border p-3
        ${config.bgClass} ${config.borderClass} ${config.glowClass}
        transition-all duration-300
      `}
    >
      <div className="flex items-center gap-3 h-full">
        {/* Status Icon */}
        <div className={`w-8 h-8 rounded-md ${config.iconBg} flex items-center justify-center ${config.iconColor} flex-shrink-0`}>
          {config.icon}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Status Label */}
          <div className={`text-[10px] font-bold tracking-wider ${config.textColor} uppercase`}>
            {config.label}
          </div>
          
          {/* Agent Name */}
          <div className="text-sm font-semibold text-slate-100 truncate">
            {data?.name || 'Unknown Agent'}
          </div>

          {/* Meta Row */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Bags
            </span>
            {(data?.registeredAt || data?.registered_at) && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(data?.registeredAt || data?.registered_at)}
              </span>
            )}
            {(data?.totalActions ?? data?.total_actions) !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {(data?.totalActions ?? data?.total_actions).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        {(data?.score ?? data?.bags_score) !== undefined && (
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-bold text-slate-100 leading-none">
              {data?.score ?? data?.bags_score}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">/100</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Widget;
