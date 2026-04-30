"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIdentityTools = registerIdentityTools;
const crypto_1 = require("crypto");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
const axios_1 = __importDefault(require("axios"));
const config_js_1 = require("../config.js");
const client_js_1 = require("../client.js");
function registerIdentityTools() {
    return [
        // ─── register_agent ───────────────────────────────────────────────
        {
            name: 'register_agent',
            description: 'Register this AI agent with the Countersig platform and obtain a permanent cryptographic identity. Generates an Ed25519 keypair automatically. Call once on first use.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 100,
                        description: 'Human-readable name for this agent',
                    },
                    capabilities: {
                        type: 'array',
                        items: { type: 'string' },
                        description: "Capability tags, e.g. ['web-search', 'code-execution']",
                    },
                    description: {
                        type: 'string',
                        maxLength: 500,
                        description: 'Short description of what this agent does',
                    },
                    chainType: {
                        type: 'string',
                        enum: ['solana', 'ethereum', 'base', 'polygon', 'generic'],
                        default: 'generic',
                        description: 'Blockchain network for on-chain identity binding',
                    },
                },
                required: ['name'],
            },
            handler: async (args) => {
                try {
                    const name = args.name;
                    const capabilities = args.capabilities;
                    const description = args.description;
                    const chainType = args.chainType || 'generic';
                    // Generate Ed25519 keypair
                    const keypair = tweetnacl_1.default.sign.keyPair();
                    const pubkey = bs58_1.default.encode(keypair.publicKey);
                    // Create registration message
                    const nonce = (0, crypto_1.randomUUID)();
                    const timestamp = Date.now();
                    const message = `AGENTID-REGISTER:${name}:${nonce}:${timestamp}`;
                    const messageBytes = new TextEncoder().encode(message);
                    // Sign
                    const sig = tweetnacl_1.default.sign.detached(messageBytes, keypair.secretKey);
                    const signature = bs58_1.default.encode(sig);
                    // Register via SDK
                    const client = (0, client_js_1.getClient)();
                    const result = await client.agents.register({
                        credential_type: 'crypto',
                        pubkey,
                        signature,
                        message,
                        nonce,
                        name,
                        chainType,
                        capabilities,
                        description,
                    });
                    // Persist identity
                    (0, config_js_1.saveConfig)({
                        agentId: result.agentId,
                        privateKey: bs58_1.default.encode(keypair.secretKey),
                    });
                    const response = {
                        agentId: result.agentId,
                        name,
                        status: 'unverified',
                        bagsScore: result.agent?.bagsScore,
                        said: result.said,
                        publicKey: pubkey,
                        message: 'Agent registered. Call verify_agent to complete cryptographic verification.',
                    };
                    return {
                        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
                    };
                }
                catch (error) {
                    const message = error.response?.data?.error ??
                        error.message ??
                        'An unexpected error occurred';
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({ error: message, details: error.response?.data }),
                            },
                        ],
                        isError: true,
                    };
                }
            },
        },
        // ─── verify_agent ─────────────────────────────────────────────────
        {
            name: 'verify_agent',
            description: "Complete cryptographic verification of the registered agent using PKI challenge-response. Upgrades agent status from 'unverified' to 'verified'. The private key stored during registration is used automatically.",
            inputSchema: {
                type: 'object',
                properties: {
                    agentId: {
                        type: 'string',
                        description: 'Agent ID. Defaults to locally configured agent.',
                    },
                },
            },
            handler: async (args) => {
                try {
                    const agentId = (0, client_js_1.getAgentId)(args.agentId);
                    const config = (0, config_js_1.loadConfig)();
                    if (!config.privateKey) {
                        throw new Error('No private key found. Register an agent first.');
                    }
                    const secretKey = bs58_1.default.decode(config.privateKey);
                    const headers = { Authorization: `Bearer ${config.apiKey}` };
                    // Step 1: Request challenge
                    const challengeRes = await axios_1.default.post(`${config.apiUrl}/verify/challenge`, { agentId }, { headers });
                    const { challenge, nonce } = challengeRes.data;
                    // Step 2: Sign challenge
                    const challengeBytes = bs58_1.default.decode(challenge);
                    const sig = tweetnacl_1.default.sign.detached(challengeBytes, secretKey);
                    const signature = bs58_1.default.encode(sig);
                    // Step 3: Submit response
                    const verifyRes = await axios_1.default.post(`${config.apiUrl}/verify/response`, { agentId, nonce, signature }, { headers });
                    const response = {
                        agentId,
                        status: 'verified',
                        verifiedAt: verifyRes.data.timestamp,
                        message: 'Agent cryptographically verified. Reputation scoring is active.',
                    };
                    return {
                        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
                    };
                }
                catch (error) {
                    const message = error.response?.data?.error ??
                        error.message ??
                        'An unexpected error occurred';
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({ error: message, details: error.response?.data }),
                            },
                        ],
                        isError: true,
                    };
                }
            },
        },
        // ─── get_agent ────────────────────────────────────────────────────
        {
            name: 'get_agent',
            description: 'Retrieve the current status, reputation score, and metadata for an agent.',
            inputSchema: {
                type: 'object',
                properties: {
                    agentId: {
                        type: 'string',
                        description: 'Agent ID to look up. Defaults to locally configured agent.',
                    },
                },
            },
            handler: async (args) => {
                try {
                    const agentId = (0, client_js_1.getAgentId)(args.agentId);
                    const client = (0, client_js_1.getClient)();
                    const result = await client.agents.get(agentId);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                catch (error) {
                    const message = error.response?.data?.error ??
                        error.message ??
                        'An unexpected error occurred';
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({ error: message, details: error.response?.data }),
                            },
                        ],
                        isError: true,
                    };
                }
            },
        },
        // ─── get_reputation ───────────────────────────────────────────────
        {
            name: 'get_reputation',
            description: 'Get the full reputation breakdown for any agent. Use to evaluate trustworthiness before interacting.',
            inputSchema: {
                type: 'object',
                properties: {
                    agentId: {
                        type: 'string',
                        description: 'The agentId of the agent to evaluate',
                    },
                },
                required: ['agentId'],
            },
            handler: async (args) => {
                try {
                    const agentId = args.agentId;
                    const client = (0, client_js_1.getClient)();
                    const result = await client.reputation.get(agentId);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                catch (error) {
                    const message = error.response?.data?.error ??
                        error.message ??
                        'An unexpected error occurred';
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({ error: message, details: error.response?.data }),
                            },
                        ],
                        isError: true,
                    };
                }
            },
        },
    ];
}
//# sourceMappingURL=identity.js.map