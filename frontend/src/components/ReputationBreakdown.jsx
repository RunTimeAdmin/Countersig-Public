import PropTypes from 'prop-types';

const categories = [
  { key: 'feeActivity', label: 'Fee Activity', max: 30, color: 'cyan' },
  { key: 'successRate', label: 'Success Rate', max: 25, color: 'emerald' },
  { key: 'age', label: 'Registration Age', max: 20, color: 'purple' },
  { key: 'saidTrust', label: 'SAID Trust', max: 15, color: 'amber' },
  { key: 'community', label: 'Community', max: 10, color: 'pink' },
];

const colorMap = {
  cyan: {
    bar: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
    glow: 'shadow-[0_0_10px_rgba(6,182,212,0.4)]',
    text: 'text-cyan-400',
  },
  emerald: {
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    text: 'text-emerald-400',
  },
  purple: {
    bar: 'bg-gradient-to-r from-violet-500 to-purple-400',
    glow: 'shadow-[0_0_10px_rgba(139,92,246,0.4)]',
    text: 'text-purple-400',
  },
  amber: {
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
    text: 'text-amber-400',
  },
  pink: {
    bar: 'bg-gradient-to-r from-pink-500 to-rose-400',
    glow: 'shadow-[0_0_10px_rgba(236,72,153,0.4)]',
    text: 'text-pink-400',
  },
};

function getScoreColor(score, max) {
  const percentage = score / max;
  if (percentage >= 0.8) return 'text-emerald-400';
  if (percentage >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

export default function ReputationBreakdown({ breakdown }) {
  // Handle nested object shape: { feeActivity: { score: N, max: M }, ... }
  const getScore = (value) => {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && 'score' in value) return value.score;
    return 0;
  };
  
  const getMax = (value, defaultMax) => {
    if (value && typeof value === 'object' && 'max' in value) return value.max;
    return defaultMax;
  };
  
  const totalScore = Object.values(breakdown || {}).reduce((a, b) => a + getScore(b), 0);
  const maxScore = categories.reduce((a, c) => a + c.max, 0);
  
  const getLabel = (score) => {
    if (score >= 80) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    if (score >= 40) return 'LOW';
    return 'NEW AGENT';
  };

  return (
    <div className="glass rounded-2xl p-6 border border-[var(--border-subtle)]">
      {/* Header with total score */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Reputation Breakdown</h3>
          <p className="text-sm text-[var(--text-muted)]">5-factor scoring system</p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${getScoreColor(totalScore, maxScore)}`}>
            {totalScore}
            <span className="text-lg text-[var(--text-muted)] font-normal">/{maxScore}</span>
          </div>
          <div className={`text-xs font-bold tracking-wider uppercase ${getScoreColor(totalScore, maxScore)}`}>
            {getLabel(totalScore)}
          </div>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const value = breakdown?.[cat.key] || 0;
          const score = getScore(value);
          const max = getMax(value, cat.max);
          const percentage = Math.min(100, (score / max) * 100);
          const colors = colorMap[cat.color];
          
          return (
            <div key={cat.key} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-secondary)]">{cat.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">({max})</span>
                </div>
                <span className={`text-sm font-semibold ${colors.text}`}>
                  {score}/{max}
                </span>
              </div>
              
              {/* Progress bar background */}
              <div className="h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                {/* Progress bar fill */}
                <div
                  className={`
                    h-full rounded-full transition-all duration-700 ease-out
                    ${colors.bar} ${percentage > 0 ? colors.glow : ''}
                  `}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-center gap-6 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>High (80%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Medium (50-79%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span>Low (&lt;50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

ReputationBreakdown.propTypes = {
  breakdown: PropTypes.shape({
    feeActivity: PropTypes.oneOfType([PropTypes.number, PropTypes.shape({ score: PropTypes.number, max: PropTypes.number })]),
    successRate: PropTypes.oneOfType([PropTypes.number, PropTypes.shape({ score: PropTypes.number, max: PropTypes.number })]),
    age: PropTypes.oneOfType([PropTypes.number, PropTypes.shape({ score: PropTypes.number, max: PropTypes.number })]),
    saidTrust: PropTypes.oneOfType([PropTypes.number, PropTypes.shape({ score: PropTypes.number, max: PropTypes.number })]),
    community: PropTypes.oneOfType([PropTypes.number, PropTypes.shape({ score: PropTypes.number, max: PropTypes.number })]),
  }),
};

ReputationBreakdown.defaultProps = {
  breakdown: {
    feeActivity: { score: 0, max: 30 },
    successRate: { score: 0, max: 25 },
    age: { score: 0, max: 20 },
    saidTrust: { score: 0, max: 15 },
    community: { score: 0, max: 10 },
  },
};
