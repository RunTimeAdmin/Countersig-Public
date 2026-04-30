export interface Agent {
  agentId: string;
  name: string;
  pubkey: string;
  status: 'verified' | 'unverified' | 'flagged' | 'revoked';
  chainType: string;
  capabilities: string[];
  bagsScore: number;
  tokenMint?: string;
  description?: string;
  registeredAt: string;
  lastVerified?: string;
  revokedAt?: string;
  orgId?: string;
  creatorX?: string;
  creatorWallet?: string;
  isDemo?: boolean;
  totalActions?: number;
  successfulActions?: number;
  failedActions?: number;
}

export interface AgentRegistration {
  pubkey: string;
  name: string;
  message: string;
  signature: string;
  nonce: string;
  capabilities?: string[];
  description?: string;
  tokenMint?: string;
  chainType?: string;
  creatorX?: string;
  creatorWallet?: string;
}

export type BadgeFormat = 'json' | 'svg' | 'html';

export interface Badge {
  agentId: string;
  name: string;
  pubkey: string;
  status: string;
  badge: string;
  label: string;
  tier: string;
  tierColor: string;
  score: number;
  bags_score: number;
  saidTrustScore: number;
  saidLabel: string;
  registeredAt: string;
  lastVerified?: string;
  revokedAt?: string;
  totalActions: number;
  successRate: number;
  capabilities: string[];
  tokenMint?: string;
  widgetUrl: string;
}

export interface ReputationBreakdown {
  feeActivity?: number | { score: number; max: number };
  successRate?: number | { score: number; max: number };
  age?: number | { score: number; max: number };
  saidTrust?: number | { score: number; max: number };
  community?: number | { score: number; max: number };
  [factor: string]: unknown;
}

export interface ReputationScore {
  agentId: string;
  pubkey: string;
  score: number;
  label: string;
  breakdown: ReputationBreakdown;
}

export interface A2AToken {
  token: string;
  expiresIn: number;
  agentId: string;
  issuedAt: string;
}

export interface A2ATokenPayload {
  sub: string;
  type: 'a2a';
  name: string;
  pubkey: string;
  chain: string;
  caps: string[];
  score: number;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface VerifiableCredential {
  '@context': any[];
  id: string;
  type: string[];
  issuer: { id: string; name: string; url: string };
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: Record<string, any>;
  credentialStatus: {
    id: string;
    type: string;
    statusPurpose: string;
  };
  proof: Record<string, any>;
  /** True when the credential is unsigned (signing not yet implemented). Consumers MUST check this field. */
  demo?: boolean;
  /** Human-readable warning when credential is unsigned. */
  warning?: string;
}

export interface Chain {
  chainType: string;
  name: string;
  chainId: string;
  addressFormat: string;
  signingAlgo: string;
}

export interface Challenge {
  challengeId: string;
  agentId: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface Attestation {
  agentId: string;
  pubkey: string;
  success: boolean;
  action: string | null;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  bagsScore: number;
}

export interface AttestationResult {
  agentId: string;
  pubkey: string;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  bagsScore: number;
}

export interface Flag {
  id: string;
  agentId: string;
  pubkey: string;
  reporterPubkey: string;
  reason: string;
  evidence?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface FlagResult {
  flag: Flag;
  agentId: string;
  unresolved_flags: number;
  auto_flagged: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgentDetailResponse {
  agent: Agent;
  reputation: {
    score: number;
    label: string;
    breakdown: ReputationBreakdown;
  };
}

export interface DiscoverResponse {
  agents: Agent[];
  capability: string;
  count: number;
}

export interface ChainsResponse {
  chains: Chain[];
  count: number;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export interface Policy {
  id: string;
  name: string;
  condition: Record<string, any>;
  action: Record<string, any>;
  enabled: boolean;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}
