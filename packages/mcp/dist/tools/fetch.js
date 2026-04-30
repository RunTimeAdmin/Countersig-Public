"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFetchTool = registerFetchTool;
const axios_1 = __importDefault(require("axios"));
const url_1 = require("url");
const promises_1 = __importDefault(require("dns/promises"));
const client_js_1 = require("../client.js");
function isPrivateIP(ip) {
    if (/^127\./.test(ip))
        return true;
    if (/^10\./.test(ip))
        return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip))
        return true;
    if (/^192\.168\./.test(ip))
        return true;
    if (/^169\.254\./.test(ip))
        return true;
    if (/^0\./.test(ip))
        return true;
    if (ip === '::1')
        return true;
    if (ip === '0:0:0:0:0:0:0:1')
        return true;
    if (/^f[cd]/i.test(ip))
        return true;
    if (/^fe80:/i.test(ip))
        return true;
    if (/^::ffff:/i.test(ip)) {
        const v4 = ip.replace(/^::ffff:/i, '');
        return isPrivateIP(v4);
    }
    return false;
}
function registerFetchTool() {
    return [
        // ─── authenticated_fetch ──────────────────────────────────────────
        {
            name: 'authenticated_fetch',
            description: "Make an HTTP request with the agent's A2A token automatically attached. Use instead of generic HTTP fetch when calling services that accept X-AgentID-Token for identity verification.",
            inputSchema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The URL to fetch',
                    },
                    method: {
                        type: 'string',
                        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                        default: 'GET',
                        description: 'HTTP method',
                    },
                    body: {
                        type: 'string',
                        description: 'Request body as JSON string (for POST/PUT/PATCH)',
                    },
                    headers: {
                        type: 'object',
                        description: 'Additional headers. X-AgentID-Token is added automatically.',
                    },
                    timeout: {
                        type: 'number',
                        minimum: 1000,
                        maximum: 30000,
                        default: 10000,
                        description: 'Request timeout in milliseconds',
                    },
                },
                required: ['url'],
            },
            handler: async (args) => {
                try {
                    // SSRF protection — block private/internal addresses
                    const BLOCKED = [
                        /^https?:\/\/localhost/i,
                        /^https?:\/\/127\./,
                        /^https?:\/\/0\./,
                        /^https?:\/\/10\./,
                        /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
                        /^https?:\/\/192\.168\./,
                        /^https?:\/\/169\.254\./,
                        /^https?:\/\/\[::1\]/,
                        /^file:\/\//i,
                    ];
                    const url = args.url;
                    if (BLOCKED.some((p) => p.test(url))) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({ error: 'URL blocked: private/internal addresses are not allowed' }),
                                },
                            ],
                            isError: true,
                        };
                    }
                    // DNS pre-resolve to catch decimal/hex/octal IP bypasses
                    let parsedUrl;
                    try {
                        parsedUrl = new url_1.URL(url);
                    }
                    catch {
                        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid URL format' }) }], isError: true };
                    }
                    if (parsedUrl.protocol === 'file:') {
                        return { content: [{ type: 'text', text: JSON.stringify({ error: 'file:// protocol is not allowed' }) }], isError: true };
                    }
                    try {
                        const { address } = await promises_1.default.lookup(parsedUrl.hostname);
                        if (isPrivateIP(address)) {
                            return {
                                content: [{ type: 'text', text: JSON.stringify({ error: 'URL blocked: resolves to a private/internal address' }) }],
                                isError: true,
                            };
                        }
                    }
                    catch {
                        // DNS resolution failed — allow the request to proceed (axios will handle the error)
                    }
                    const method = args.method || 'GET';
                    const body = args.body;
                    const userHeaders = args.headers || {};
                    const timeout = args.timeout || 10000;
                    const agentId = (0, client_js_1.getAgentId)();
                    const client = (0, client_js_1.getClient)();
                    const token = await client.tokens.issue(agentId);
                    const mergedHeaders = {
                        ...userHeaders,
                        'X-AgentID-Token': token.token,
                        Authorization: 'Bearer ' + token.token,
                    };
                    const response = await (0, axios_1.default)({
                        url,
                        method,
                        data: body ? JSON.parse(body) : undefined,
                        headers: mergedHeaders,
                        timeout,
                        validateStatus: () => true,
                    });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: response.headers,
                                    body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                                }, null, 2),
                            },
                        ],
                    };
                }
                catch (err) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
                        isError: true,
                    };
                }
            },
        },
    ];
}
//# sourceMappingURL=fetch.js.map