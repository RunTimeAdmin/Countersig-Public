"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.getConfigPath = getConfigPath;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const CONFIG_DIR = (0, path_1.join)((0, os_1.homedir)(), '.countersig');
const CONFIG_FILE = (0, path_1.join)(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = {
    apiUrl: 'https://api.countersig.com',
};
function loadConfig() {
    // Environment variables take precedence
    const envConfig = {};
    if (process.env.COUNTERSIG_API_KEY)
        envConfig.apiKey = process.env.COUNTERSIG_API_KEY;
    if (process.env.COUNTERSIG_AGENT_ID)
        envConfig.agentId = process.env.COUNTERSIG_AGENT_ID;
    if (process.env.COUNTERSIG_API_URL)
        envConfig.apiUrl = process.env.COUNTERSIG_API_URL;
    // Read file config if present
    let fileConfig = {};
    if ((0, fs_1.existsSync)(CONFIG_FILE)) {
        try {
            fileConfig = JSON.parse((0, fs_1.readFileSync)(CONFIG_FILE, 'utf-8'));
        }
        catch {
            // Ignore parse errors — fall back to defaults
        }
    }
    return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig };
}
function saveConfig(updates) {
    const current = loadConfig();
    const next = { ...current, ...updates };
    if (!(0, fs_1.existsSync)(CONFIG_DIR)) {
        (0, fs_1.mkdirSync)(CONFIG_DIR, { recursive: true });
        if ((0, os_1.platform)() !== 'win32') {
            try {
                (0, fs_1.chmodSync)(CONFIG_DIR, 0o700);
            }
            catch { /* best effort */ }
        }
    }
    const content = JSON.stringify(next, null, 2);
    (0, fs_1.writeFileSync)(CONFIG_FILE, content, { encoding: 'utf-8' });
    // Protect API key — owner read/write only (no-op on Windows)
    if ((0, os_1.platform)() !== 'win32') {
        try {
            (0, fs_1.chmodSync)(CONFIG_FILE, 0o600);
        }
        catch { /* best effort */ }
    }
}
function getConfigPath() {
    return CONFIG_FILE;
}
//# sourceMappingURL=config.js.map