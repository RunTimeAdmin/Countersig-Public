import React, { useEffect, useState } from 'react';

export interface ReputationBreakdownProps {
  /** Countersig agent identifier (fetches reputation from API) */
  agentId?: string;
  /** Pre-fetched breakdown data (skips API call if provided) */
  breakdown?: Record<string, number | { score: number; max: number }>;
  /** Countersig API base URL */
  apiUrl?: string;
  /** Visual theme */
  theme?: 'light' | 'dark';
  /** Show the overall score header */
  showHeader?: boolean;
  /** Show the legend */
  showLegend?: boolean;
  /** Custom CSS class */
  className?: string;
}

interface ReputationData {
  agentId: string;
  score: number;
  label: string;
  breakdown: Record<string, number | { score: number; max: number }>;
}

const CATEGORIES = [
  { key: 'feeActivity', label: 'Fee Activity', max: 30, color: '#06b6d4' },
  { key: 'successRate', label: 'Success Rate', max: 25, color: '#10b981' },
  { key: 'age', label: 'Registration Age', max: 20, color: '#8b5cf6' },
  { key: 'saidTrust', label: 'SAID Trust', max: 15, color: '#f59e0b' },
  { key: 'community', label: 'Community', max: 10, color: '#ec4899' }
];

function getScore(value: number | { score: number; max: number } | undefined, fallback: number): number {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'score' in value) return value.score;
  return fallback;
}

function getMax(value: number | { score: number; max: number } | undefined, fallback: number): number {
  if (typeof value === 'object' && value !== null && 'max' in value) return value.max;
  return fallback;
}

function getScoreColor(percentage: number): string {
  if (percentage >= 0.8) return '#10b981';
  if (percentage >= 0.5) return '#f59e0b';
  return '#ef4444';
}

function getLabel(score: number): string {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 40) return 'LOW';
  return 'NEW AGENT';
}

export const ReputationBreakdown: React.FC<ReputationBreakdownProps> = ({
  agentId,
  breakdown: propBreakdown,
  apiUrl = 'https://api.countersig.com',
  theme = 'light',
  showHeader = true,
  showLegend = true,
  className = ''
}) => {
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (propBreakdown || !agentId) return;
    let cancelled = false;
    async function fetchReputation() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${apiUrl}/reputation/${agentId}`);
        if (!res.ok) throw new Error(`Reputation fetch failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setReputation(data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchReputation();
    return () => { cancelled = true; };
  }, [agentId, apiUrl, propBreakdown]);

  const breakdown = propBreakdown || reputation?.breakdown;
  const totalScore = breakdown
    ? Object.values(breakdown).reduce((a, b) => a + getScore(b, 0), 0)
    : 0;
  const maxScore = CATEGORIES.reduce((a, c) => a + c.max, 0);
  const label = reputation?.label || getLabel(totalScore);

  const containerStyle: React.CSSProperties = {
    borderRadius: '16px',
    padding: '24px',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    backgroundColor: isDark ? 'rgba(20, 20, 30, 0.8)' : '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)'
  };

  const headerContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: isDark ? '#ffffff' : '#1a1a2e',
    margin: 0
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: isDark ? '#888' : '#666',
    marginTop: '2px'
  };

  const scoreNumberStyle: React.CSSProperties = {
    fontSize: '36px',
    fontWeight: 700,
    color: getScoreColor(totalScore / maxScore),
    lineHeight: 1
  };

  const scoreMaxStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 400,
    color: isDark ? '#888' : '#999'
  };

  const labelBadgeStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: getScoreColor(totalScore / maxScore)
  };

  const barGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  };

  const barRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px'
  };

  const barLabelStyle: React.CSSProperties = {
    fontSize: '13px',
    color: isDark ? '#ccc' : '#555'
  };

  const barMaxStyle: React.CSSProperties = {
    fontSize: '11px',
    color: isDark ? '#666' : '#999',
    marginLeft: '4px'
  };

  const barValueStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600
  };

  const barTrackStyle: React.CSSProperties = {
    height: '10px',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    borderRadius: '5px',
    overflow: 'hidden'
  };

  const legendDividerStyle: React.CSSProperties = {
    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    marginTop: '24px',
    paddingTop: '16px'
  };

  const legendStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    fontSize: '11px',
    color: isDark ? '#888' : '#666'
  };

  const legendDotStyle = (color: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
    display: 'inline-block',
    marginRight: '6px'
  });

  if (loading) {
    return (
      <div style={{ ...containerStyle, color: isDark ? '#666' : '#999', textAlign: 'center' as const }}>
        Loading reputation...
      </div>
    );
  }

  if (error && !breakdown) {
    return (
      <div style={{ ...containerStyle, color: isDark ? '#666' : '#999', textAlign: 'center' as const }}>
        Reputation unavailable
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      {showHeader && (
        <div style={headerContainerStyle}>
          <div>
            <h3 style={titleStyle}>Reputation Breakdown</h3>
            <p style={subtitleStyle}>5-factor scoring system</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={scoreNumberStyle}>
              {totalScore}
              <span style={scoreMaxStyle}>/{maxScore}</span>
            </div>
            <div style={labelBadgeStyle}>{label}</div>
          </div>
        </div>
      )}

      {/* Score bars */}
      <div style={barGroupStyle}>
        {CATEGORIES.map((cat) => {
          const value = breakdown?.[cat.key];
          const score = getScore(value, 0);
          const max = getMax(value, cat.max);
          const percentage = Math.min(100, (score / max) * 100);

          return (
            <div key={cat.key}>
              <div style={barRowStyle}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={barLabelStyle}>{cat.label}</span>
                  <span style={barMaxStyle}>({max})</span>
                </div>
                <span style={{ ...barValueStyle, color: cat.color }}>
                  {score}/{max}
                </span>
              </div>
              <div style={barTrackStyle}>
                <div style={{
                  height: '100%',
                  borderRadius: '5px',
                  width: `${percentage}%`,
                  backgroundColor: cat.color,
                  transition: 'width 0.7s ease-out',
                  boxShadow: percentage > 0 ? `0 0 8px ${cat.color}66` : 'none'
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={legendDividerStyle}>
          <div style={legendStyle}>
            <span><span style={legendDotStyle('#10b981')} />High (80%+)</span>
            <span><span style={legendDotStyle('#f59e0b')} />Medium (50-79%)</span>
            <span><span style={legendDotStyle('#ef4444')} />Low (&lt;50%)</span>
          </div>
        </div>
      )}
    </div>
  );
};
