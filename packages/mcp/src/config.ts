import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.countersig');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface Config {
  apiKey?: string;
  agentId?: string;
  apiUrl: string;
  privateKey?: string;  // Base58-encoded Ed25519 private key from registration
}

const DEFAULT_CONFIG: Config = {
  apiUrl: 'https://api.countersig.com',
};

export function loadConfig(): Config {
  // Environment variables take precedence
  const envConfig: Partial<Config> = {};
  if (process.env.COUNTERSIG_API_KEY) envConfig.apiKey = process.env.COUNTERSIG_API_KEY;
  if (process.env.COUNTERSIG_AGENT_ID) envConfig.agentId = process.env.COUNTERSIG_AGENT_ID;
  if (process.env.COUNTERSIG_API_URL) envConfig.apiUrl = process.env.COUNTERSIG_API_URL;

  // Read file config if present
  let fileConfig: Partial<Config> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      // Ignore parse errors — fall back to defaults
    }
  }

  return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig };
}

export function saveConfig(updates: Partial<Config>): void {
  const current = loadConfig();
  const next = { ...current, ...updates };

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    if (platform() !== 'win32') {
      try { chmodSync(CONFIG_DIR, 0o700); } catch { /* best effort */ }
    }
  }

  const content = JSON.stringify(next, null, 2);
  writeFileSync(CONFIG_FILE, content, { encoding: 'utf-8' });
  
  // Protect API key — owner read/write only (no-op on Windows)
  if (platform() !== 'win32') {
    try { chmodSync(CONFIG_FILE, 0o600); } catch { /* best effort */ }
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
