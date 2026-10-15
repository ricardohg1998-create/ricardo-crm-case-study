import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { actors, operations, supportedOperations } from './workspace.mjs';

export async function handleMcp(workspace, request, response, body) {
  const server = new McpServer({ name: 'ricardo-crm-demo', version: '1.1.0' });
  server.registerTool('crm_overview', {
    description: 'Read the fictional CRM workspace, versions, next actions and audit history.',
    inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => ({ content: [{ type: 'text', text: JSON.stringify(await workspace.state()) }] }));
  for (const operation of supportedOperations) {
    server.registerTool(`crm_${operation.replace('.', '_')}`, {
      description: `${operation} in the fictional workspace. Use a stable requestId for retries; updates require the current expectedVersion.`,
      inputSchema: { input: operations[operation], requestId: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, async ({ input, requestId }) => {
      try {
        const result = await workspace.perform(actors.mcp, operation, input, requestId);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: error.message, status: error.status ?? 400 }) }] };
      }
    });
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  response.once('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  await server.connect(transport);
  await transport.handleRequest(request, response, body);
}
