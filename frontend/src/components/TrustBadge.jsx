import PropTypes from 'prop-types';

// Premium Shield Badge Icon with AgentID branding
function VerifiedShieldIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer shield with gradient */}
      <defs>
        <linearGradient id="shieldGradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="shieldInnerGradient" x1="12" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Shield outline */}
      <path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        stroke="url(#shieldGradient)"
        strokeWidth="2"
        fill="url(#shieldInnerGradient)"
        fillOpacity="0.15"
      />
      {/* Inner shield highlight */}
      <path
        d="M12 4L6 6.5v4.59c0 3.79 2.56 7.32 6 8.41 3.44-1.09 6-4.62 6-8.41V6.5l-6-2.5z"
        fill="url(#shieldInnerGradient)"
        fillOpacity="0.3"
      />
      {/* Checkmark */}
      <path
        d="M9 12l2 2 4-4"
        stroke="#059669"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Sparkle accents */}
      <circle cx="17" cy="7" r="1" fill="#fbbf24" />
      <circle cx="19" cy="9" r="0.5" fill="#fbbf24" />
    </svg>
  );
}

// Unverified warning icon
function UnverifiedIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        stroke="#9ca3af"
        strokeWidth="2"
        fill="#9ca3af"
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

// Flagged warning icon
function FlaggedIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        stroke="#ef4444"
        strokeWidth="2"
        fill="#ef4444"
        fillOpacity="0.15"
      />
      <path
        d="M12 8v4m0 4h.01"
        stroke="#dc2626"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const statusConfig = {
  verified: {
    icon: <VerifiedShieldIcon className="w-6 h-6" />,
    label: 'VERIFIED AGENT',
    bgClass: 'status-verified',
    glowClass: 'shadow-[0_0_25px_rgba(251,191,36,0.25)]',
    iconBg: 'bg-gradient-to-br from-amber-400/20 to-yellow-500/20',
    iconColor: 'text-amber-500',
  },
  unverified: {
    icon: <UnverifiedIcon className="w-6 h-6" />,
    label: 'UNVERIFIED',
    bgClass: 'status-unverified',
    glowClass: 'shadow-[0_0_20px_rgba(156,163,175,0.15)]',
    iconBg: 'bg-gray-500/20',
    iconColor: 'text-gray-500',
  },
  flagged: {
    icon: <FlaggedIcon className="w-6 h-6" />,
    label: 'FLAGGED',
    bgClass: 'status-flagged',
    glowClass: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-500',
  },
};

// Tier configuration for verified agents
const tierConfig = {
  verified: {
    label: 'VERIFIED',
    badge: '★',
    bgClass: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
    borderClass: 'border-yellow-500/50',
    glowClass: 'shadow-[0_0_30px_rgba(255,215,0,0.3)]',
    textClass: 'text-yellow-400',
    iconBg: 'bg-yellow-500/20',
    iconColor: 'text-yellow-400',
    shimmer: true,
  },
  standard: {
    label: 'TRUSTED',
    badge: '',
    bgClass: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
    borderClass: 'border-blue-500/50',
    glowClass: 'shadow-[0_0_20px_rgba(59,130,246,0.2)]',
    textClass: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    shimmer: false,
  },
};

export default function TrustBadge({ 
  status = 'unverified', 
  name, 
  score, 
  registeredAt, 
  totalActions,
  tier,
  tierColor,
  className = '' 
}) {
  const config = statusConfig[status] || statusConfig.unverified;
  
  // Determine tier styling for verified agents
  const isVerified = status === 'verified';
  const tierStyle = isVerified && tier === 'verified' ? tierConfig.verified : 
                    isVerified ? tierConfig.standard : null;
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Never';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Use tier styling if verified, otherwise use status styling
  const bgClass = tierStyle ? tierStyle.bgClass : config.bgClass;
  const glowClass = tierStyle ? tierStyle.glowClass : config.glowClass;
  const borderClass = tierStyle ? tierStyle.borderClass : '';
  const iconBg = tierStyle ? tierStyle.iconBg : config.iconBg;
  const iconColor = tierStyle ? tierStyle.iconColor : config.iconColor;
  const tierLabel = tierStyle ? `${tierStyle.badge} ${tierStyle.label}` : config.label;

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl border
        ${bgClass} ${glowClass} ${borderClass}
        transition-all duration-300 hover:scale-[1.02]
        ${className}
      `}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Gold shimmer effect for verified tier */}
      {tierStyle?.shimmer && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-shimmer" 
               style={{ transform: 'translateX(-100%)', animation: 'shimmer 2s infinite' }} />
        </div>
      )}
      
      <div className="relative p-4">
        {/* Header: Icon + Status Label */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold tracking-wider ${iconColor}`}>
              {tierLabel}
            </div>
            {name && (
              <div className="text-[var(--text-primary)] font-semibold truncate text-lg">
                {name}
              </div>
            )}
          </div>
          {score !== undefined && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${tierStyle ? tierStyle.textClass : 'text-[var(--text-primary)]'}`}>
                {score}
                <span className="text-sm font-normal text-[var(--text-muted)]">/100</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent my-3" />

        {/* Footer: Meta info */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Bags Ecosystem
            </span>
          </div>
          <div className="flex items-center gap-3">
            {registeredAt && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(registeredAt)}
              </span>
            )}
            {totalActions !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {totalActions.toLocaleString()} actions
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

TrustBadge.propTypes = {
  status: PropTypes.oneOf(['verified', 'unverified', 'flagged']),
  name: PropTypes.string,
  score: PropTypes.number,
  registeredAt: PropTypes.string,
  totalActions: PropTypes.number,
  tier: PropTypes.oneOf(['verified', 'standard']),
  tierColor: PropTypes.string,
  className: PropTypes.string,
};
