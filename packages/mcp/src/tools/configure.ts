import { URL } from 'url';
import { loadConfig, saveConfig, getConfigPath } from '../config.js';
import type { ToolDefinition } from '../server.js';

export function registerConfigureTool(): ToolDefinition[] {
  return [
    {
      name: 'configure',
      description:
        'Set or update the API key and agent ID used by all other tools. Call this first on fresh installation.',
      inputSchema: {
        type: 'object',
        properties: {
          apiKey: {
            type: 'string',
            description:
              "Your AgentID API key from agentidapp.com/settings/api-keys (starts with 'aid_')",
          },
          agentId: {
            type: 'string',
            description:
              'Existing agent ID to use. Leave empty if registering a new agent.',
          },
          apiUrl: {
            type: 'string',
            description:
              'Override the API base URL. Default: https://api.agentidapp.com',
          },
        },
      },
      handler: async (args) => {
        try {
          const apiKey = args.apiKey as string | undefined;
          const agentId = args.agentId as string | undefined;
          const apiUrl = args.apiUrl as string | undefined;

          if (apiKey && !apiKey.startsWith('aid_')) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: "Invalid API key format. Keys must start with 'aid_'.",
                  }),
                },
              ],
              isError: true,
            };
          }

          // Validate apiUrl format and block private addresses
          if (apiUrl) {
            let parsed: URL;
            try {
              parsed = new URL(apiUrl as string);
            } catch {
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

          const updates: Record<string, string> = {};
          if (apiKey) updates.apiKey = apiKey;
          if (agentId) updates.agentId = agentId;
          if (apiUrl) updates.apiUrl = apiUrl;

          saveConfig(updates);
          const config = loadConfig();

          const maskedKey = config.apiKey
            ? config.apiKey.slice(0, 8) + '...'
            : undefined;

          const result = {
            configured: true,
            hasApiKey: !!config.apiKey,
            hasAgentId: !!config.agentId,
            apiUrl: config.apiUrl,
            configPath: getConfigPath(),
            message: 'Configuration saved.',
            ...(maskedKey ? { apiKeyPreview: maskedKey } : {}),
          };

          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: any) {
          const message =
            error.response?.data?.error ??
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
