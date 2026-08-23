import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BATON_TIMEOUT_MS = 15_000;

interface McpTextContent {
  type: string;
  text?: string;
}

interface McpToolResult {
  content?: McpTextContent[];
  isError?: boolean;
}

export interface BatonMcpTask {
  id: string;
  trace_id?: string | null;
  traceId?: string | null;
}

function resultText(result: McpToolResult, tool: string): string {
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError || !text) {
    throw new Error(`Baton MCP ${tool} failed`);
  }
  return text;
}

export class BatonMcpClient {
  constructor(
    private readonly resourceUrl: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async searchTasks(
    projectId: string,
    query: string,
    accessToken: string
  ): Promise<BatonMcpTask[]> {
    const result = await this.callTool('search_tasks', { projectId, query }, accessToken);
    return JSON.parse(resultText(result, 'search_tasks')) as BatonMcpTask[];
  }

  async createTask(
    input: {
      projectId: string;
      idempotencyKey: string;
      title: string;
      description?: string;
      priority: 'medium';
      traceId: string;
    },
    accessToken: string
  ): Promise<BatonMcpTask> {
    const result = await this.callTool('create_task', input, accessToken);
    return JSON.parse(resultText(result, 'create_task')) as BatonMcpTask;
  }

  private async callTool(
    name: string,
    args: Record<string, unknown>,
    accessToken: string
  ): Promise<McpToolResult> {
    const transport = new StreamableHTTPClientTransport(new URL(this.resourceUrl), {
      fetch: this.fetcher,
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const client = new Client({ name: 'convolens', version: '1.0.0' });
    try {
      await client.connect(transport);
      return (await client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: BATON_TIMEOUT_MS }
      )) as McpToolResult;
    } finally {
      await client.close();
    }
  }
}
