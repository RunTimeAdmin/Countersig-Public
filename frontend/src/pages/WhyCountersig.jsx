import { Link } from 'react-router-dom';

/* ── SVG Icon Components ── */
const LinkChainIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ClipboardCheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const StarIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const SwitchIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const CpuChipIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const CodeBracketIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const BuildingOfficeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);

const PuzzlePieceIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875S10.5 3.09 10.5 4.125c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.42 48.42 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
  </svg>
);

const FingerPrintIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
  </svg>
);

const CommandLineIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const ServerIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const SparklesIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ShieldCheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ArrowRightIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/* ── Data ── */
const scenarioCards = [
  {
    Icon: LinkChainIcon,
    color: 'cyan',
    title: 'Agent-to-Agent Communication',
    without: "Can't verify caller — trust blindly or block everything",
    withId: 'Cryptographic identity verification in milliseconds',
  },
  {
    Icon: ClipboardCheckIcon,
    color: 'purple',
    title: 'Enterprise Compliance',
    without: 'No audit trail, compliance failure',
    withId: 'Hash-chained logs, verifiable identity for every agent',
  },
  {
    Icon: StarIcon,
    color: 'amber',
    title: 'Marketplace Trust',
    without: 'Star ratings easily gamed',
    withId: 'Objective reputation scores from real performance data',
  },
  {
    Icon: SwitchIcon,
    color: 'emerald',
    title: 'Multi-Chain Operations',
    without: 'Separate credentials per platform',
    withId: 'One identity across all chains and platforms',
  },
  {
    Icon: CpuChipIcon,
    color: 'cyan',
    title: 'Autonomous Accountability',
    without: 'Black box, no forensics',
    withId: 'Complete attestation history, reputation impact',
  },
];

const audienceCards = [
  {
    Icon: CodeBracketIcon,
    color: 'cyan',
    title: 'Agent Developers',
    items: [
      'Register your agent once, get a cryptographic identity',
      'Build reputation through successful actions',
      'Earn trust badges that prove reliability',
      'Enable A2A communication with short-lived JWT tokens',
    ],
  },
  {
    Icon: BuildingOfficeIcon,
    color: 'purple',
    title: 'Enterprise Teams',
    items: [
      'Organizational RBAC (admin / manager / member)',
      'Hash-chained audit logs for compliance',
      'Policy engine controlling agent behavior',
      'Webhook notifications & OAuth2 / Entra ID',
    ],
  },
  {
    Icon: PuzzlePieceIcon,
    color: 'emerald',
    title: 'Platform Builders',
    items: [
      'Embed trust badges in your marketplace (SVG / JSON)',
      'Query reputation scores via API',
      'Verify agent identity with a single call',
      'Rate-limit by identity instead of IP',
    ],
  },
  {
    Icon: FingerPrintIcon,
    color: 'amber',
    title: 'The Agents Themselves',
    items: [
      'Prove identity to other agents cryptographically',
      'Issue and verify 60-second A2A tokens',
      'Build portable reputation across platforms',
      'Export W3C Verifiable Credentials as proof',
    ],
  },
];

const capabilities = [
  ['Cryptographic Identity', 'Ed25519 keypair registration with challenge-response verification'],
  ['Multi-Auth Support', 'Ed25519 wallets, OAuth2/OIDC, Microsoft Entra ID, API keys'],
  ['Reputation System', 'BAGS score: Behavior, Activity, Governance, Security — earned through real actions'],
  ['Verifiable Credentials', 'W3C standard VCs proving agent identity, status, and capabilities'],
  ['Trust Badges', 'Embeddable SVG / JSON badges showing verification status and reputation tier'],
  ['Agent-to-Agent Tokens', 'Short-lived JWTs (60 s) for secure inter-agent communication'],
  ['Audit Trail', 'Hash-chained action logs with tamper detection'],
  ['Organizations & RBAC', 'Multi-agent management with role-based access control'],
  ['Policy Engine', 'Configurable rules governing agent behavior and access'],
  ['Multi-Chain', 'Solana, Ethereum, Base, Polygon — one identity across chains'],
];

const integrations = [
  {
    Icon: CommandLineIcon,
    color: 'cyan',
    title: 'MCP Server',
    subtitle: 'Easiest — Zero Code',
    code: 'claude mcp add countersig -- npx -y @countersig/mcp',
    lang: 'bash',
    description: 'Claude gets 12 Countersig tools. Register, verify, attest, communicate — all through conversation.',
  },
  {
    Icon: CodeBracketIcon,
    color: 'purple',
    title: 'TypeScript SDK',
    subtitle: 'Full Control',
    code: `import { CountersigClient } from '@countersig/sdk';\nconst client = new CountersigClient({\n  baseUrl: 'https://api.countersig.com'\n});\nconst agents = await client.listAgents();`,
    lang: 'typescript',
    description: 'Type-safe client for Node.js and browser environments with full API coverage.',
  },
  {
    Icon: ServerIcon,
    color: 'emerald',
    title: 'REST API',
    subtitle: 'Any Language',
    code: `curl -H "Authorization: Bearer cs_xxx" \\\n  https://api.countersig.com/agents`,
    lang: 'bash',
    description: 'Standard REST endpoints accessible from any language or platform.',
  },
];

