"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBadgeTool = registerBadgeTool;
const client_js_1 = require("../client.js");
function registerBadgeTool() {
    return [
        // ─── get_trust_badge ──────────────────────────────────────────────
        {
            name: 'get_trust_badge',
            description: "Retrieve the agent's trust badge as JSON or SVG for embedding in responses, web pages, or documentation.",
            inputSchema: {
                type: 'object',
                properties: {
                    agentId: {
                        type: 'string',
                        description: 'Agent ID. Defaults to locally configured agent.',
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'svg'],
                        default: 'json',
                        description: "'json' for structured data, 'svg' for embeddable image",
                    },
                },
            },
            handler: async (args) => {
                try {
                    const agentId = (0, client_js_1.getAgentId)(args.agentId);
                    const client = (0, client_js_1.getClient)();
                    const format = args.format || 'json';
                    if (format === 'svg') {
                        const svg = await client.badges.getSVG(agentId);
                        return { content: [{ type: 'text', text: svg }] };
                    }
                    const badge = await client.badges.get(agentId);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(badge, null, 2) }],
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
//# sourceMappingURL=badge.js.map