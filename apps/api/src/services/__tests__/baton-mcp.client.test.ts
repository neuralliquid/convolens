import { describe, expect, it, jest } from '@jest/globals';
import { BatonMcpClient } from '../baton-mcp.client';

describe('BatonMcpClient', () => {
  function initializedFetcher(toolResult: object): jest.MockedFunction<typeof fetch> {
    return jest.fn<typeof fetch>(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        id?: number;
        method: string;
      };
      if (request.method === 'initialize') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: { tools: {} },
              serverInfo: { name: 'baton-test', version: '1.0.0' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (request.method === 'notifications/initialized') {
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: toolResult,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
  }

  it('initializes the MCP session and never exposes the bearer in a JSON-RPC body', async () => {
    const fetcher = initializedFetcher({
      content: [{ type: 'text', text: '[{"id":"task-1"}]' }],
    });
    const client = new BatonMcpClient('https://baton.example/mcp', fetcher);

    await expect(
      client.searchTasks('project-1', 'Reviewed candidate', 'secret-token')
    ).resolves.toEqual([{ id: 'task-1' }]);

    const methods = fetcher.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)).method
    );
    expect(methods).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
    for (const [input, init] of fetcher.mock.calls) {
      expect(input.toString()).toBe('https://baton.example/mcp');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token');
      expect(init?.body).not.toContain('secret-token');
    }
  });

  it('fails closed on a tool-level error result', async () => {
    const fetcher = initializedFetcher({
      isError: true,
      content: [{ type: 'text', text: 'Resource not found' }],
    });

    await expect(
      new BatonMcpClient('https://baton.example/mcp', fetcher).createTask(
        {
          projectId: 'wrong-project',
          idempotencyKey: 'candidate-1',
          title: 'Candidate',
          priority: 'medium',
          traceId: 'candidate-1',
        },
        'token'
      )
    ).rejects.toThrow('Baton MCP create_task failed');
  });
});
