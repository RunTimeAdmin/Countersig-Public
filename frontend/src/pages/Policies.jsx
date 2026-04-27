import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import authClient from '../lib/authApi';

const EVENT_TYPES = [
  { value: 'agent.registered', label: 'Agent Registered' },
  { value: 'agent.flagged', label: 'Agent Flagged' },
  { value: 'agent.revoked', label: 'Agent Revoked' },
  { value: 'reputation.changed', label: 'Reputation Changed' },
  { value: 'api_key.created', label: 'API Key Created' },
  { value: 'login', label: 'User Login' },
];

const OPERATORS = [
  { value: '<', label: 'less than' },
  { value: '>', label: 'greater than' },
  { value: '==', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '<=', label: 'less than or equal' },
  { value: '>=', label: 'greater than or equal' },
];

const ACTIONS = [
  { value: 'revoke', label: 'Revoke' },
  { value: 'flag', label: 'Flag' },
  { value: 'notify', label: 'Notify' },
  { value: 'disable', label: 'Disable' },
];

const TEMPLATE_POLICIES = [
  {
    name: 'Auto-revoke agents with score below 20',
    condition: { type: 'field', field: 'bags_score', op: '<', value: '20' },
    action: 'revoke',
  },
  {
    name: 'Notify on agent flagged',
    condition: { type: 'event_type', event_type: 'agent.flagged' },
    action: 'notify',
  },
];

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function conditionToString(condition) {
  if (!condition) return 'Always';
  if (condition.type === 'event_type' || condition.event_type) {
    const evt = EVENT_TYPES.find((e) => e.value === (condition.event_type || condition.value));
    return `Event is "${evt?.label || condition.event_type || condition.value}"`;
  }
  if (condition.type === 'field' || condition.field) {
    const op = OPERATORS.find((o) => o.value === condition.op)?.label || condition.op;
    return `${condition.field} ${op} ${condition.value}`;
  }
  return JSON.stringify(condition);
}

export default function Policies() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    conditionType: 'event_type',
    eventType: 'agent.registered',
    field: '',
    op: '<',
    value: '',
    action: 'notify',
    enabled: true,
  });

  const fetchPolicies = useCallback(async () => {
    if (!user?.orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.get(`/orgs/${user.orgId}/policies`);
      setPolicies(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load policies');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [user?.orgId]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const resetForm = () => {
    setForm({
      name: '',
      conditionType: 'event_type',
      eventType: 'agent.registered',
      field: '',
      op: '<',
      value: '',
      action: 'notify',
      enabled: true,
    });
    setEditingPolicy(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (policy) => {
    setEditingPolicy(policy);
    const cond = typeof policy.condition === 'string' ? JSON.parse(policy.condition) : policy.condition;
    setForm({
      name: policy.name || '',
      conditionType: cond?.type === 'field' || cond?.field ? 'field' : 'event_type',
      eventType: cond?.event_type || cond?.value || 'agent.registered',
      field: cond?.field || '',
      op: cond?.op || '<',
      value: cond?.value?.toString() || '',
      action: policy.action || 'notify',
      enabled: policy.enabled !== false,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const condition =
      form.conditionType === 'event_type'
        ? { type: 'event_type', event_type: form.eventType }
        : { type: 'field', field: form.field, op: form.op, value: form.value };

    const payload = {
      name: form.name.trim(),
      condition,
      action: form.action,
      enabled: form.enabled,
    };

    setSaving(true);
    try {
      if (editingPolicy) {
        await authClient.put(`/orgs/${user.orgId}/policies/${editingPolicy.id}`, payload);
      } else {
        await authClient.post(`/orgs/${user.orgId}/policies`, payload);
      }
      setShowModal(false);
      resetForm();
      fetchPolicies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) return;
    try {
      await authClient.delete(`/orgs/${user.orgId}/policies/${id}`);
      fetchPolicies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete policy');
    }
  };

  const handleToggle = async (policy) => {
    try {
      await authClient.put(`/orgs/${user.orgId}/policies/${policy.id}`, {
        ...policy,
        enabled: !policy.enabled,
      });
      fetchPolicies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update policy');
    }
  };

  const applyTemplate = (template) => {
    setForm({
      name: template.name,
      conditionType: template.condition.type,
      eventType: template.condition.event_type || 'agent.registered',
      field: template.condition.field || '',
      op: template.condition.op || '<',
      value: template.condition.value?.toString() || '',
      action: template.action,
      enabled: true,
    });
    setEditingPolicy(null);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-[var(--bg-tertiary)] rounded-xl" />
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
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Policy Rules</h1>
          <p className="text-[var(--text-secondary)]">Automate responses to agent events with policy rules</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 self-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Policy
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

      {/* Templates */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quick Templates</h2>
        <div className="flex flex-wrap gap-3">
          {TEMPLATE_POLICIES.map((template) => (
            <button
              key={template.name}
              onClick={() => applyTemplate(template)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/20 transition-all"
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-2xl border border-[var(--border-subtle)] shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {editingPolicy ? 'Edit Policy' : 'Create Policy'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Auto-revoke low score agents"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Condition</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">When</span>
                    <select
                      value={form.conditionType}
                      onChange={(e) => setForm({ ...form, conditionType: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="event_type">Event occurs</option>
                      <option value="field">Field condition</option>
                    </select>
                  </div>

                  {form.conditionType === 'event_type' ? (
                    <select
                      value={form.eventType}
                      onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:outline-none appearance-none cursor-pointer"
                    >
                      {EVENT_TYPES.map((evt) => (
                        <option key={evt.value} value={evt.value}>{evt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={form.field}
                        onChange={(e) => setForm({ ...form, field: e.target.value })}
                        placeholder="Field name"
                        required
                        className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none"
                      />
                      <select
                        value={form.op}
                        onChange={(e) => setForm({ ...form, op: e.target.value })}
                        className="sm:w-32 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:outline-none appearance-none cursor-pointer"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={form.value}
                        onChange={(e) => setForm({ ...form, value: e.target.value })}
                        placeholder="Value"
                        required
                        className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Action</label>
                <select
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:outline-none appearance-none cursor-pointer"
                >
                  {ACTIONS.map((act) => (
                    <option key={act.value} value={act.value}>{act.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--accent-cyan)] focus:ring-[var(--accent-cyan)]/30"
                />
                <label htmlFor="enabled" className="text-sm text-[var(--text-primary)] cursor-pointer">
                  Enabled
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingPolicy ? 'Update Policy' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policies List */}
      {policies.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center border border-[var(--border-subtle)]">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No policies yet</h3>
          <p className="text-[var(--text-muted)] mb-6">Create your first policy to automate responses to agent events.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Policy
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="glass rounded-xl border border-[var(--border-subtle)] p-5 transition-all duration-200 hover:border-[var(--border-default)]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{policy.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                      policy.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                    }`}>
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    When {conditionToString(policy.condition)} →{' '}
                    <span className="font-medium capitalize text-[var(--accent-cyan)]">{policy.action}</span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Created {formatDate(policy.created_at)}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(policy)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      policy.enabled ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border-default)]'
                    }`}
                    title={policy.enabled ? 'Disable' : 'Enable'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        policy.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(policy)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-cyan)] hover:bg-[var(--bg-tertiary)] transition-all"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
