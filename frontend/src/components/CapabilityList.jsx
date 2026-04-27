import PropTypes from 'prop-types';

const capabilityColors = {
  'bags.swap': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  'bags.fee': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'bags.launch': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'bags.trade': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'bags.analytics': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  'infra': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'default': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

function getCapabilityStyle(capability) {
  const prefix = capability.split('.')[0];
  const category = capability.split('.')[1];
  
  if (prefix === 'bags' && category) {
    return capabilityColors[`bags.${category}`] || capabilityColors.default;
  }
  if (prefix === 'infra') {
    return capabilityColors.infra;
  }
  return capabilityColors.default;
}

function getCapabilityIcon(capability) {
  if (capability.includes('swap')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
  }
  if (capability.includes('fee')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (capability.includes('launch')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (capability.includes('trade')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (capability.includes('analytics')) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export default function CapabilityList({ capabilities = [], showLabel = true }) {
  if (!capabilities || capabilities.length === 0) {
    return (
      <div className="text-sm text-[var(--text-muted)] italic">
        No capabilities declared
      </div>
    );
  }

  return (
    <div>
      {showLabel && (
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Capabilities
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {capabilities.map((capability, index) => (
          <span
            key={`${capability}-${index}`}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 
              rounded-lg text-xs font-medium
              border transition-all duration-200
              hover:scale-105 hover:shadow-lg
              ${getCapabilityStyle(capability)}
            `}
            title={capability}
          >
            {getCapabilityIcon(capability)}
            <span className="font-mono">{capability}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

CapabilityList.propTypes = {
  capabilities: PropTypes.arrayOf(PropTypes.string),
  showLabel: PropTypes.bool,
};
