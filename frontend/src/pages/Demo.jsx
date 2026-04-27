import { useState, useEffect } from 'react';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { registerAgent, issueChallenge, verifyChallenge, getBadge } from '../lib/api';
import TrustBadge from '../components/TrustBadge';

const TOTAL_STEPS = 4;

// Checkmark icon component
function CheckIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Sparkle icon for demo button
function SparkleIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

// Step card component
function StepCard({ stepNumber, title, description, isActive, isCompleted, children }) {
  return (
    <div className={`glass rounded-2xl border transition-all duration-300 ${
      isActive ? 'border-[var(--accent-cyan)]/50 shadow-lg shadow-[var(--accent-cyan)]/10' : 
      isCompleted ? 'border-emerald-500/30' : 'border-[var(--border-subtle)] opacity-60'
    }`}>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-300 ${
            isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
            isActive ? 'bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] text-white' :
            'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}>
            {isCompleted ? <CheckIcon className="w-6 h-6" /> : stepNumber}
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
              {title}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          </div>
        </div>
        <div className={isActive || isCompleted ? '' : 'pointer-events-none'}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Collapsible API call section
function ApiCallSection({ title, curl }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 border border-[var(--border-subtle)] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {title}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-[var(--bg-tertiary)]/30 border-t border-[var(--border-subtle)]">
          <pre className="text-xs text-[var(--text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {curl}
          </pre>
        </div>
      )}
    </div>
  );
}

