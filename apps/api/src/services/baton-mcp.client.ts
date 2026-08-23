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

interface McpResultRecord {
  [key: string]: unknown;
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

function isRecord(value: unknown): value is McpResultRecord {
  return typeof value === 'object' && value !== null;
}

function parseBatonTask(value: unknown, tool: string): BatonMcpTask {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error(`Baton MCP ${tool} returned invalid task payload`);
  }

  const task: BatonMcpTask = { id: value.id };
  if (typeof value.trace_id === 'string' || value.trace_id === null) {
    task.trace_id = value.trace_id;
  }
  if (typeof value.traceId === 'string' || value.traceId === null) {
    task.traceId = value.traceId;
  }
  return task;
}

function parseTaskPayload(text: string, tool: string): BatonMcpTask[] {
  const payload = JSON.parse(text);
  if (!Array.isArray(payload)) {
    throw new Error(`Baton MCP ${tool} returned invalid task list payload`);
  }
  return payload.map((item) => parseBatonTask(item, tool));
}

function parseCreatePayload(text: string, tool: string): BatonMcpTask {
  const payload = JSON.parse(text);
  return parseBatonTask(payload, tool);
}

export class BatonMcpClient {
  constructor(
    private readonly resourceUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs: number = BATON_TIMEOUT_MS
  ) {}

  async searchTasks(
    projectId: string,
    query: string,
    accessToken: string
  ): Promise<BatonMcpTask[]> {
    const result = await this.callTool('search_tasks', { projectId, query }, accessToken);
    return parseTaskPayload(resultText(result, 'search_tasks'), 'search_tasks');
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
    return parseCreatePayload(resultText(result, 'create_task'), 'create_task');
  }

  private async callTool(
    name: string,
    args: Record<string, unknown>,
    accessToken: string
  ): Promise<McpToolResult> {
    const timeoutAt = Date.now() + this.timeoutMs;
    const transport = new StreamableHTTPClientTransport(new URL(this.resourceUrl), {
      fetch: this.fetcher,
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const client = new Client({ name: 'convolens', version: '1.0.0' });

    try {
      await this.callWithTimeout(
        async () => {
          await client.connect(transport);
        },
        'connect',
        timeoutAt
      );
      return (await client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: this.timeoutMs }
      )) as McpToolResult;
    } finally {
      try {
        await client.close();
      } catch {
        // ignore cleanup failures when transport initialization did not complete
      }
    }
  }

  private async callWithTimeout<T>(
    action: () => Promise<T>,
    label: string,
    timeoutAt: number
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        action(),
        new Promise<never>((_, reject) => {
          const delay = Math.max(0, timeoutAt - Date.now());
          timer = setTimeout(() => reject(new Error(`Baton MCP ${label} timed out`)), delay);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
