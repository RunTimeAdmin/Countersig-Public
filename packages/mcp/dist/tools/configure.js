"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigureTool = registerConfigureTool;
const url_1 = require("url");
const config_js_1 = require("../config.js");
function registerConfigureTool() {
    return [
        {
            name: 'configure',
            description: 'Set or update the API key and agent ID used by all other tools. Call this first on fresh installation.',
            inputSchema: {
                type: 'object',
                properties: {
                    apiKey: {
                        type: 'string',
                        description: "Your Countersig API key from countersig.com/settings/api-keys (starts with 'cs_')",
                    },
                    agentId: {
                        type: 'string',
                        description: 'Existing agent ID to use. Leave empty if registering a new agent.',
                    },
                    apiUrl: {
                        type: 'string',
                        description: 'Override the API base URL. Default: https://api.countersig.com',
                    },
                },
            },
            handler: async (args) => {
                try {
                    const apiKey = args.apiKey;
                    const agentId = args.agentId;
                    const apiUrl = args.apiUrl;
                    if (apiKey && !apiKey.startsWith('cs_')) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        error: "Invalid API key format. Keys must start with 'cs_'.",
                                    }),
                                },
                            ],
                            isError: true,
                        };
                    }
                    // Validate apiUrl format and block private addresses
                    if (apiUrl) {
                        let parsed;
                        try {
                            parsed = new url_1.URL(apiUrl);
                        }
                        catch {
                            return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid apiUrl format' }) }], isError: true };
                        }
                        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                            return { content: [{ type: 'text', text: JSON.stringify({ error: 'apiUrl must use https:// (or http:// for local development)' }) }], isError: true };
                        }
                        if (parsed.protocol === 'https:') {
                            const host = parsed.hostname;
                            if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|\[::1\])/.test(host)) {
                                return { content: [{ type: 'text', text: JSON.stringify({ error: 'apiUrl cannot target private/internal addresses over HTTPS' }) }], isError: true };
                            }
                        }
                    }
                    const updates = {};
                    if (apiKey)
                        updates.apiKey = apiKey;
                    if (agentId)
                        updates.agentId = agentId;
                    if (apiUrl)
                        updates.apiUrl = apiUrl;
                    (0, config_js_1.saveConfig)(updates);
                    const config = (0, config_js_1.loadConfig)();
                    const maskedKey = config.apiKey
                        ? config.apiKey.slice(0, 8) + '...'
                        : undefined;
                    const result = {
                        configured: true,
                        hasApiKey: !!config.apiKey,
                        hasAgentId: !!config.agentId,
                        apiUrl: config.apiUrl,
                        configPath: (0, config_js_1.getConfigPath)(),
                        message: 'Configuration saved.',
                        ...(maskedKey ? { apiKeyPreview: maskedKey } : {}),
                    };
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
//# sourceMappingURL=configure.js.map