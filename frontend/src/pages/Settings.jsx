import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { getOrg, getOrgMembers, getApiKeys, createApiKey, deleteApiKey, getIdentityProviders, createIdentityProvider, updateIdentityProvider, deleteIdentityProvider } from '../lib/authApi';

const TABS = [
  { id: 'org', label: 'Organization' },
  { id: 'keys', label: 'API Keys' },
  { id: 'team', label: 'Team Members' },
  { id: 'identity-providers', label: 'Identity Providers' },
];

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Organization Section ----
function OrgSection({ org, loading }) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl" />
        <div className="h-10 bg-[var(--bg-tertiary)] rounded-xl" />
        <div className="h-32 bg-[var(--bg-tertiary)] rounded-xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-muted)]">Organization data unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Organization Name</div>
          <div className="text-[var(--text-primary)] font-medium">{org.name}</div>
        </div>
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Slug</div>
          <div className="font-mono text-sm text-[var(--text-secondary)]">{org.slug}</div>
        </div>
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Created</div>
          <div className="text-sm text-[var(--text-secondary)]">{formatDate(org.created_at)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Plan</div>
          <div className="text-sm text-[var(--accent-cyan)] font-medium capitalize">{org.plan || 'Free'}</div>
        </div>
      </div>

      {/* Edit form placeholder - read only for now */}
      <div className="glass rounded-xl p-6 border border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Organization Details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Description</label>
            <textarea
              readOnly
              value={org.description || 'No description provided.'}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] resize-none cursor-not-allowed opacity-70"
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">Editing organization details coming soon.</p>
        </div>
      </div>
    </div>
  );
}

