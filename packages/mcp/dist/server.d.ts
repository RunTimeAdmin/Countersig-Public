import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
        isError?: boolean;
    }>;
}
export declare function createAgentIDServer(): Server;
//# sourceMappingURL=server.d.ts.map