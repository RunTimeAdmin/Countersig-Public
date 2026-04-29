"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClient = getClient;
exports.getAgentId = getAgentId;
const sdk_1 = require("@agentidapp/sdk");
const config_js_1 = require("./config.js");
function getClient() {
    const config = (0, config_js_1.loadConfig)();
    if (!config.apiKey) {
        throw new Error('AgentID API key not configured. ' +
            'Call the configure tool with your API key from agentidapp.com/settings/api-keys, ' +
            'or set AGENTID_API_KEY environment variable.');
    }
    return new sdk_1.AgentIDClient({
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
    });
}
function getAgentId(override) {
    if (override)
        return override;
    const config = (0, config_js_1.loadConfig)();
    if (!config.agentId) {
        throw new Error('No agent ID configured. ' +
            'Call register_agent to create a new agent, or configure with an existing agentId.');
    }
    return config.agentId;
}
//# sourceMappingURL=client.js.map