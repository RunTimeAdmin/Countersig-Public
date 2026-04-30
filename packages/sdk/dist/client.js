"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentIDClient = void 0;
const axios_1 = __importDefault(require("axios"));
class AgentIDClient {
    constructor(options = {}) {
        const baseURL = options.apiUrl || 'https://api.agentidapp.com';
        const timeout = options.timeout || 10000;
        const headers = {
            'Content-Type': 'application/json'
        };
        if (options.apiKey) {
            headers['Authorization'] = `Bearer ${options.apiKey}`;
        }
        else if (options.accessToken) {
            headers['Authorization'] = `Bearer ${options.accessToken}`;
        }
        this.http = axios_1.default.create({ baseURL, timeout, headers });
        this.agents = new AgentsAPI(this.http);
        this.badges = new BadgesAPI(this.http);
        this.reputation = new ReputationAPI(this.http);
        this.tokens = new TokensAPI(this.http);
        this.credentials = new CredentialsAPI(this.http);
        this.chains = new ChainsAPI(this.http);
        this.attestations = new AttestationsAPI(this.http);
    }
    /** Update authentication credentials */
    setAuth(options) {
        if (options.apiKey) {
            this.http.defaults.headers.common['Authorization'] = `Bearer ${options.apiKey}`;
        }
        else if (options.accessToken) {
            this.http.defaults.headers.common['Authorization'] = `Bearer ${options.accessToken}`;
        }
    }
}
exports.AgentIDClient = AgentIDClient;
class AgentsAPI {
    constructor(http) {
        this.http = http;
    }
    /** Register a new agent */
    async register(data) {
        const res = await this.http.post('/register', data);
        return res.data;
    }
    /** Get a single agent with reputation */
    async get(agentId) {
        const res = await this.http.get(`/agents/${agentId}`);
        return res.data;
    }
    /** List agents with optional filters */
    async list(params) {
        const res = await this.http.get('/agents', { params });
        return res.data;
    }
    /** List public agents (no authentication required) */
    async listPublic(params) {
        const res = await this.http.get('/public/agents', { params });
        return res.data;
    }
    /** Get agents owned by a public key */
    async getByOwner(pubkey) {
        const res = await this.http.get(`/agents/owner/${pubkey}`);
        return res.data;
    }
    /** Update agent metadata */
    async update(agentId, data) {
        const res = await this.http.put(`/agents/${agentId}/update`, data);
        return res.data;
    }
    /** Revoke an agent */
    async revoke(agentId, data) {
        const res = await this.http.post(`/agents/${agentId}/revoke`, data);
        return res.data;
    }
    /** Discover agents by capability */
    async discover(params) {
        const res = await this.http.get('/discover', { params });
        return res.data;
    }
    /** List agents for a specific organization */
    async listByOrg(orgId, params) {
        const res = await this.http.get(`/orgs/${orgId}/agents`, { params });
        return res.data;
    }
}
class BadgesAPI {
    constructor(http) {
        this.http = http;
    }
    /** Get badge data as JSON */
    async get(agentId) {
        const res = await this.http.get(`/badge/${agentId}`);
        return res.data;
    }
    /** Get badge as SVG string */
    async getSVG(agentId) {
        const res = await this.http.get(`/badge/${agentId}/svg`, {
            responseType: 'text'
        });
        return res.data;
    }
}
class ReputationAPI {
    constructor(http) {
        this.http = http;
    }
    /** Get full reputation breakdown for an agent */
    async get(agentId) {
        const res = await this.http.get(`/reputation/${agentId}`);
        return res.data;
    }
}
class TokensAPI {
    constructor(http) {
        this.http = http;
    }
    /** Issue a short-lived A2A token for cross-agent communication */
    async issue(agentId) {
        const res = await this.http.post(`/agents/${agentId}/issue-token`);
        return res.data;
    }
    /** Verify an A2A token */
    async verify(token) {
        const res = await this.http.post('/agents/verify-token', { token });
        return res.data;
    }
}
class CredentialsAPI {
    constructor(http) {
        this.http = http;
    }
    /** Get a W3C Verifiable Credential for an agent */
    async get(agentId) {
        const res = await this.http.get(`/agents/${agentId}/credential`);
        return res.data;
    }
}
class ChainsAPI {
    constructor(http) {
        this.http = http;
    }
    /** List all supported chain types */
    async list() {
        const res = await this.http.get('/agents/chains');
        return res.data;
    }
}
class AttestationsAPI {
    constructor(http) {
        this.http = http;
    }
    /** Record a successful or failed action attestation */
    async attest(agentId, data) {
        const res = await this.http.post(`/agents/${agentId}/attest`, data);
        return res.data;
    }
    /** Get action stats for an agent */
    async get(agentId) {
        const res = await this.http.get(`/agents/${agentId}/attestations`);
        return res.data;
    }
    /** Flag an agent for suspicious behavior */
    async flag(agentId, data) {
        const res = await this.http.post(`/agents/${agentId}/flag`, data);
        return res.data;
    }
    /** Get flags for an agent */
    async getFlags(agentId) {
        const res = await this.http.get(`/agents/${agentId}/flags`);
        return res.data;
    }
}
