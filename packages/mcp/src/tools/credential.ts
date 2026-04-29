import { getClient, getAgentId } from '../client.js';
import type { ToolDefinition } from '../server.js';

export function registerCredentialTool(): ToolDefinition[] {
  return [
    // ─── get_verifiable_credential ────────────────────────────────────
    {
      name: 'get_verifiable_credential',
      description:
        'Retrieve a W3C Verifiable Credential for the agent — a standards-compliant identity document for enterprise systems, identity wallets, or compliance workflows.',
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
          const agentId = getAgentId(args.agentId as string | undefined);
          const client = getClient();
          const vc = await client.credentials.get(agentId);
          const result: any = vc;
          if ((vc as any).demo === true) {
            result._note =
              'This credential is unsigned (demo mode). Signature implementation is pending.';
          }
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
