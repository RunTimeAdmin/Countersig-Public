import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { registerIdentityTools } from './tools/identity.js';
import { registerTokenTools } from './tools/tokens.js';
import { registerFetchTool } from './tools/fetch.js';
import { registerBadgeTool } from './tools/badge.js';
import { registerAttestTool } from './tools/attest.js';
import { registerConfigureTool } from './tools/configure.js';
import { registerCredentialTool } from './tools/credential.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

export function createCountersigServer(): Server {
  const server = new Server(
    { name: 'countersig', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Collect all tool definitions
  const allTools: ToolDefinition[] = [
    ...registerIdentityTools(),
    ...registerTokenTools(),
    ...registerFetchTool(),
    ...registerBadgeTool(),
    ...registerAttestTool(),
    ...registerConfigureTool(),
    ...registerCredentialTool(),
  ];

  // tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = allTools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${request.params.name}` }) }],
        isError: true,
      };
    }
    return tool.handler((request.params.arguments ?? {}) as Record<string, unknown>);
  });

  return server;
}
