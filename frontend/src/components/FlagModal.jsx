import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function FlagModal({ isOpen, onClose, onSubmit, agentPubkey }) {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [reporterPubkey, setReporterPubkey] = useState('');
  const [signature, setSignature] = useState('');
  const [timestamp, setTimestamp] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Generate message to sign whenever reporterPubkey or timestamp changes
  const messageToSign = reporterPubkey.trim()
    ? `AGENTID-FLAG:${agentPubkey}:${reporterPubkey.trim()}:${timestamp}`
    : '';

  // Update timestamp when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimestamp(Date.now());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Please provide a reason for flagging this agent.');
      return;
    }

    // Validate JSON evidence if provided
    let parsedEvidence = null;
    if (evidence.trim()) {
      try {
        parsedEvidence = JSON.parse(evidence);
      } catch {
        setError('Evidence must be valid JSON.');
        return;
      }
    }

    // Validate signature is provided
    if (!signature.trim()) {
      setError('Signature is required. Please sign the message with your private key.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reason: reason.trim(),
        evidence: parsedEvidence,
        reporterPubkey: reporterPubkey.trim(),
        signature: signature.trim(),
        timestamp,
      });
      // Reset form on success
      setReason('');
      setEvidence('');
      setReporterPubkey('');
      setSignature('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit flag. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg animate-fade-in">
        <div className="glass rounded-2xl border border-[var(--border-default)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-gradient-to-r from-red-500/10 to-orange-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Flag Agent</h2>
                <p className="text-sm text-[var(--text-muted)]">Report suspicious behavior</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Agent Info */}
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Agent</div>
              <div className="font-mono text-sm text-[var(--text-secondary)] break-all">
                {agentPubkey}
              </div>
            </div>

            {/* Reporter Pubkey Input */}
            <div>
              <label htmlFor="flag-reporter" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Your Public Key <span className="text-red-400">*</span>
              </label>
              <input
                id="flag-reporter"
                type="text"
                value={reporterPubkey}
                onChange={(e) => setReporterPubkey(e.target.value)}
                placeholder="Paste your Ed25519 public key (base58-encoded)..."
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors font-mono text-sm"
                disabled={isSubmitting}
                required
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Required: Your Ed25519 public key. You must prove ownership by signing a message with the corresponding private key.
              </p>
            </div>

            {/* Message to Sign */}
            {reporterPubkey.trim() && (
              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Message to Sign</div>
                <div className="font-mono text-xs text-[var(--text-secondary)] break-all bg-[var(--bg-tertiary)] p-2 rounded">
                  {messageToSign}
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Sign this exact message with your Ed25519 private key to prove ownership.
                </p>
              </div>
            )}

            {/* Signature Input */}
            <div>
              <label htmlFor="flag-signature" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Signature <span className="text-red-400">*</span>
              </label>
              <textarea
                id="flag-signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Paste the base58-encoded signature of the message above..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors font-mono text-sm resize-none"
                disabled={isSubmitting}
                required
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Required: The Ed25519 signature of the message above, encoded in base58.
              </p>
            </div>

            {/* Reason Input */}
            <div>
              <label htmlFor="flag-reason" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Reason <span className="text-red-400">*</span>
              </label>
              <input
                id="flag-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Suspicious transaction pattern, Impersonation..."
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors"
                disabled={isSubmitting}
              />
            </div>

            {/* Evidence Input */}
            <div>
              <label htmlFor="flag-evidence" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Evidence <span className="text-[var(--text-muted)] font-normal">(JSON, optional)</span>
              </label>
              <textarea
                id="flag-evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={`{\n  "transactionHash": "...",\n  "timestamp": "...",\n  "details": "..."\n}`}
                rows={5}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] transition-colors font-mono text-sm resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Flag
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

FlagModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  agentPubkey: PropTypes.string.isRequired,
};
