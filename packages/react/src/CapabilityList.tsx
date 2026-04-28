import React, { useEffect, useState } from 'react';

export interface CapabilityListProps {
  /** AgentID agent identifier (fetches capabilities from API) */
  agentId?: string;
  /** Capabilities array (skips API call if provided) */
  capabilities?: string[];
  /** AgentID API base URL */
  apiUrl?: string;
  /** Visual theme */
  theme?: 'light' | 'dark';
  /** Show "Capabilities" label above the list */
  showLabel?: boolean;
  /** Maximum number of capabilities to display before showing "+N more" */
  maxDisplay?: number;
  /** Custom CSS class */
  className?: string;
}

const CAPABILITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'bags.swap': { bg: 'rgba(6, 182, 212, 0.1)', text: '#06b6d4', border: 'rgba(6, 182, 212, 0.3)' },
  'bags.fee': { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  'bags.launch': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  'bags.trade': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  'bags.analytics': { bg: 'rgba(236, 72, 153, 0.1)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
  'infra': { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' }
};

const DEFAULT_COLOR = { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b', border: 'rgba(100, 116, 139, 0.3)' };

function getCapabilityStyle(capability: string): { bg: string; text: string; border: string } {
  const prefix = capability.split('.')[0];
  const category = capability.split('.')[1];

  if (prefix === 'bags' && category) {
    return CAPABILITY_COLORS[`bags.${category}`] || DEFAULT_COLOR;
  }
  if (prefix === 'infra') {
    return CAPABILITY_COLORS.infra;
  }
  return DEFAULT_COLOR;
}

function CapabilityIcon({ capability, color, size }: { capability: string; color: string; size: number }) {
  const props = {
    width: size,
    height: size,
    fill: 'none',
    stroke: color,
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  if (capability.includes('swap')) {
    return (
      <svg {...props}>
        <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
  }
  if (capability.includes('fee')) {
    return (
      <svg {...props}>
        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (capability.includes('launch')) {
    return (
      <svg {...props}>
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (capability.includes('trade')) {
    return (
      <svg {...props}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (capability.includes('analytics')) {
    return (
      <svg {...props}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  // Default bolt icon
  return (
    <svg {...props}>
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export const CapabilityList: React.FC<CapabilityListProps> = ({
  agentId,
  capabilities: propCapabilities,
  apiUrl = 'https://api.agentidapp.com',
  theme = 'light',
  showLabel = true,
  maxDisplay,
  className = ''
}) => {
  const [fetchedCaps, setFetchedCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (propCapabilities || !agentId) return;
    let cancelled = false;
    async function fetchCapabilities() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${apiUrl}/badge/${agentId}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setFetchedCaps(data.capabilities || []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCapabilities();
    return () => { cancelled = true; };
  }, [agentId, apiUrl, propCapabilities]);

  const capabilities = propCapabilities || fetchedCaps;

  if (loading) {
    return (
      <div style={{
        fontSize: '13px',
        color: isDark ? '#666' : '#999',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Loading capabilities...
      </div>
    );
  }

  if (error && !capabilities.length) {
    return (
      <div style={{
        fontSize: '13px',
        color: isDark ? '#666' : '#999',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Capabilities unavailable
      </div>
    );
  }

  if (!capabilities || capabilities.length === 0) {
    return (
      <div style={{
        fontSize: '13px',
        color: isDark ? '#666' : '#999',
        fontStyle: 'italic',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        No capabilities declared
      </div>
    );
  }

  const displayCaps = maxDisplay ? capabilities.slice(0, maxDisplay) : capabilities;
  const overflow = maxDisplay ? Math.max(0, capabilities.length - maxDisplay) : 0;

  const containerStyle: React.CSSProperties = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: isDark ? '#888' : '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px'
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px'
  };

  const tagStyle = (cap: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'monospace',
    border: `1px solid ${getCapabilityStyle(cap).border}`,
    backgroundColor: getCapabilityStyle(cap).bg,
    color: getCapabilityStyle(cap).text,
    cursor: 'default',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
  });

  const overflowStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    color: isDark ? '#888' : '#666',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`
  };

  return (
    <div style={containerStyle} className={className}>
      {showLabel && <div style={labelStyle}>Capabilities</div>}
      <div style={listStyle}>
        {displayCaps.map((cap, index) => {
          const style = getCapabilityStyle(cap);
          return (
            <span key={`${cap}-${index}`} style={tagStyle(cap)} title={cap}>
              <CapabilityIcon capability={cap} color={style.text} size={14} />
              {cap}
            </span>
          );
        })}
        {overflow > 0 && (
          <span style={overflowStyle}>+{overflow} more</span>
        )}
      </div>
    </div>
  );
};
