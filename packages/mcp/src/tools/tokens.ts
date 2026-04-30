import { getClient, getAgentId } from '../client.js';
import type { ToolDefinition } from '../server.js';

export function registerTokenTools(): ToolDefinition[] {
  return [
    // ─── issue_a2a_token ──────────────────────────────────────────────
    {
      name: 'issue_a2a_token',
      description:
        'Issue a short-lived (60-second) A2A JWT that proves this agent\'s identity to another Countersig-integrated service. Issue immediately before use — do not cache tokens.',
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
          const id = getAgentId(args.agentId as string | undefined);
          const client = getClient();
          const result = await client.tokens.issue(id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    token: result.token,
                    expiresIn: result.expiresIn,
                    agentId: result.agentId,
                    issuedAt: result.issuedAt,
                    usage:
                      "Attach this token as 'Authorization: Bearer <token>' or 'X-Countersig-Token: <token>' on your next request",
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

    // ─── verify_a2a_token ─────────────────────────────────────────────
    {
      name: 'verify_a2a_token',
      description:
        "Verify an A2A token received from another agent. Confirms the calling agent's identity before acting on its request.",
      inputSchema: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'The A2A JWT token to verify',
          },
        },
        required: ['token'],
      },
      handler: async (args) => {
        try {
          const client = getClient();
          const result = await client.tokens.verify(args.token as string);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
