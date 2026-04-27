import { Link } from 'react-router-dom';

// Icons as inline SVG components for consistency
const ShieldCheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const KeyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const LockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const CheckBadgeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const DocumentTextIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ArrowPathIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ServerIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const CodeBracketIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const FingerPrintIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
  </svg>
);

const AcademicCapIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const ExternalLinkIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const SparklesIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// Severity badge component
function SeverityBadge({ level }) {
  const styles = {
    high: 'bg-red-500/15 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    standard: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[level] || styles.standard}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

// Status badge component
function StatusBadge({ status }) {
  const styles = {
    planned: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    mitigated: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'in-progress': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || styles.planned}`}>
      {status.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
    </span>
  );
}

export default function Security() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16 animate-fade-in">
        <div className="glass rounded-2xl p-8 md:p-12 border border-[var(--border-subtle)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-cyan)]/5 via-transparent to-[var(--accent-purple)]/5" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-cyan)]/20 to-[var(--accent-purple)]/20 mb-6">
              <ShieldCheckIcon className="w-10 h-10 text-[var(--accent-cyan)]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Security & Trust</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto mb-4">
              AgentID uses Ed25519 cryptographic signatures for mathematically certain proof of agent identity. 
              No private keys are ever transmitted or stored.
            </p>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl mx-auto mb-8">
              AgentID underwent a formal security audit. Critical findings have been resolved. Remaining items are documented below with planned timelines.
            </p>
            <div className="inline-flex items-center gap-3 glass rounded-xl px-6 py-3 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <AcademicCapIcon className="w-5 h-5 text-[var(--accent-cyan)]" />
                <span className="text-[var(--text-secondary)] text-sm">Security Audit</span>
              </div>
              <div className="h-4 w-px bg-[var(--border-default)]" />
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-400">B+</span>
                <div className="text-left">
                  <div className="text-xs text-[var(--text-muted)]">May 2025</div>
                  <div className="text-xs text-[var(--text-secondary)]">NinjaTech AI</div>
                  <div className="text-xs text-emerald-400">Rating reflects pre-fix assessment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Guarantee - 3 Column Cards */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">The Core Guarantee</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-cyan)]/10 flex items-center justify-center mb-4">
              <KeyIcon className="w-6 h-6 text-[var(--accent-cyan)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Private Keys Are Never Stored</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              AgentID never requests, receives, or stores private keys. Your Ed25519 private key remains exclusively on your infrastructure.
            </p>
          </div>
          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-purple)]/10 flex items-center justify-center mb-4">
              <LockIcon className="w-6 h-6 text-[var(--accent-purple)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Nothing Secret Leaves Your Server</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              Only your public key and cryptographic signature are transmitted. No sensitive operational data ever leaves your control.
            </p>
          </div>
          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-emerald)]/10 flex items-center justify-center mb-4">
              <CheckBadgeIcon className="w-6 h-6 text-[var(--accent-emerald)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Proof, Not Trust</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              Ed25519 signature verification provides mathematically certain proof of identity. No trust in intermediaries required.
            </p>
          </div>
        </div>
      </section>

      {/* How Verification Works - 4 Step Flow */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">How Verification Works</h2>
        <div className="glass rounded-2xl p-6 md:p-8 border border-[var(--border-subtle)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-cyan)]/20 flex items-center justify-center text-[var(--accent-cyan)] font-bold">1</div>
                <h3 className="font-semibold text-[var(--text-primary)]">Challenge Issuance</h3>
              </div>
              <p className="text-[var(--text-secondary)] text-sm mb-3">
                AgentID generates a random nonce and sends it to your agent with a 5-minute expiry window.
              </p>
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-3 font-mono">
                AGENTID-VERIFY:nonce:timestamp
              </div>
              <div className="hidden lg:block absolute top-8 -right-3 text-[var(--text-muted)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)] font-bold">2</div>
                <h3 className="font-semibold text-[var(--text-primary)]">Agent Signs</h3>
              </div>
              <p className="text-[var(--text-secondary)] text-sm mb-3">
                Your agent uses its private key to cryptographically sign the challenge message.
              </p>
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-3 font-mono">
                sign(challenge, privateKey)
              </div>
              <div className="hidden lg:block absolute top-8 -right-3 text-[var(--text-muted)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-emerald)]/20 flex items-center justify-center text-[var(--accent-emerald)] font-bold">3</div>
                <h3 className="font-semibold text-[var(--text-primary)]">AgentID Verifies</h3>
              </div>
              <p className="text-[var(--text-secondary)] text-sm mb-3">
                AgentID verifies the signature against your public key using Ed25519 verification.
              </p>
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-3 font-mono">
                verify(signature, pubkey)
              </div>
              <div className="hidden lg:block absolute top-8 -right-3 text-[var(--text-muted)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Step 4 */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber)]/20 flex items-center justify-center text-[var(--accent-amber)] font-bold">4</div>
                <h3 className="font-semibold text-[var(--text-primary)]">Nonce Consumed</h3>
              </div>
              <p className="text-[var(--text-secondary)] text-sm mb-3">
                The nonce is immediately deleted after use, making replay attacks impossible.
              </p>
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-3 font-mono">
                delete(nonce) // TTL 5min
              </div>
            </div>
          </div>

          {/* Attack Scenario Explanation */}
          <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
            <div className="flex items-start gap-3">
              <FingerPrintIcon className="w-5 h-5 text-[var(--accent-cyan)] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-[var(--text-primary)] mb-1">Attack Prevention</h4>
                <p className="text-[var(--text-secondary)] text-sm">
                  Even if an attacker intercepts the challenge and signature, they cannot reuse it. 
                  Each nonce is unique, time-bound, and destroyed after verification. 
                  Without the private key, no valid signature can be generated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Transparency */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Data Transparency</h2>
        <div className="glass rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">Data Type</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">Stored</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <tr>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <KeyIcon className="w-4 h-4 text-[var(--accent-cyan)]" />
                      <span className="text-[var(--text-primary)]">Public Key</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Yes</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">Your agent's Ed25519 public key (32 bytes)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="w-4 h-4 text-[var(--accent-purple)]" />
                      <span className="text-[var(--text-primary)]">Name & Description</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Yes</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">Self-asserted metadata you provide during registration</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CheckBadgeIcon className="w-4 h-4 text-[var(--accent-emerald)]" />
                      <span className="text-[var(--text-primary)]">Reputation Score</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Yes</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">Aggregated from Bags Network and verification history</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <LockIcon className="w-4 h-4 text-red-400" />
                      <span className="text-[var(--text-primary)]">Private Key</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Never</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">Never transmitted, never stored, never requested</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ServerIcon className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="text-[var(--text-primary)]">IP Address / Email</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Never</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">No PII is collected or stored</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-[var(--accent-amber)]" />
                      <span className="text-[var(--text-primary)]">Challenge Nonces</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Temporary</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">5-minute TTL, auto-deleted after use or expiry</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/30">
            <div className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
              <LockIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Server secrets (DATABASE_URL, REDIS_URL, BAGS_API_KEY) are never exposed to clients and are stored as encrypted environment variables.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Attack Protections - 2x2 Grid */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Attack Protections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ArrowPathIcon className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Replay Attack Prevention</h3>
                <span className="text-xs text-emerald-400 font-medium">Fully Mitigated</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Each challenge nonce is cryptographically random, single-use, and immediately deleted after verification. 
              Even if intercepted, signatures cannot be reused.
            </p>
          </div>

          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Time-Based Verification</h3>
                <span className="text-xs text-cyan-400 font-medium">5-Minute Window</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Challenges expire after 5 minutes. This limits the attack window and ensures freshness of each verification 
              while allowing reasonable time for network latency.
            </p>
          </div>

          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <ServerIcon className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Rate Limiting</h3>
                <span className="text-xs text-purple-400 font-medium">20 req / 15 min</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Authentication endpoints are rate-limited to 20 requests per 15 minutes per IP. 
              This prevents brute-force attacks and ensures service availability.
            </p>
          </div>

          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <CodeBracketIcon className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">XSS Prevention</h3>
                <span className="text-xs text-amber-400 font-medium">Input Sanitization</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              All user inputs are sanitized and HTML/XML-escaped before rendering. 
              Content Security Policy headers prevent inline script execution.
            </p>
          </div>
        </div>
      </section>

      {/* Resolved Security Findings */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4 text-center">Resolved Security Findings</h2>
        <p className="text-[var(--text-secondary)] text-center max-w-2xl mx-auto mb-8">
          Issues identified during audit that have been addressed
        </p>
        <div className="glass rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
          <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)]">
            {/* Flag Proof-of-Ownership */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4 border-l-4 border-l-emerald-500">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Flag Proof-of-Ownership</h3>
                  <StatusBadge status="resolved" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  Ed25519 signature verification required for all flag submissions. Reporters must prove they control 
                  their pubkey. 5-minute replay protection with timestamp validation.
                </p>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">Fixed</span>
              </div>
            </div>

            {/* Rate Limiter Upgrade */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4 border-l-4 border-l-emerald-500">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Rate Limiter Upgrade</h3>
                  <StatusBadge status="resolved" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  Stricter authLimiter middleware now applied to sensitive flag endpoints (vs defaultLimiter), 
                  providing enhanced protection against abuse.
                </p>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">Fixed</span>
              </div>
            </div>

            {/* Startup Validation */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4 border-l-4 border-l-emerald-500">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Startup Validation</h3>
                  <StatusBadge status="resolved" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  Server now validates all required environment variables at startup with clear error messages, 
                  preventing misconfiguration issues.
                </p>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">Fixed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Known Limitations & Roadmap */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Known Limitations & Roadmap</h2>
        <p className="text-[var(--text-secondary)] text-center max-w-2xl mx-auto mb-8">
          We believe in transparent security. Here are the known limitations we're actively addressing.
        </p>
        <div className="glass rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
          <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)]">
            {/* Self-Asserted Metadata */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Self-Asserted Metadata</h3>
                  <SeverityBadge level="medium" />
                  <StatusBadge status="planned" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  Agent names and descriptions are self-reported without verification. Planned solution: Social verification 
                  through attestations from trusted entities.
                </p>
              </div>
              <div className="text-sm text-[var(--text-muted)] whitespace-nowrap">Sprint 3</div>
            </div>

            {/* No Key Revocation */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">No Key Revocation</h3>
                  <SeverityBadge level="medium" />
                  <StatusBadge status="planned" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  Currently no mechanism to revoke compromised keys. Planned solution: Multi-signature recovery 
                  and key rotation workflows.
                </p>
              </div>
              <div className="text-sm text-[var(--text-muted)] whitespace-nowrap">Sprint 3</div>
            </div>

            {/* Database Breach Risk */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Database Breach Risk</h3>
                  <SeverityBadge level="standard" />
                  <StatusBadge status="mitigated" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  All queries use parameterized statements to prevent injection. Database is not publicly accessible 
                  and requires VPN + credentials. No sensitive data stored.
                </p>
              </div>
              <div className="text-sm text-[var(--text-muted)] whitespace-nowrap">Standard</div>
            </div>

            {/* SAID Gateway Dependency */}
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">SAID Gateway Dependency</h3>
                  <SeverityBadge level="low" />
                  <StatusBadge status="mitigated" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm">
                  Reputation scores depend on external SAID/Bags API. Graceful degradation is in place: 
                  agents remain functional even if the gateway is unavailable.
                </p>
              </div>
              <div className="text-sm text-[var(--text-muted)] whitespace-nowrap">Monitored</div>
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices for Agent Operators */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Best Practices for Agent Operators</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-cyan)]/10 flex items-center justify-center flex-shrink-0">
                <KeyIcon className="w-5 h-5 text-[var(--accent-cyan)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Generate Keypairs Securely</h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Generate Ed25519 keypairs on your own machine, never through online tools. Use established libraries 
                  like tweetnacl or libsodium in a secure environment.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-purple)]/10 flex items-center justify-center flex-shrink-0">
                <LockIcon className="w-5 h-5 text-[var(--accent-purple)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Protect Your Private Key</h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Store private keys in environment variables or secure vaults (e.g., HashiCorp Vault, AWS Secrets Manager). 
                  Never commit keys to version control.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">If Compromised: Act Fast</h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Immediately register a new agent with a fresh keypair, flag the compromised agent, 
                  and contact our team for assistance with reputation migration.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-cyan)]/50 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-emerald)]/10 flex items-center justify-center flex-shrink-0">
                <ServerIcon className="w-5 h-5 text-[var(--accent-emerald)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Operational Security</h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Rotate keys periodically, monitor your agent's reputation score, and use dedicated keypairs 
                  for different environments (dev/staging/prod).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audit Report & Documentation */}
      <section className="mb-16 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Audit Report & Documentation</h2>
        <div className="glass rounded-2xl p-8 border border-[var(--border-subtle)]">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex flex-col items-center justify-center border border-emerald-500/30">
                <span className="text-4xl font-bold text-emerald-400">B+</span>
                <span className="text-xs text-[var(--text-muted)] mt-1">Rating</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Formal Security Audit</h3>
              <p className="text-[var(--text-secondary)] mb-2">
                Conducted by <span className="text-[var(--text-primary)]">NinjaTech AI</span> in May 2025. 
                The audit covered cryptographic implementations, API security, data handling practices, and infrastructure configuration.
              </p>
              <p className="text-emerald-400 text-sm mb-4">
                Rating reflects pre-fix assessment. Multiple findings have since been resolved.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <a 
                  href="https://github.com/RunTimeAdmin/AgentID/blob/main/AgentID_Security_Audit.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/20 transition-all duration-200"
                >
                  <ShieldCheckIcon className="w-4 h-4" />
                  Full Audit Report
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
                <a 
                  href="https://github.com/RunTimeAdmin/AgentID/blob/main/AgentID_Code_Review.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  <CodeBracketIcon className="w-4 h-4" />
                  Code Review
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
                <a 
                  href="https://github.com/RunTimeAdmin/AgentID/blob/main/docs/API_REFERENCE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  API Reference
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
                <a 
                  href="https://github.com/RunTimeAdmin/AgentID/wiki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  <AcademicCapIcon className="w-4 h-4" />
                  GitHub Wiki
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="animate-fade-in">
        <div className="glass rounded-2xl p-8 md:p-12 border border-[var(--border-subtle)] text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-cyan)]/5 via-transparent to-[var(--accent-purple)]/5" />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4">
              Ready to Join the Trust Network?
            </h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8">
              Register your agent today and become part of a verified ecosystem where trust is cryptographically proven, not assumed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
              >
                <SparklesIcon className="w-5 h-5" />
                Register Your Agent
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--accent-cyan)]/50 hover:bg-[var(--bg-tertiary)]/80 transition-all duration-200"
              >
                Try Demo
              </Link>
            </div>
            <div className="mt-6">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] transition-colors"
              >
                View Agent Registry
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
