import axios, { AxiosInstance } from 'axios';
import type {
  Agent, AgentRegistration, Badge,
  ReputationScore, A2AToken, VerifiableCredential,
  Chain, Challenge, Attestation, AttestationResult,
  FlagResult, AgentListResponse, AgentDetailResponse,
  DiscoverResponse, ChainsResponse
} from './types';

export interface AgentIDClientOptions {
  /** API base URL. Default: https://api.agentidapp.com */
  apiUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** JWT access token for authentication */
  accessToken?: string;
  /** Request timeout in ms. Default: 10000 */
  timeout?: number;
}

export class AgentIDClient {
  private http: AxiosInstance;
  public agents: AgentsAPI;
  public badges: BadgesAPI;
  public reputation: ReputationAPI;
  public tokens: TokensAPI;
  public credentials: CredentialsAPI;
  public chains: ChainsAPI;
  public attestations: AttestationsAPI;

  constructor(options: AgentIDClientOptions = {}) {
    const baseURL = options.apiUrl || 'https://api.agentidapp.com';
    const timeout = options.timeout || 10000;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    } else if (options.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`;
    }

    this.http = axios.create({ baseURL, timeout, headers });

    this.agents = new AgentsAPI(this.http);
    this.badges = new BadgesAPI(this.http);
    this.reputation = new ReputationAPI(this.http);
    this.tokens = new TokensAPI(this.http);
    this.credentials = new CredentialsAPI(this.http);
    this.chains = new ChainsAPI(this.http);
    this.attestations = new AttestationsAPI(this.http);
  }

  /** Update authentication credentials */
  setAuth(options: { apiKey?: string; accessToken?: string }) {
    if (options.apiKey) {
      this.http.defaults.headers.common['Authorization'] = `Bearer ${options.apiKey}`;
    } else if (options.accessToken) {
      this.http.defaults.headers.common['Authorization'] = `Bearer ${options.accessToken}`;
    }
  }
}

class AgentsAPI {
  constructor(private http: AxiosInstance) {}

  /** Register a new agent */
  async register(data: AgentRegistration): Promise<{ agent: Agent; agentId: string; said: { registered: boolean; error?: string } }> {
    const res = await this.http.post('/register', data);
    return res.data;
  }

  /** Get a single agent with reputation */
  async get(agentId: string): Promise<AgentDetailResponse> {
    const res = await this.http.get(`/agents/${agentId}`);
    return res.data;
  }

  /** List agents with optional filters */
  async list(params?: { status?: string; capability?: string; limit?: number; offset?: number; includeDemo?: boolean }): Promise<AgentListResponse> {
    const res = await this.http.get('/agents', { params });
    return res.data;
  }

  /** List public agents (no authentication required) */
  async listPublic(params?: { status?: string; capability?: string; limit?: number; offset?: number }): Promise<AgentListResponse> {
    const res = await this.http.get('/public/agents', { params });
    return res.data;
  }

  /** Get agents owned by a public key */
  async getByOwner(pubkey: string): Promise<{ pubkey: string; agents: Agent[]; count: number }> {
    const res = await this.http.get(`/agents/owner/${pubkey}`);
    return res.data;
  }

  /** Update agent metadata */
  async update(agentId: string, data: { name?: string; description?: string; capabilities?: string[]; tokenMint?: string; creatorX?: string; signature: string; timestamp: number }): Promise<{ agent: Agent }> {
    const res = await this.http.put(`/agents/${agentId}/update`, data);
    return res.data;
  }

  /** Revoke an agent */
  async revoke(agentId: string, data: { pubkey: string; signature: string; message: string }): Promise<{ success: boolean; message: string; agent: Agent; revokedAt: string }> {
    const res = await this.http.post(`/agents/${agentId}/revoke`, data);
    return res.data;
  }

  /** Discover agents by capability */
  async discover(params: { capability: string }): Promise<DiscoverResponse> {
    const res = await this.http.get('/discover', { params });
    return res.data;
  }

  /** List agents for a specific organization */
  async listByOrg(orgId: string, params?: { status?: string; capability?: string; limit?: number; offset?: number; includeDemo?: boolean }): Promise<AgentListResponse> {
    const res = await this.http.get(`/orgs/${orgId}/agents`, { params });
    return res.data;
  }
}

class BadgesAPI {
  constructor(private http: AxiosInstance) {}

  /** Get badge data as JSON */
  async get(agentId: string): Promise<Badge> {
    const res = await this.http.get(`/badge/${agentId}`);
    return res.data;
  }

  /** Get badge as SVG string */
  async getSVG(agentId: string): Promise<string> {
    const res = await this.http.get(`/badge/${agentId}/svg`, {
      responseType: 'text'
    });
    return res.data;
  }
}

class ReputationAPI {
  constructor(private http: AxiosInstance) {}

  /** Get full reputation breakdown for an agent */
  async get(agentId: string): Promise<ReputationScore> {
    const res = await this.http.get(`/reputation/${agentId}`);
    return res.data;
  }
}

class TokensAPI {
  constructor(private http: AxiosInstance) {}

  /** Issue a short-lived A2A token for cross-agent communication */
  async issue(agentId: string): Promise<A2AToken> {
    const res = await this.http.post(`/agents/${agentId}/issue-token`);
    return res.data;
  }

  /** Verify an A2A token */
  async verify(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    const res = await this.http.post('/agents/verify-token', { token });
    return res.data;
  }
}

class CredentialsAPI {
  constructor(private http: AxiosInstance) {}

  /** Get a W3C Verifiable Credential for an agent */
  async get(agentId: string): Promise<VerifiableCredential> {
    const res = await this.http.get(`/agents/${agentId}/credential`);
    return res.data;
  }
}

class ChainsAPI {
  constructor(private http: AxiosInstance) {}

  /** List all supported chain types */
  async list(): Promise<ChainsResponse> {
    const res = await this.http.get('/agents/chains');
    return res.data;
  }
}

class AttestationsAPI {
  constructor(private http: AxiosInstance) {}

  /** Record a successful or failed action attestation */
  async attest(agentId: string, data: { success: boolean; action?: string }): Promise<Attestation> {
    const res = await this.http.post(`/agents/${agentId}/attest`, data);
    return res.data;
  }

  /** Get action stats for an agent */
  async get(agentId: string): Promise<AttestationResult> {
    const res = await this.http.get(`/agents/${agentId}/attestations`);
    return res.data;
  }

  /** Flag an agent for suspicious behavior */
  async flag(agentId: string, data: { reporterPubkey: string; signature: string; timestamp: number; reason: string; evidence?: string }): Promise<FlagResult> {
    const res = await this.http.post(`/agents/${agentId}/flag`, data);
    return res.data;
  }

  /** Get flags for an agent */
  async getFlags(agentId: string): Promise<{ agentId: string; pubkey: string; flags: any[]; count: number }> {
    const res = await this.http.get(`/agents/${agentId}/flags`);
    return res.data;
  }
}
