import React, { useEffect, useState } from 'react';

export interface TrustBadgeProps {
  /** AgentID agent identifier */
  agentId: string;
  /** AgentID API base URL */
  apiUrl?: string;
  /** Visual theme */
  theme?: 'light' | 'dark';
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Show reputation score */
  showScore?: boolean;
  /** Show chain type indicator */
  showChain?: boolean;
  /** Show total actions count */
  showActions?: boolean;
  /** Show registration date */
  showDate?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

interface BadgeData {
  agentId: string;
  name: string;
  pubkey: string;
  status: string;
  badge: string;
  label: string;
  tier: string;
  tierColor: string;
  score: number;
  capabilities: string[];
  registeredAt: string;
  lastVerified?: string;
  revokedAt?: string;
  totalActions: number;
  successRate: number;
  tokenMint?: string;
  widgetUrl: string;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  verified: {
    bg: '#2e251a',
    border: '#FFD700',
    text: '#FFD700',
    glow: '0 0 25px rgba(255, 215, 0, 0.25)'
  },
  standard: {
    bg: '#1a252e',
    border: '#3B82F6',
    text: '#3B82F6',
    glow: '0 0 20px rgba(59, 130, 246, 0.2)'
  },
  unverified: {
    bg: '#2e2a1a',
    border: '#f59e0b',
    text: '#f59e0b',
    glow: '0 0 20px rgba(245, 158, 11, 0.15)'
  },
  flagged: {
    bg: '#2e1a1a',
    border: '#ef4444',
    text: '#ef4444',
    glow: '0 0 20px rgba(239, 68, 68, 0.2)'
  },
  revoked: {
    bg: '#1a1a1a',
    border: '#6b7280',
    text: '#6b7280',
    glow: 'none'
  }
};

const SIZES: Record<string, { padding: string; fontSize: string; iconSize: number; scoreFontSize: string }> = {
  sm: { padding: '8px 12px', fontSize: '12px', iconSize: 20, scoreFontSize: '16px' },
  md: { padding: '12px 16px', fontSize: '14px', iconSize: 28, scoreFontSize: '22px' },
  lg: { padding: '16px 20px', fontSize: '16px', iconSize: 36, scoreFontSize: '28px' }
};

function getTierKey(status: string, tier: string): string {
  if (status === 'revoked') return 'revoked';
  if (status === 'flagged') return 'flagged';
  if (status === 'verified' && tier === 'verified') return 'verified';
  if (status === 'verified') return 'standard';
  return 'unverified';
}

function getChainLabel(chainType?: string): string {
  if (!chainType) return '';
  const labels: Record<string, string> = {
    'solana-bags': 'SOL/BAGS',
    'solana': 'SOL',
    'ethereum': 'ETH',
    'base': 'BASE',
    'polygon': 'MATIC'
  };
  return labels[chainType] || chainType.toUpperCase();
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusIcon({ status, color, size }: { status: string; color: string; size: number }) {
  if (status === 'verified') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
          stroke={color}
          strokeWidth="2"
          fill={color}
          fillOpacity="0.15"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'flagged' || status === 'revoked') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
          stroke={color}
          strokeWidth="2"
          fill={color}
          fillOpacity="0.15"
        />
        <path
          d="M12 9v4m0 4h.01"
          stroke={status === 'revoked' ? '#6b7280' : '#dc2626'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Unverified
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        stroke={color}
        strokeWidth="2"
        fill={color}
        fillOpacity="0.1"
      />
      <path
        d="M12 9v4m0 4h.01"
        stroke="#6b7280"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  agentId,
  apiUrl = 'https://api.agentidapp.com',
  theme = 'light',
  size = 'md',
  showScore = true,
  showChain = true,
  showActions = false,
  showDate = false,
  className = '',
  onClick
}) => {
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchBadge() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${apiUrl}/badge/${agentId}`);
        if (!res.ok) throw new Error(`Badge fetch failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setBadge(data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBadge();
    return () => { cancelled = true; };
  }, [agentId, apiUrl]);

  const isDark = theme === 'dark';
  const sizeConfig = SIZES[size];

  if (loading) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: sizeConfig.padding,
        fontSize: sizeConfig.fontSize,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#999',
        borderRadius: '12px',
        border: '1px solid #333'
      }}>
        <span style={{ animation: 'pulse 1.5s infinite' }}>Loading...</span>
      </div>
    );
  }

  if (error || !badge) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: sizeConfig.padding,
        fontSize: sizeConfig.fontSize,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#999',
        borderRadius: '12px',
        border: '1px solid #444'
      }}>
        Badge unavailable
      </div>
    );
  }

  const tierKey = getTierKey(badge.status, badge.tier);
  const colors = TIER_COLORS[tierKey] || TIER_COLORS.unverified;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '12px',
    border: `1.5px solid ${isDark ? colors.border : colors.border}`,
    backgroundColor: isDark ? colors.bg : (tierKey === 'verified' ? '#FFF8E1' : tierKey === 'standard' ? '#E3F2FD' : tierKey === 'flagged' ? '#FFEBEE' : '#F5F5F5'),
    boxShadow: isDark ? colors.glow : 'none',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    padding: sizeConfig.padding
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  };

  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    backgroundColor: isDark ? `${colors.border}20` : `${colors.border}15`,
    padding: '6px'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: size === 'sm' ? '10px' : '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    color: isDark ? colors.text : colors.text
  };

  const nameStyle: React.CSSProperties = {
    fontSize: sizeConfig.fontSize,
    fontWeight: 600,
    color: isDark ? '#ffffff' : '#1a1a2e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: sizeConfig.scoreFontSize,
    fontWeight: 700,
    color: isDark ? colors.text : colors.text,
    lineHeight: 1
  };

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: isDark
      ? 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)'
      : 'linear-gradient(to right, transparent, rgba(0,0,0,0.1), transparent)',
    margin: '8px 0'
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: isDark ? '#888' : '#666'
  };

  const tierLabel = badge.tier === 'verified' ? '★ VERIFIED' : badge.status === 'verified' ? 'TRUSTED' : badge.label;

  return (
    <div style={containerStyle} className={className} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div style={innerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={iconContainerStyle}>
            <StatusIcon status={badge.status} color={colors.text} size={sizeConfig.iconSize} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={labelStyle}>{tierLabel}</div>
            {badge.name && <div style={nameStyle}>{badge.name}</div>}
          </div>
          {showScore && (
            <div style={{ textAlign: 'right' }}>
              <div style={scoreStyle}>
                {badge.score}
                <span style={{ fontSize: size === 'sm' ? '10px' : '12px', fontWeight: 400, color: isDark ? '#888' : '#999' }}>/100</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={dividerStyle} />

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Bags Ecosystem</span>
            {showChain && badge.tokenMint && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}>
                {getChainLabel()}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showDate && (
              <span>{formatDate(badge.registeredAt)}</span>
            )}
            {showActions && (
              <span>{badge.totalActions.toLocaleString()} actions</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
