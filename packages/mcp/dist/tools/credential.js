"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCredentialTool = registerCredentialTool;
const client_js_1 = require("../client.js");
function registerCredentialTool() {
    return [
        // ─── get_verifiable_credential ────────────────────────────────────
        {
            name: 'get_verifiable_credential',
            description: 'Retrieve a W3C Verifiable Credential for the agent — a standards-compliant identity document for enterprise systems, identity wallets, or compliance workflows.',
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
                    const client = (0, client_js_1.getClient)();
                    const vc = await client.credentials.get(agentId);
                    const result = vc;
                    if (vc.demo === true) {
                        result._note =
                            'This credential is unsigned (demo mode). Signature implementation is pending.';
                    }
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
//# sourceMappingURL=credential.js.map