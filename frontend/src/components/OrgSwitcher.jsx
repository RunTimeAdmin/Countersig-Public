import { useAuth } from './AuthProvider';

export default function OrgSwitcher() {
  const { user } = useAuth();

  if (!user?.orgName) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30">
      <svg className="w-3.5 h-3.5 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <span className="text-xs font-medium text-[var(--accent-cyan)] truncate max-w-[120px]">
        {user.orgName}
      </span>
    </div>
  );
}
