import { getClient, getAgentId } from '../client.js';
import type { ToolDefinition } from '../server.js';

export function registerAttestTool(): ToolDefinition[] {
  return [
    // ─── attest_action ────────────────────────────────────────────────
    {
      name: 'attest_action',
      description:
        "Record a successful or failed action to the agent's behavioral history. Regular attestation improves the agent's BAGS reputation score over time.",
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
          const agentId = getAgentId(args.agentId as string | undefined);
          const client = getClient();
          const result = await client.attestations.attest(agentId, {
            success: args.success as boolean,
            action: args.action as string | undefined,
          });
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