// ---- API Keys Section ----
function ApiKeysSection() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [rawKey, setRawKey] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiKeys();
      setKeys(res.data || []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await createApiKey({ name: newKeyName.trim(), scopes: ['read', 'write'] });
      setRawKey(res.data);
      setNewKeyName('');
      setShowCreate(false);
      fetchKeys();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await deleteApiKey(id);
      fetchKeys();
    } catch {
      setError('Failed to revoke key');
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-xl" />
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-xl" />
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Raw Key Display */}
      {rawKey && (
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-sm font-semibold text-amber-400">API Key Created — Copy it now!</h3>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-primary)] font-mono text-sm text-[var(--text-primary)] break-all">
              {rawKey.rawKey}
            </code>
            <button
              onClick={() => handleCopy(rawKey.rawKey)}
              className="px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-amber-400/80">This key will not be shown again. Store it securely.</p>
          <button
            onClick={() => setRawKey(null)}
            className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your API Keys ({keys.length})</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Key
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="glass rounded-xl p-5 border border-[var(--border-subtle)] animate-fade-in">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Key Name</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Production API"
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !newKeyName.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </form>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl border border-[var(--border-subtle)]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-muted)]">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">{key.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Prefix: <span className="font-mono">{key.prefix}</span> · Created {formatDate(key.created_at)}
                  {key.last_used_at && ` · Last used ${formatDate(key.last_used_at)}`}
                </div>
              </div>
              <button
                onClick={() => handleDelete(key.id)}
                className="ml-3 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Team Members Section ----
function TeamSection({ orgId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!orgId) {
        setLoading(false);
        return;
      }
      try {
        const res = await getOrgMembers(orgId);
        setMembers(res.data || []);
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [orgId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-xl" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 glass rounded-xl border border-[var(--border-subtle)]">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <p className="text-sm text-[var(--text-muted)]">No team members found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(member.name || member.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)]">{member.name || 'Unnamed'}</div>
            <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
              member.role === 'admin'
                ? 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] border border-[var(--accent-purple)]/30'
                : 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30'
            }`}>
              {member.role}
            </span>
            <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
              {member.last_login_at ? `Last login ${formatDate(member.last_login_at)}` : 'Never logged in'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Identity Providers Section ----
function IdentityProvidersSection({ orgId }) {
  const [idps, setIdps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddIdP, setShowAddIdP] = useState(false);
  const [newIdP, setNewIdP] = useState({ providerType: 'oauth2', issuerUrl: '', clientId: '' });
  const [error, setError] = useState('');

  const fetchIdPs = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getIdentityProviders(orgId);
      setIdps(data.identityProviders || []);
    } catch {
      setIdps([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchIdPs();
  }, [fetchIdPs]);

  async function handleCreateIdP() {
    if (!newIdP.issuerUrl.trim()) {
      setError('Issuer URL is required');
      return;
    }
    try {
      await createIdentityProvider(orgId, {
        provider_type: newIdP.providerType,
        issuer_url: newIdP.issuerUrl,
        client_id: newIdP.clientId || undefined,
      });
      setShowAddIdP(false);
      setNewIdP({ providerType: 'oauth2', issuerUrl: '', clientId: '' });
      setError('');
      fetchIdPs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create identity provider');
    }
  }

  async function handleDeleteIdP(idpId) {
    if (!window.confirm('Are you sure you want to remove this identity provider?')) return;
    try {
      await deleteIdentityProvider(orgId, idpId);
      setIdps(prev => prev.filter(p => p.id !== idpId));
    } catch (err) {
      console.error('Failed to delete IdP:', err);
    }
  }

  async function handleToggleIdP(idp) {
    try {
      await updateIdentityProvider(orgId, idp.id, { enabled: !idp.enabled });
      setIdps(prev => prev.map(p => p.id === idp.id ? { ...p, enabled: !p.enabled } : p));
    } catch (err) {
      console.error('Failed to update IdP:', err);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--bg-tertiary)] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Identity Providers</h3>
          <p className="text-sm text-[var(--text-secondary)]">Configure enterprise identity providers for agent registration.</p>
        </div>
        <button
          onClick={() => setShowAddIdP(true)}
          className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all text-sm font-medium"
        >
          Add Provider
        </button>
      </div>

      {/* IdP List */}
      {idps.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl border border-[var(--border-subtle)]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-muted)]">No identity providers configured yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Add an OAuth2, Entra ID, or OIDC provider to enable enterprise agent registration.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {idps.map(idp => (
            <div key={idp.id} className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    idp.provider_type === 'entra_id' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                    idp.provider_type === 'okta' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' :
                    'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                  }`}>
                    {idp.provider_type}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{idp.issuer_url}</span>
                  {!idp.enabled && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">Disabled</span>
                  )}
                </div>
                {idp.client_id && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">Client ID: {idp.client_id}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleIdP(idp)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all"
                >
                  {idp.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDeleteIdP(idp.id)}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 bg-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-all"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add IdP Modal */}
      {showAddIdP && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Add Identity Provider</h3>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Provider Type</label>
              <select
                value={newIdP.providerType}
                onChange={(e) => setNewIdP(p => ({ ...p, providerType: e.target.value }))}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="oauth2">OAuth2 / OIDC</option>
                <option value="entra_id">Microsoft Entra ID</option>
                <option value="okta">Okta</option>
                <option value="auth0">Auth0</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Issuer URL</label>
              <input
                value={newIdP.issuerUrl}
                onChange={(e) => setNewIdP(p => ({ ...p, issuerUrl: e.target.value }))}
                placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Client ID (optional)</label>
              <input
                value={newIdP.clientId}
                onChange={(e) => setNewIdP(p => ({ ...p, clientId: e.target.value }))}
                placeholder="Application (client) ID"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddIdP(false); setError(''); }}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIdP}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-all"
              >
                Add Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Settings Page ----
export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('org');
  const [org, setOrg] = useState(null);
  const [orgLoading, setOrgLoading] = useState(true);

  useEffect(() => {
    const fetchOrg = async () => {
      if (!user?.orgId) {
        setOrgLoading(false);
        return;
      }
      try {
        const res = await getOrg(user.orgId);
        setOrg(res.data);
      } catch {
        setOrg(null);
      } finally {
        setOrgLoading(false);
      }
    };
    fetchOrg();
  }, [user?.orgId]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Settings</h1>
        <p className="text-[var(--text-secondary)]">Manage your organization, API keys, and team</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 p-1 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'org' && <OrgSection org={org} loading={orgLoading} />}
        {activeTab === 'keys' && <ApiKeysSection />}
        {activeTab === 'team' && <TeamSection orgId={user?.orgId} />}
        {activeTab === 'identity-providers' && <IdentityProvidersSection orgId={user?.orgId} />}
      </div>
    </div>
  );
}
