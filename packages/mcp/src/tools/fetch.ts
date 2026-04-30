import axios from 'axios';
import { URL } from 'url';
import dns from 'dns/promises';
import { getClient, getAgentId } from '../client.js';
import type { ToolDefinition } from '../server.js';

function isPrivateIP(ip: string): boolean {
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (ip === '::1') return true;
  if (ip === '0:0:0:0:0:0:0:1') return true;
  if (/^f[cd]/i.test(ip)) return true;
  if (/^fe80:/i.test(ip)) return true;
  if (/^::ffff:/i.test(ip)) {
    const v4 = ip.replace(/^::ffff:/i, '');
    return isPrivateIP(v4);
  }
  return false;
}

export function registerFetchTool(): ToolDefinition[] {
  return [
    // ─── authenticated_fetch ──────────────────────────────────────────
    {
      name: 'authenticated_fetch',
      description:
        "Make an HTTP request with the agent's A2A token automatically attached. Use instead of generic HTTP fetch when calling services that accept X-AgentID-Token for identity verification.",
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
          const url = args.url as string;
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
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(url);
          } catch {
            return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid URL format' }) }], isError: true };
          }

          if (parsedUrl.protocol === 'file:') {
            return { content: [{ type: 'text', text: JSON.stringify({ error: 'file:// protocol is not allowed' }) }], isError: true };
          }

          try {
            const { address } = await dns.lookup(parsedUrl.hostname);
            if (isPrivateIP(address)) {
              return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'URL blocked: resolves to a private/internal address' }) }],
                isError: true,
              };
            }
          } catch {
            // DNS resolution failed — allow the request to proceed (axios will handle the error)
          }

          const method = (args.method as string) || 'GET';
          const body = args.body as string | undefined;
          const userHeaders = (args.headers as Record<string, string>) || {};
          const timeout = (args.timeout as number) || 10000;

          const agentId = getAgentId();
          const client = getClient();
          const token = await client.tokens.issue(agentId);

          const mergedHeaders: Record<string, string> = {
            ...userHeaders,
            'X-AgentID-Token': token.token,
            Authorization: 'Bearer ' + token.token,
          };

          const response = await axios({
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
                text: JSON.stringify(
                  {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err: any) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
            isError: true,
          };
        }
      },
    },
  ];
}
