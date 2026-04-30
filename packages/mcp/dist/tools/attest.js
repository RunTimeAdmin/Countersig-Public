"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAttestTool = registerAttestTool;
const client_js_1 = require("../client.js");
function registerAttestTool() {
    return [
        // ─── attest_action ────────────────────────────────────────────────
        {
            name: 'attest_action',
            description: "Record a successful or failed action to the agent's behavioral history. Regular attestation improves the agent's BAGS reputation score over time.",
            inputSchema: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        description: 'Whether the action was successful',
                    },
                    action: {
                        type: 'string',
                        maxLength: 100,
                        description: "Short action description, e.g. 'web-search', 'code-execution'",
                    },
                    agentId: {
                        type: 'string',
                        description: 'Agent ID. Defaults to locally configured agent.',
                    },
                },
                required: ['success'],
            },
            handler: async (args) => {
                try {
                    const agentId = (0, client_js_1.getAgentId)(args.agentId);
                    const client = (0, client_js_1.getClient)();
                    const result = await client.attestations.attest(agentId, {
                        success: args.success,
                        action: args.action,
                    });
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
//# sourceMappingURL=attest.js.map