// Copy button component
function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-cyan)]/10 transition-all duration-200"
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export default function Demo() {
  const [currentStep, setCurrentStep] = useState(1);
  const [keypair, setKeypair] = useState(null);
  const [agentData, setAgentData] = useState({
    name: '',
    description: 'This is a demo agent created to showcase AgentID\'s verification flow',
    capabilities: ['demo', 'testing'],
    categories: ['utility'],
  });
  const [registeredAgent, setRegisteredAgent] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [challengeData, setChallengeData] = useState(null);
  const [signature, setSignature] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  // Generate random agent name on mount
  useEffect(() => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setAgentData(prev => ({
      ...prev,
      name: `Demo Agent ${randomDigits}`,
    }));
  }, []);

  // Step 1: Generate Keypair
  const generateKeypair = () => {
    const newKeypair = nacl.sign.keyPair();
    setKeypair(newKeypair);
    setCurrentStep(2);
    setError(null);
  };

  const getPublicKeyBase58 = () => {
    if (!keypair) return '';
    return bs58.encode(keypair.publicKey);
  };

  const getPrivateKeyTruncated = () => {
    if (!keypair) return '';
    const secretKeyBase58 = bs58.encode(keypair.secretKey);
    return `${secretKeyBase58.slice(0, 8)}...${secretKeyBase58.slice(-8)}`;
  };

  // Step 2: Register Agent
  const handleRegister = async () => {
    setLoading({ ...loading, register: true });
    setError(null);

    try {
      // Generate nonce and message for registration signature
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();
      const messagePlain = `AGENTID-REGISTER:${agentData.name}:${nonce}:${timestamp}`;
      
      // Backend expects base58-encoded message for verification
      const messageBytes = new TextEncoder().encode(messagePlain);
      const message = bs58.encode(messageBytes);
      
      // Sign the message with the generated keypair
      const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      const registrationData = {
        pubkey: getPublicKeyBase58(),
        name: agentData.name,
        description: agentData.description,
        capabilities: agentData.capabilities,
        categories: agentData.categories,
        signature,
        message,
        nonce,
      };

      const response = await registerAgent(registrationData);
      setRegisteredAgent(response);
      // Extract agentId from response - backend returns it at top level as agentId
      // and also inside agent object as agentId (transformed from agent_id)
      const newAgentId = response.agentId || response.agent?.agentId || response.agent_id || response.id;
      if (!newAgentId) {
        console.error('Failed to extract agentId from response:', response);
        throw new Error('Registration response missing agentId');
      }
      setAgentId(newAgentId);
      setCurrentStep(3);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading({ ...loading, register: false });
    }
  };

  // Step 3: Request Challenge
  const requestChallenge = async () => {
    setLoading({ ...loading, challenge: true });
    setError(null);

    try {
      const response = await issueChallenge(agentId);
      setChallengeData(response);
    } catch (err) {
      setError(err.message || 'Failed to request challenge. Please try again.');
    } finally {
      setLoading({ ...loading, challenge: false });
    }
  };

  // Step 3: Sign Challenge
  const signChallenge = () => {
    if (!challengeData || !keypair) return;

    // The challenge from server is base58-encoded, so we need to decode it before signing
    const messageBytes = bs58.decode(challengeData.challenge);
    const sig = nacl.sign.detached(messageBytes, keypair.secretKey);
    setSignature(bs58.encode(sig));
  };

  // Step 3: Verify Signature
  const verifySignature = async () => {
    setLoading({ ...loading, verify: true });
    setError(null);

    try {
      const response = await verifyChallenge(
        agentId,
        challengeData.nonce,
        signature
      );
      setVerificationResult(response);
      setCurrentStep(4);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading({ ...loading, verify: false });
    }
  };

  // Step 4: Fetch Badge
  const fetchBadge = async () => {
    setLoading({ ...loading, badge: true });

    try {
      const response = await getBadge(agentId);
      setBadgeData(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch badge. Please try again.');
    } finally {
      setLoading({ ...loading, badge: false });
    }
  };

  // Reset demo
  const resetDemo = () => {
    setCurrentStep(1);
    setKeypair(null);
    setRegisteredAgent(null);
    setAgentId(null);
    setChallengeData(null);
    setSignature(null);
    setVerificationResult(null);
    setBadgeData(null);
    setError(null);
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setAgentData({
      name: `Demo Agent ${randomDigits}`,
      description: 'This is a demo agent created to showcase AgentID\'s verification flow',
      capabilities: ['demo', 'testing'],
      categories: ['utility'],
    });
  };

  // Progress indicator
  const ProgressIndicator = () => (
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
              {isCompleted ? <CheckIcon className="w-5 h-5" /> : stepNum}
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

  const embedCode = `<iframe 
  src="${window.location.origin}/widget/${agentId}" 
  width="320" 
  height="120" 
  frameborder="0"
></iframe>`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] text-sm font-medium mb-4">
          <SparkleIcon className="w-4 h-4" />
          Interactive Demo
        </div>
        <div className="flex items-center justify-center gap-4 mb-4">
          <img src="/AgentIDLogo.png" alt="AgentID" className="w-16 h-16 rounded-2xl shadow-lg" />
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="gradient-text">Try AgentID</span>
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
          Experience the full challenge-response verification flow without needing your own keypair.
          This demo generates a throwaway Ed25519 keypair in your browser and walks you through each step.
        </p>
      </div>

      {/* Progress Indicator */}
      <ProgressIndicator />

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-6">
        {/* Step 1: Generate Keypair */}
        <StepCard
          stepNumber={1}
          title="Generate Keypair"
          description="Create an Ed25519 keypair for this demo"
          isActive={currentStep === 1}
          isCompleted={currentStep > 1}
        >
          {!keypair ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                We&apos;ll generate a cryptographic keypair directly in your browser using tweetnacl. 
                The private key never leaves your device and is discarded when you reset the demo.
              </p>
              <button
                onClick={generateKeypair}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Generate Keypair
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-400 mb-3">
                  <CheckIcon className="w-5 h-5" />
                  <span className="font-medium">Keypair Generated!</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Public Key (base58)</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-sm text-[var(--text-secondary)] break-all">
                        {getPublicKeyBase58()}
                      </code>
                      <CopyButton text={getPublicKeyBase58()} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Private Key (truncated)</div>
                    <code className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-sm text-[var(--text-muted)]">
                      {getPrivateKeyTruncated()}
                    </code>
                  </div>
                </div>
              </div>
              <button
                onClick={generateKeypair}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
              >
                Generate New Keypair
              </button>
            </div>
          )}
        </StepCard>

        {/* Step 2: Register Agent */}
        <StepCard
          stepNumber={2}
          title="Register Agent"
          description="Register your demo agent with the AgentID registry"
          isActive={currentStep === 2}
          isCompleted={currentStep > 2}
        >
          {!registeredAgent ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Register your agent with the AgentID registry. This creates a database record 
                linked to your public key, establishing the agent&apos;s identity in the ecosystem.
              </p>
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] space-y-3">
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Agent Name</div>
                  <div className="text-[var(--text-primary)] font-medium">{agentData.name}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Description</div>
                  <div className="text-sm text-[var(--text-secondary)]">{agentData.description}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Capabilities</div>
                  <div className="flex flex-wrap gap-2">
                    {agentData.capabilities.map((cap) => (
                      <span key={cap} className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleRegister}
                disabled={loading.register}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.register ? (
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
                    Register Agent
                  </>
                )}
              </button>
              <ApiCallSection
                title="See the API call"
                curl={`curl -X POST http://localhost:3000/api/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "pubkey": "${getPublicKeyBase58()}",
    "name": "${agentData.name}",
    "description": "${agentData.description}",
    "capabilities": ["demo", "testing"],
    "categories": ["utility"]
  }'`}
              />
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 mb-3">
                <CheckIcon className="w-5 h-5" />
                <span className="font-medium">Agent Registered!</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Agent ID:</span>
                  <span className="text-[var(--text-primary)] font-mono">{registeredAgent.agent?.agentId || registeredAgent.agentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Status:</span>
                  <span className="text-[var(--accent-amber)] capitalize">{registeredAgent.agent?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Registered:</span>
                  <span className="text-[var(--text-primary)]">{new Date(registeredAgent.agent?.registeredAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </StepCard>

        {/* Step 3: Challenge & Sign */}
        <StepCard
          stepNumber={3}
          title="Challenge & Sign"
          description="Prove ownership through cryptographic challenge-response"
          isActive={currentStep === 3}
          isCompleted={currentStep > 3}
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              The challenge-response protocol proves you own the private key corresponding to 
              the registered public key. The server issues a challenge, you sign it with your 
              private key, and the server verifies the signature.
            </p>

            {/* Request Challenge */}
            {!challengeData ? (
              <button
                onClick={requestChallenge}
                disabled={loading.challenge}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.challenge ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Requesting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                    Request Challenge
                  </>
                )}
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Challenge Received</span>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Challenge Message</div>
                  <code className="block px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-secondary)] break-all">
                    {challengeData.challenge}
                  </code>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Nonce</div>
                  <code className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-secondary)]">
                    {challengeData.nonce}
                  </code>
                </div>
              </div>
            )}

            {/* Sign Challenge */}
            {challengeData && !signature && (
              <div className="space-y-3">
                <button
                  onClick={signChallenge}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Sign Challenge (Auto)
                </button>
                <p className="text-xs text-[var(--text-muted)]">
                  This automatically signs the challenge using your in-browser private key with Ed25519.
                </p>
                <ApiCallSection
                  title="See the API call"
                  curl={`curl -X POST http://localhost:3000/api/verify/challenge \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${agentId}"
  }'`}
                />
              </div>
            )}

            {/* Signature Display */}
            {signature && (
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Challenge Signed</span>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Signature (base58)</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-secondary)] break-all">
                      {signature}
                    </code>
                    <CopyButton text={signature} />
                  </div>
                </div>
              </div>
            )}

            {/* Verify Signature */}
            {signature && !verificationResult && (
              <button
                onClick={verifySignature}
                disabled={loading.verify}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.verify ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify Signature
                  </>
                )}
              </button>
            )}

            {signature && (
              <ApiCallSection
                title="See the API call"
                curl={`curl -X POST http://localhost:3000/api/verify/response \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${agentId}",
    "nonce": "${challengeData?.nonce}",
    "signature": "${signature?.slice(0, 20)}..."
  }'`}
              />
            )}

            {/* Verification Result */}
            {verificationResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckIcon className="w-5 h-5" />
                  <span className="font-medium">Verification Successful!</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {verificationResult.message || 'Your identity has been cryptographically verified. The server confirmed that you possess the private key corresponding to the registered public key.'}
                </p>
              </div>
            )}
          </div>
        </StepCard>

        {/* Step 4: View Trust Badge */}
        <StepCard
          stepNumber={4}
          title="View Trust Badge"
          description="See your verified agent badge and embed options"
          isActive={currentStep === 4}
          isCompleted={currentStep > 4}
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Once verified, your agent receives a trust badge that can be displayed 
              on websites, in applications, or shared as a verifiable credential.
            </p>

            {!badgeData && (
              <button
                onClick={fetchBadge}
                disabled={loading.badge}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-purple)] hover:shadow-lg hover:shadow-[var(--accent-cyan)]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.badge ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Fetching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Load Trust Badge
                  </>
                )}
              </button>
            )}

            {badgeData && (
              <div className="space-y-6">
                {/* Trust Badge Component */}
                <TrustBadge
                  status={badgeData.status || 'verified'}
                  name={badgeData.name}
                  score={badgeData.score}
                  registeredAt={badgeData.registered_at}
                  totalActions={badgeData.total_actions}
                />

                {/* SVG Badge */}
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">SVG Badge</div>
                  <div className="flex items-center justify-center p-6 bg-[var(--bg-primary)] rounded-xl">
                    <img
                      src={`/api/badge/${agentId}/svg`}
                      alt="Agent Trust Badge"
                      className="max-w-full h-auto"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-secondary)] truncate">
                      {window.location.origin}/api/badge/{agentId}/svg
                    </code>
                    <CopyButton text={`${window.location.origin}/api/badge/${agentId}/svg`} />
                  </div>
                </div>

                {/* Embed Code */}
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Embed Code (iframe)</div>
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-all">
                      {embedCode}
                    </pre>
                    <CopyButton text={embedCode} />
                  </div>
                </div>

                <ApiCallSection
                  title="See the API call"
                  curl={`curl http://localhost:3000/api/badge/${agentId}`}
                />
              </div>
            )}
          </div>
        </StepCard>
      </div>

      {/* Reset Button */}
      <div className="mt-8 text-center">
        <button
          onClick={resetDemo}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)] transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Demo
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-6 rounded-xl bg-[var(--accent-cyan)]/5 border border-[var(--accent-cyan)]/20">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--accent-cyan)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)] mb-1">What&apos;s happening here?</p>
            <p className="mb-2">
              This demo showcases AgentID&apos;s core challenge-response verification protocol:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li><strong className="text-[var(--text-primary)]">Key Generation:</strong> An Ed25519 keypair is created in-browser using tweetnacl</li>
              <li><strong className="text-[var(--text-primary)]">Registration:</strong> The public key is registered with the AgentID service</li>
              <li><strong className="text-[var(--text-primary)]">Challenge:</strong> The server issues a unique challenge message with a nonce</li>
              <li><strong className="text-[var(--text-primary)]">Signing:</strong> The challenge is signed with the private key using Ed25519</li>
              <li><strong className="text-[var(--text-primary)]">Verification:</strong> The server verifies the signature against the public key</li>
              <li><strong className="text-[var(--text-primary)]">Badge:</strong> A trust badge is generated showing verified status</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
