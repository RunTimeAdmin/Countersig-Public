import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Get started with essential identity infrastructure for your agents.',
    badge: null,
    highlight: false,
    features: [
      '100 attestations/month',
      '50 verifications/month',
      '500 badge & reputation calls/month',
      '100 A2A token issuances/month',
      'Community support',
      'Public agent registry',
      'Trust badge embed',
      'W3C credential export',
    ],
    cta: 'Get Started Free',
    ctaTo: '/signup',
    ctaExternal: false,
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    description: 'For growing teams that need more capacity and priority features.',
    badge: 'Popular',
    highlight: true,
    features: [
      '5,000 attestations/month',
      '1,000 verifications/month',
      '10,000 badge & reputation calls/month',
      '1,000 A2A token issuances/month',
      'Email support',
      'Everything in Free, plus:',
      'Priority badge refresh',
      'Usage analytics dashboard',
    ],
    cta: 'Subscribe',
    ctaTo: '/settings',
    ctaExternal: false,
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/mo',
    description: 'Advanced tooling for production workloads and enterprise integrations.',
    badge: null,
    highlight: false,
    features: [
      '50,000 attestations/month',
      '10,000 verifications/month',
      '100,000 badge & reputation calls/month',
      '10,000 A2A token issuances/month',
      'Priority support',
      'Everything in Starter, plus:',
      'Advanced reputation analytics',
      'Webhook integrations',
      'Custom trust policies',
    ],
    cta: 'Subscribe',
    ctaTo: '/settings',
    ctaExternal: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Tailored solutions with dedicated support and compliance controls.',
    badge: null,
    highlight: false,
    features: [
      'Unlimited everything',
      'Dedicated account manager',
      'Custom SLA & uptime guarantee',
      'SSO / SAML integration',
      'Data residency controls',
      'On-premise deployment option',
    ],
    cta: 'Contact Us',
    ctaTo: 'mailto:enterprise@countersig.com',
    ctaExternal: true,
  },
];

const overages = [
  { item: 'Attestations', rate: '$0.10 each' },
  { item: 'Verifications', rate: '$0.25 each' },
  { item: 'Badge / Rep calls', rate: '$0.01 each' },
  { item: 'A2A tokens', rate: '$0.02 each' },
];

const faqs = [
  {
    q: 'What counts as an attestation?',
    a: 'Any action attestation or flag recorded against an agent. This includes attest, flag, register, update, and revoke operations.',
  },
  {
    q: 'What counts as a verification?',
    a: 'Each PKI challenge-response cycle (challenge issuance + response verification) counts as one verification.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes. Upgrade or downgrade anytime from your Settings page. Changes take effect immediately and are prorated.',
  },
  {
    q: 'What happens when I exceed my limits?',
    a: "You'll receive a 429 response with your current usage. Upgrade your plan or wait for the next billing period. Overages on paid plans are billed at the rates above.",
  },
  {
    q: 'Do public endpoints (badges, reputation) count against my quota?',
    a: 'No. Public badge and reputation lookups are free and unmetered.',
  },
  {
    q: 'Is there a free trial for paid plans?',
    a: 'The Free tier is permanent — no trial needed. Start building immediately and upgrade when you need more capacity.',
  },
];

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-xl border border-gray-700 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[var(--text-primary)] font-medium pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-[var(--text-muted)] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="px-6 pb-5 text-[var(--text-secondary)] text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
            Start free. Scale as you grow. Only pay for what you use.
          </p>
        </div>
      </section>

      {/* Tier Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`glass rounded-2xl p-6 border flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                tier.highlight
                  ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <span className="self-start mb-3 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tier.badge}
                </span>
              )}

              {/* Header */}
              <h3 className="text-xl font-bold text-[var(--text-primary)]">{tier.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-[var(--text-primary)]">{tier.price}</span>
                {tier.period && <span className="text-[var(--text-muted)] text-sm">{tier.period}</span>}
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">{tier.description}</p>

              {/* Divider */}
              <div className="my-5 border-t border-gray-700/60" />

              {/* Features */}
              <ul className="space-y-3 flex-1">
                {tier.features.map((f, i) => {
                  const isLabel = f.endsWith(':');
                  return (
                    <li key={i} className={`flex items-start gap-2 text-sm ${isLabel ? 'mt-4' : ''}`}>
                      {isLabel ? (
                        <span className="text-[var(--text-muted)] font-medium">{f}</span>
                      ) : (
                        <>
                          <CheckIcon />
                          <span className="text-[var(--text-secondary)]">{f}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* CTA */}
              <div className="mt-6">
                {tier.ctaExternal ? (
                  <a
                    href={tier.ctaTo}
                    className="block w-full text-center px-4 py-3 rounded-xl text-sm font-semibold bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-gray-600 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-200"
                  >
                    {tier.cta}
                  </a>
                ) : tier.highlight ? (
                  <Link
                    to={tier.ctaTo}
                    className="block w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-200"
                  >
                    {tier.cta}
                  </Link>
                ) : (
                  <Link
                    to={tier.ctaTo}
                    className="block w-full text-center px-4 py-3 rounded-xl text-sm font-semibold bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-gray-600 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-200"
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Overage Pricing */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">Overage Pricing</h2>
        <p className="text-center text-[var(--text-secondary)] text-sm mb-8">
          Paid plans are billed at the following rates when you exceed your monthly limits.
        </p>
        <div className="glass rounded-2xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/60">
                <th className="text-left px-6 py-4 text-[var(--text-muted)] font-medium uppercase tracking-wider text-xs">Resource</th>
                <th className="text-right px-6 py-4 text-[var(--text-muted)] font-medium uppercase tracking-wider text-xs">Rate</th>
              </tr>
            </thead>
            <tbody>
              {overages.map((o, i) => (
                <tr key={i} className={`${i < overages.length - 1 ? 'border-b border-gray-700/40' : ''} hover:bg-white/[0.02] transition-colors`}>
                  <td className="px-6 py-4 text-[var(--text-primary)]">{o.item}</td>
                  <td className="px-6 py-4 text-right text-emerald-400 font-medium">{o.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </section>

      {/* Enterprise CTA Banner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="glass rounded-2xl border border-gray-700 p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
          <div className="relative">
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
              Need custom limits, dedicated support, or on-premise deployment?
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              Contact us at{' '}
              <a href="mailto:enterprise@countersig.com" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
                enterprise@countersig.com
              </a>
            </p>
            <a
              href="mailto:enterprise@countersig.com"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Enterprise Sales
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
