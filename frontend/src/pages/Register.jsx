import { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerAgent, issueChallenge } from '../lib/api';
import TrustBadge from '../components/TrustBadge';

const TOTAL_STEPS = 4;

// Step indicator component
function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] text-white shadow-lg shadow-[var(--accent-cyan)]/30'
                  : isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-default)]'
              }`}
            >
              {isCompleted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            {stepNum < TOTAL_STEPS && (
              <div
                className={`w-12 h-0.5 mx-2 transition-colors duration-300 ${
                  isCompleted ? 'bg-emerald-500/50' : 'bg-[var(--border-default)]'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step label
function StepLabel({ currentStep }) {
  const labels = [
    'Agent Identity',
    'Sign Challenge',
    'Metadata',
    'Confirmation',
  ];

  return (
    <div className="text-center mb-8">
      <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
        Step {currentStep} of {TOTAL_STEPS}
      </div>
      <div className="text-xl font-semibold text-[var(--text-primary)]">
        {labels[currentStep - 1]}
      </div>
    </div>
  );
}

// Input field component with validation
function FormField({ label, name, type = 'text', value, onChange, placeholder, required = false, error, helpText, disabled = false }) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-[var(--text-primary)] mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all duration-200 focus:outline-none ${
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
            : 'border-[var(--border-default)] focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      {helpText && !error && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{helpText}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// Textarea field component
function TextAreaField({ label, name, value, onChange, placeholder, rows = 4, helpText }) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-[var(--text-primary)] mb-2">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all duration-200 focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 focus:outline-none resize-none"
      />
      {helpText && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{helpText}</p>
      )}
    </div>
  );
}