const colorMap = {
  cyan: { bg: 'bg-[var(--accent-cyan)]/10', text: 'text-[var(--accent-cyan)]', border: 'hover:border-[var(--accent-cyan)]/50' },
  purple: { bg: 'bg-[var(--accent-purple)]/10', text: 'text-[var(--accent-purple)]', border: 'hover:border-[var(--accent-purple)]/50' },
  emerald: { bg: 'bg-[var(--accent-emerald)]/10', text: 'text-[var(--accent-emerald)]', border: 'hover:border-[var(--accent-emerald)]/50' },
  amber: { bg: 'bg-[var(--accent-amber)]/10', text: 'text-[var(--accent-amber)]', border: 'hover:border-[var(--accent-amber)]/50' },
};

/* ── Page ── */
export default function WhyCountersig() {
  return (
    <div className="min-h-screen">
      {/* ═══ Hero ═══ */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent-cyan)]/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-purple)]/3 via-transparent to-[var(--accent-cyan)]/3 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-cyan)]/20 to-[var(--accent-purple)]/20 mb-8">
            <ShieldCheckIcon className="w-10 h-10 text-[var(--accent-cyan)]" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] mb-6 leading-tight">
            Why Does Your AI Agent <br className="hidden sm:block" />
            Need an <span className="gradient-text">Identity</span>?
          </h1>
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            AI agents are the only actors on the internet operating without verifiable identity.{' '}
            <span className="text-[var(--text-primary)] font-semibold">Countersig fixes that.</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
            >
              <SparklesIcon className="w-5 h-5" />
              Get Started Free
            </Link>
            <Link
              to="/guides"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--accent-cyan)]/50 transition-all duration-200"
            >
              See How It Works
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ Problem Section ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            What Happens <span className="gradient-text">Without</span> Agent Identity
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Five real scenarios where the absence of verifiable identity creates risk, friction, or failure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {scenarioCards.map((card) => {
            const c = colorMap[card.color];
            return (
              <div
                key={card.title}
                className={`glass rounded-2xl p-6 border border-[var(--border-subtle)] ${c.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-5`}>
                  <card.Icon className={`w-6 h-6 ${c.text}`} />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{card.title}</h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <XIcon />
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-red-400/80">Without identity</span>
                      <p className="text-sm text-[var(--text-secondary)] mt-0.5">{card.without}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckIcon />
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">With Countersig</span>
                      <p className="text-sm text-[var(--text-secondary)] mt-0.5">{card.withId}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ Who Needs This ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            Who Needs <span className="gradient-text">Countersig</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Whether you build agents, manage them, embed them, or are one — Countersig is for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {audienceCards.map((card) => {
            const c = colorMap[card.color];
            return (
              <div
                key={card.title}
                className={`glass rounded-2xl p-6 border border-[var(--border-subtle)] ${c.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <card.Icon className={`w-6 h-6 ${c.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{card.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {card.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                      <CheckIcon />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ Solution Table ═══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            The Countersig <span className="gradient-text">Solution</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Ten core capabilities that give your agent a complete, verifiable identity.
          </p>
        </div>

        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">Capability</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">What It Does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {capabilities.map(([cap, desc], i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-[var(--text-primary)] font-medium text-sm whitespace-nowrap">{cap}</td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ Integration Options ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            Integration <span className="gradient-text">Options</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Three ways to integrate — from zero-code to full control.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {integrations.map((item) => {
            const c = colorMap[item.color];
            return (
              <div
                key={item.title}
                className={`glass rounded-2xl border border-[var(--border-subtle)] ${c.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col`}
              >
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                      <item.Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{item.title}</h3>
                      <span className={`text-xs font-medium ${c.text}`}>{item.subtitle}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-3 mb-4">{item.description}</p>
                </div>
                <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30 rounded-b-2xl p-4">
                  <pre className="text-xs text-[var(--text-muted)] font-mono overflow-x-auto whitespace-pre leading-relaxed">
                    {item.code}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ Bottom CTA ═══ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="glass rounded-2xl border border-[var(--border-subtle)] p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-cyan)]/5 via-transparent to-[var(--accent-purple)]/5 pointer-events-none" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4">
              Ready to Give Your Agent an Identity?
            </h2>
            <p className="text-[var(--text-secondary)] max-w-lg mx-auto mb-8">
              Every human has identity. Every website has identity. It's time your AI agent did too.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
              >
                <SparklesIcon className="w-5 h-5" />
                Get Started Free
              </Link>
              <Link
                to="/guides"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--accent-cyan)]/50 transition-all duration-200"
              >
                Read the Docs
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--accent-cyan)]/50 transition-all duration-200"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
