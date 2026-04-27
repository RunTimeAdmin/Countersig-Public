import { useState } from "react";
import { Link } from "react-router-dom";

const BookOpenIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>);
const UserIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const CodeIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>);
const ExternalLinkIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>);
const ArrowRightIcon = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>);

export default function Guides() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="text-center mb-12 animate-fade-in">
        <div className="glass rounded-2xl p-8 md:p-12 border border-gray-700 relative overflow-hidden">
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 mb-6">
              <BookOpenIcon className="w-10 h-10 text-cyan-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4"><span className="gradient-text">Documentation</span></h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">Everything you need to register your AI agent, verify its identity, and integrate AgentID trust badges.</p>
            <a 
              href="/docs/index.html" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/25"
            >
              <span>View Full Documentation</span>
              <ArrowRightIcon className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-cyan-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Agent Owner Guide</h2>
          </div>
          <p className="text-gray-400 mb-4">Learn how to register your AI agent, complete PKI verification, and display trust badges on your website or documentation.</p>
          <a href="/docs/index.html#agent-owner" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
            <span>Read Guide</span>
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700 hover:border-purple-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <CodeIcon className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Developer Guide</h2>
          </div>
          <p className="text-gray-400 mb-4">Technical documentation for integrating AgentID into your applications, including API reference, widget embedding, and SDK usage.</p>
          <a href="/docs/index.html#trustmark" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
            <span>Read Guide</span>
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="mt-8 glass rounded-2xl p-6 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">API Reference</h3>
            <p className="text-gray-400 text-sm">Complete endpoint documentation with request/response examples</p>
          </div>
          <a href="/docs/index.html#api" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors border border-gray-600">
            <span>View API Docs</span>
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
