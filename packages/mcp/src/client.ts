import { CountersigClient } from '@countersig/sdk';
import { loadConfig } from './config.js';

export function getClient(): CountersigClient {
  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error(
      'Countersig API key not configured. ' +
      'Call the configure tool with your API key from countersig.com/settings/api-keys, ' +
      'or set COUNTERSIG_API_KEY environment variable.'
    );
  }

  return new CountersigClient({
    apiKey: config.apiKey,
    apiUrl: config.apiUrl,
  });
}

export function getAgentId(override?: string): string {
  if (override) return override;
  const config = loadConfig();
  if (!config.agentId) {
    throw new Error(
      'No agent ID configured. ' +
      'Call register_agent to create a new agent, or configure with an existing agentId.'
    );
  }
  return config.agentId;
}
