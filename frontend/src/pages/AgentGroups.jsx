import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import authClient from '../lib/authApi';

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Placeholder - will connect when backend group routes are added
function useGroupApi(user) {
  const getGroups = useCallback(() => {
    return authClient.get(`/orgs/${user?.orgId}/groups`).catch(() => ({ data: [] }));
  }, [user?.orgId]);

  const createGroup = useCallback((data) => {
    return authClient.post(`/orgs/${user?.orgId}/groups`, data);
  }, [user?.orgId]);

  const deleteGroup = useCallback((id) => {
    return authClient.delete(`/orgs/${user?.orgId}/groups/${id}`);
  }, [user?.orgId]);

  return { getGroups, createGroup, deleteGroup };
}

export default function AgentGroups() {
  const { user } = useAuth();
  const { getGroups, createGroup, deleteGroup } = useGroupApi(user);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });

  const fetchGroups = useCallback(async () => {
    if (!user?.orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getGroups();
      setGroups(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [getGroups, user?.orgId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroup.name.trim()) return;
    setCreating(true);
    try {
      await createGroup({
        name: newGroup.name.trim(),
        description: newGroup.description.trim(),
      });
      setNewGroup({ name: '', description: '' });
      setShowCreate(false);
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await deleteGroup(id);
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-[var(--bg-tertiary)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Agent Groups</h1>
          <p className="text-[var(--text-secondary)]">Organize and manage your agents into groups</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 self-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-2xl border border-[var(--border-subtle)] shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Group</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Name</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="e.g., Production Agents"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Description</label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Brief description of this group..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 focus:outline-none resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newGroup.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coming Soon Note */}
      <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400 flex items-start gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-medium">Drag-and-drop agent assignment coming soon</p>
          <p className="text-amber-400/80 mt-0.5">You will soon be able to assign agents to groups via an intuitive drag-and-drop interface.</p>
        </div>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center border border-[var(--border-subtle)]">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No groups yet</h3>
          <p className="text-[var(--text-muted)] mb-6">Create your first group to organize your agents.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="glass rounded-xl border border-[var(--border-subtle)] p-5 transition-all duration-200 hover:border-[var(--border-default)] hover:shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] truncate">{group.name}</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1 line-clamp-2">{group.description || 'No description'}</p>
                </div>
                <button
                  onClick={() => handleDelete(group.id)}
                  className="ml-3 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                  title="Delete group"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] mb-3">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{group.agent_count ?? 0} agents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(group.created_at)}</span>
                </div>
              </div>

              <button
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                className="text-sm text-[var(--accent-cyan)] hover:text-[var(--accent-purple)] transition-colors font-medium"
              >
                {expandedGroup === group.id ? 'Hide agents' : 'View agents'}
              </button>

              {expandedGroup === group.id && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] animate-fade-in">
                  {group.agents?.length > 0 ? (
                    <div className="space-y-2">
                      {group.agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/30 text-sm text-[var(--text-primary)]"
                        >
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center text-white text-xs font-bold">
                            {(agent.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{agent.name || 'Unnamed Agent'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)] py-2">No agents in this group yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
