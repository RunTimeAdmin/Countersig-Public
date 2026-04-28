import React from 'react';

export interface ChainBadgeProps {
  chainType: string;
  size?: 'sm' | 'md';
  theme?: 'light' | 'dark';
  className?: string;
}

const CHAIN_STYLES: Record<string, { color: string; label: string }> = {
  'solana-bags': { color: '#9945FF', label: 'Solana/BAGS' },
  'solana': { color: '#14F195', label: 'Solana' },
  'ethereum': { color: '#627EEA', label: 'Ethereum' },
  'base': { color: '#0052FF', label: 'Base' },
  'polygon': { color: '#8247E5', label: 'Polygon' }
};

export const ChainBadge: React.FC<ChainBadgeProps> = ({
  chainType,
  size = 'md',
  theme = 'light',
  className = ''
}) => {
  const chain = CHAIN_STYLES[chainType] || { color: '#888888', label: chainType };
  const isDark = theme === 'dark';
  const fontSize = size === 'sm' ? '11px' : '13px';
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const dotSize = size === 'sm' ? 6 : 8;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '12px',
        backgroundColor: isDark ? `${chain.color}22` : `${chain.color}15`,
        color: chain.color,
        border: `1px solid ${chain.color}40`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <span style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        backgroundColor: chain.color,
        flexShrink: 0
      }} />
      {chain.label}
    </span>
  );
};
