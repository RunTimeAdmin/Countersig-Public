import { AxiosInstance } from 'axios';
import type { Agent, AgentRegistration, Badge, ReputationScore, A2AToken, VerifiableCredential, Attestation, AttestationResult, FlagResult, AgentListResponse, AgentDetailResponse, DiscoverResponse, ChainsResponse } from './types';
export interface CountersigClientOptions {
    /** API base URL. Default: https://api.countersig.com */
    apiUrl?: string;
    /** API key for authentication */
    apiKey?: string;
    /** JWT access token for authentication */
    accessToken?: string;
    /** Request timeout in ms. Default: 10000 */
    timeout?: number;
}
export declare class CountersigClient {
    private http;
    agents: AgentsAPI;
    badges: BadgesAPI;
    reputation: ReputationAPI;
    tokens: TokensAPI;
    credentials: CredentialsAPI;
    chains: ChainsAPI;
    attestations: AttestationsAPI;
    constructor(options?: CountersigClientOptions);
    /** Update authentication credentials */
    setAuth(options: {
        apiKey?: string;
        accessToken?: string;
    }): void;
}
declare class AgentsAPI {
    private http;
    constructor(http: AxiosInstance);
    /** Register a new agent */
    register(data: AgentRegistration): Promise<{
        agent: Agent;
        agentId: string;
        said: {
            registered: boolean;
            error?: string;
        };
    }>;
    /** Get a single agent with reputation */
    get(agentId: string): Promise<AgentDetailResponse>;
    /** List agents with optional filters */
    list(params?: {
        status?: string;
        capability?: string;
        limit?: number;
        offset?: number;
        includeDemo?: boolean;
    }): Promise<AgentListResponse>;
    /** List public agents (no authentication required) */
    listPublic(params?: {
        status?: string;
        capability?: string;
        limit?: number;
        offset?: number;
    }): Promise<AgentListResponse>;
    /** Get agents owned by a public key */
    getByOwner(pubkey: string): Promise<{
        pubkey: string;
        agents: Agent[];
        count: number;
    }>;
    /** Update agent metadata */
    update(agentId: string, data: {
        name?: string;
        description?: string;
        capabilities?: string[];
        tokenMint?: string;
        creatorX?: string;
        signature: string;
        timestamp: number;
    }): Promise<{
        agent: Agent;
    }>;
    /** Revoke an agent */
    revoke(agentId: string, data: {
        pubkey: string;
        signature: string;
        message: string;
    }): Promise<{
        success: boolean;
        message: string;
        agent: Agent;
        revokedAt: string;
    }>;
    /** Discover agents by capability */
    discover(params: {
        capability: string;
    }): Promise<DiscoverResponse>;
    /** List agents for a specific organization */
    listByOrg(orgId: string, params?: {
        status?: string;
        capability?: string;
        limit?: number;
        offset?: number;
        includeDemo?: boolean;
    }): Promise<AgentListResponse>;
}
declare class BadgesAPI {
    private http;
    constructor(http: AxiosInstance);
    /** Get badge data as JSON */
    get(agentId: string): Promise<Badge>;
    /** Get badge as SVG string */
    getSVG(agentId: string): Promise<string>;
}
declare class ReputationAPI {
    private http;
    constructor(http: AxiosInstance);
    /** Get full reputation breakdown for an agent */
    get(agentId: string): Promise<ReputationScore>;
}
declare class TokensAPI {
    private http;
    constructor(http: AxiosInstance);
    /** Issue a short-lived A2A token for cross-agent communication */
    issue(agentId: string): Promise<A2AToken>;
    /** Verify an A2A token */
    verify(token: string): Promise<{
        valid: boolean;
        payload?: any;
        error?: string;
    }>;
}
declare class CredentialsAPI {
    private http;
    constructor(http: AxiosInstance);
    /** Get a W3C Verifiable Credential for an agent */
    get(agentId: string): Promise<VerifiableCredential>;
}
declare class ChainsAPI {
    private http;
    constructor(http: AxiosInstance);
    /** List all supported chain types */
    list(): Promise<ChainsResponse>;
}
declare class AttestationsAPI {
    private http;
    constructor(http: AxiosInstance);
    /** Record a successful or failed action attestation */
    attest(agentId: string, data: {
        success: boolean;
        action?: string;
    }): Promise<Attestation>;
    /** Get action stats for an agent */
    get(agentId: string): Promise<AttestationResult>;
    /** Flag an agent for suspicious behavior */
    flag(agentId: string, data: {
        reporterPubkey: string;
        signature: string;
        timestamp: number;
        reason: string;
        evidence?: string;
    }): Promise<FlagResult>;
    /** Get flags for an agent */
    getFlags(agentId: string): Promise<{
        agentId: string;
        pubkey: string;
        flags: any[];
        count: number;
    }>;
}
export {};
