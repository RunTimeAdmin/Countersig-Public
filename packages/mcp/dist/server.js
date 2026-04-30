"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCountersigServer = createCountersigServer;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const identity_js_1 = require("./tools/identity.js");
const tokens_js_1 = require("./tools/tokens.js");
const fetch_js_1 = require("./tools/fetch.js");
const badge_js_1 = require("./tools/badge.js");
const attest_js_1 = require("./tools/attest.js");
const configure_js_1 = require("./tools/configure.js");
const credential_js_1 = require("./tools/credential.js");
function createCountersigServer() {
    const server = new index_js_1.Server({ name: 'countersig', version: '1.0.0' }, { capabilities: { tools: {} } });
    // Collect all tool definitions
    const allTools = [
        ...(0, identity_js_1.registerIdentityTools)(),
        ...(0, tokens_js_1.registerTokenTools)(),
        ...(0, fetch_js_1.registerFetchTool)(),
        ...(0, badge_js_1.registerBadgeTool)(),
        ...(0, attest_js_1.registerAttestTool)(),
        ...(0, configure_js_1.registerConfigureTool)(),
        ...(0, credential_js_1.registerCredentialTool)(),
    ];
    // tools/list handler
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
        tools: allTools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        })),
    }));
    // tools/call handler
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const tool = allTools.find((t) => t.name === request.params.name);
        if (!tool) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${request.params.name}` }) }],
                isError: true,
            };
        }
        return tool.handler((request.params.arguments ?? {}));
    });
    return server;
}
//# sourceMappingURL=server.js.map