// Multi-select capabilities input
function CapabilitiesInput({ value, onChange }) {
  const [inputValue, setInputValue] = useState('');
  const capabilities = value ? value.split(',').map(c => c.trim()).filter(Boolean) : [];

  const addCapability = () => {
    if (inputValue.trim() && !capabilities.includes(inputValue.trim())) {
      const newCapabilities = [...capabilities, inputValue.trim()];
      onChange({ target: { name: 'capabilities', value: newCapabilities.join(', ') } });
      setInputValue('');
    }
  };

  const removeCapability = (cap) => {
    const newCapabilities = capabilities.filter(c => c !== cap);
    onChange({ target: { name: 'capabilities', value: newCapabilities.join(', ') } });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCapability();
    }
  };

  const suggestedCapabilities = [
    'bags.swap.v1',
    'bags.fee-claim.v1',
    'bags.launch.v1',
    'bags.trade.v1',
    'infra.solana.health.v1',
  ];

  const addSuggested = (cap) => {
    if (!capabilities.includes(cap)) {
      const newCapabilities = [...capabilities, cap];
      onChange({ target: { name: 'capabilities', value: newCapabilities.join(', ') } });
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
        Capabilities
      </label>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., bags.swap.v1"
          className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all duration-200 focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]/30 focus:outline-none"
        />
        <button
          type="button"
          onClick={addCapability}
          className="px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Suggested capabilities */}
      <div className="flex flex-wrap gap-2 mb-3">
        {suggestedCapabilities.map((cap) => (
          <button
            key={cap}
            type="button"
            onClick={() => addSuggested(cap)}
            disabled={capabilities.includes(cap)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              capabilities.includes(cap)
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                : 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 hover:bg-[var(--accent-cyan)]/20'
            }`}
          >
            + {cap}
          </button>
        ))}
      </div>

      {/* Selected capabilities */}
      {capabilities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {capabilities.map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              {cap}
              <button
                type="button"
                onClick={() => removeCapability(cap)}
                className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Register() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    pubkey: '',
    name: '',
    signature: '',
    challenge: '',
    tokenMint: '',
    capabilities: '',
    creatorXHandle: '',
    creatorWallet: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredAgent, setRegisteredAgent] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field changes
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setServerError('');
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.pubkey.trim()) {
        newErrors.pubkey = 'Public key is required';
      } else if (formData.pubkey.length < 32) {
        newErrors.pubkey = 'Invalid Ed25519 public key';
      }
      if (!formData.name.trim()) {
        newErrors.name = 'Agent name is required';
      } else if (formData.name.length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }
    }

    if (step === 2) {
      if (!formData.signature.trim()) {
        newErrors.signature = 'Signature is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      if (currentStep === 1) {
        // Fetch challenge before moving to step 2
        try {
          const response = await issueChallenge(formData.pubkey);
          setFormData((prev) => ({ ...prev, challenge: response.challenge }));
        } catch (err) {
          setServerError(err.message || 'Failed to fetch challenge. Please try again.');
          return;
        }
      }
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setServerError('');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerError('');

    try {
      const registrationData = {
        pubkey: formData.pubkey,
        name: formData.name,
        signature: formData.signature,
        token_mint: formData.tokenMint || undefined,
        capabilities: formData.capabilities
          ? formData.capabilities.split(',').map((c) => c.trim()).filter(Boolean)
          : undefined,
        creator_x_handle: formData.creatorXHandle || undefined,
        creator_wallet: formData.creatorWallet || undefined,
        description: formData.description || undefined,
      };

      const response = await registerAgent(registrationData);
      setRegisteredAgent(response);
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state after registration
  if (registeredAgent) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
        <div className="glass rounded-2xl p-8 text-center border border-emerald-500/30 bg-emerald-500/5">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Registration Successful!</h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Your agent has been registered in the AgentID ecosystem.
          </p>

          <div className="mb-8">
            <TrustBadge
              status={registeredAgent.status || 'unverified'}
              name={registeredAgent.name}
              registeredAt={registeredAgent.registered_at}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={`/agents/${registeredAgent.agent?.agentId || registeredAgent.agent_id || registeredAgent.id}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Agent Profile
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Browse Registry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Register Agent</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg">
          Register your AI agent with AgentID to receive a trust badge and establish verifiable identity.
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      <StepLabel currentStep={currentStep} />

      {/* Server Error */}
      {serverError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {serverError}
          </div>
        </div>
      )}

      {/* Form Container */}
      <div className="glass rounded-2xl p-6 md:p-8 border border-[var(--border-subtle)] animate-fade-in">
        {/* Step 1: Agent Identity */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <FormField
              label="Agent Public Key"
              name="pubkey"
              value={formData.pubkey}
              onChange={handleChange}
              placeholder="Enter Ed25519 public key (base58-encoded)"
              required
              error={errors.pubkey}
              helpText="Your agent's Ed25519 public key for cryptographic identity verification"
            />
            <FormField
              label="Agent Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., My Trading Bot"
              required
              error={errors.name}
              helpText="A display name for your agent"
            />
          </div>
        )}

        {/* Step 2: Sign Challenge */}
        {currentStep === 2 && (
          <div className="animate-fade-in">
            <div className="mb-6 p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Challenge Message
              </div>
              <div className="font-mono text-sm text-[var(--text-secondary)] break-all bg-[var(--bg-primary)] p-3 rounded-lg">
                {formData.challenge}
              </div>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Sign this message with your Ed25519 private key to prove ownership of this agent.
              </p>
            </div>

            <TextAreaField
              label="Signature"
              name="signature"
              value={formData.signature}
              onChange={handleChange}
              placeholder="Paste your base64-encoded signature here..."
              rows={4}
              helpText={errors.signature}
            />
            {errors.signature && (
              <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                </svg>
                {errors.signature}
              </p>
            )}

            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-[var(--text-secondary)]">
                  <p className="font-medium text-amber-400 mb-1">How to sign:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Copy the challenge message above</li>
                    <li>Use your agent's private key to sign it (Ed25519)</li>
                    <li>Base64 encode the signature</li>
                    <li>Paste the result in the field above</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Signing Methods */}
            <div className="mt-4 p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Signing Options
              </div>
              
              {/* Phantom Wallet */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Phantom Wallet</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] ml-6">
                  Use Phantom wallet's "Sign Message" feature. Copy the challenge message above, open Phantom, 
                  click the menu (☰) → "Sign Message", paste the challenge, and sign with your agent's wallet.
                </p>
              </div>

              {/* CLI Signing */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-[var(--accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--text-primary)]">CLI Signing</span>
                </div>
                <div className="ml-6 space-y-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Save the challenge to a file and sign using your Ed25519 private key:
                  </p>
                  <div className="bg-[var(--bg-primary)] p-3 rounded-lg font-mono text-xs text-[var(--text-secondary)] overflow-x-auto">
                    <div className="text-[var(--text-muted)]"># Save challenge to file</div>
                    <div>echo "<span className="text-amber-400">{formData.challenge}</span>" &gt; challenge.txt</div>
                    <div className="mt-1 text-[var(--text-muted)]"># Sign the message</div>
                    <div># Using libsodium or similar Ed25519 signing tool</div>
                    <div>sign_challenge(challenge.txt, private_key)</div>
                    <div className="mt-1 text-[var(--text-muted)]"># Or use any Ed25519-compatible signing utility</div>
                  </div>
                </div>
              </div>

              {/* Expected Format */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Expected Signature Format</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] ml-6 mb-2">
                  Your signature should look like this (base64-encoded Ed25519 signature):
                </p>
                <div className="ml-6 bg-[var(--bg-primary)] p-3 rounded-lg font-mono text-xs text-[var(--text-secondary)] break-all">
                  5Nq8Xk9m7PqR3vL2w...<span className="text-[var(--text-muted)]"> (88 characters)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Additional Metadata */}
        {currentStep === 3 && (
          <div className="animate-fade-in">
            <FormField
              label="Token Mint (Optional)"
              name="tokenMint"
              value={formData.tokenMint}
              onChange={handleChange}
              placeholder="Enter token mint address"
              helpText="The SPL token associated with this agent"
            />

            <CapabilitiesInput value={formData.capabilities} onChange={handleChange} />

            <FormField
              label="Creator X Handle (Optional)"
              name="creatorXHandle"
              value={formData.creatorXHandle}
              onChange={handleChange}
              placeholder="@username"
              helpText="Your X (Twitter) handle for verification"
            />

            <FormField
              label="Creator Wallet (Optional)"
              name="creatorWallet"
              value={formData.creatorWallet}
              onChange={handleChange}
              placeholder="Enter creator public key (optional)"
              helpText="Ed25519 public key of the agent creator for attribution"
            />

            <TextAreaField
              label="Description (Optional)"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what your agent does..."
              rows={3}
              helpText="A brief description of your agent's purpose and capabilities"
            />
          </div>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 4 && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Review Your Registration</h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Public Key</div>
                <div className="font-mono text-sm text-[var(--text-secondary)] break-all">{formData.pubkey}</div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Agent Name</div>
                <div className="text-[var(--text-primary)] font-medium">{formData.name}</div>
              </div>

              {formData.tokenMint && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Token Mint</div>
                  <div className="font-mono text-sm text-[var(--text-secondary)] break-all">{formData.tokenMint}</div>
                </div>
              )}

              {formData.capabilities && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Capabilities</div>
                  <div className="flex flex-wrap gap-2">
                    {formData.capabilities.split(',').map((cap, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30"
                      >
                        {cap.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(formData.creatorXHandle || formData.creatorWallet) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.creatorXHandle && (
                    <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Creator X</div>
                      <div className="text-[var(--text-primary)]">{formData.creatorXHandle}</div>
                    </div>
                  )}
                  {formData.creatorWallet && (
                    <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Creator Wallet</div>
                      <div className="font-mono text-sm text-[var(--text-secondary)] break-all">{formData.creatorWallet}</div>
                    </div>
                  )}
                </div>
              )}

              {formData.description && (
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Description</div>
                  <div className="text-sm text-[var(--text-secondary)]">{formData.description}</div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[var(--accent-cyan)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-[var(--text-secondary)]">
                  By submitting this registration, you confirm that you are the owner of this agent and all provided information is accurate.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 flex items-center gap-2"
            >
              Continue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Registering...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Complete Registration
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
