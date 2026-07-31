import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StorageService } from '../storage/storage.service';

const originalEnvironment = {
  account: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  container: process.env.AZURE_STORAGE_CONTAINER,
  endpoint: process.env.IDENTITY_ENDPOINT,
  header: process.env.IDENTITY_HEADER,
};

afterEach(() => {
  jest.restoreAllMocks();
  for (const [name, value] of Object.entries({
    AZURE_STORAGE_ACCOUNT_NAME: originalEnvironment.account,
    AZURE_STORAGE_CONTAINER: originalEnvironment.container,
    IDENTITY_ENDPOINT: originalEnvironment.endpoint,
    IDENTITY_HEADER: originalEnvironment.header,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('StorageService managed identity', () => {
  it('uses and caches a Container Apps identity token for private Blob writes', async () => {
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'fixturestorage';
    process.env.AZURE_STORAGE_CONTAINER = 'chat-exports';
    process.env.IDENTITY_ENDPOINT = 'http://localhost/identity/token';
    process.env.IDENTITY_HEADER = 'fixture-identity-header';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'fixture-managed-identity-token',
            expires_on: Math.floor(Date.now() / 1000) + 3_600,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValue(new Response(null, { status: 201 }));
    const storage = new StorageService({ provider: 'azure-blob' });

    await storage.uploadFile('raw-intakes/a/first.json', '{}', {
      contentType: 'application/json',
    });
    await storage.uploadFile('raw-intakes/a/second.json', '{}', {
      contentType: 'application/json',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenRequest] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toContain('resource=https%3A%2F%2Fstorage.azure.com%2F');
    expect(tokenRequest).toMatchObject({
      headers: { 'X-IDENTITY-HEADER': 'fixture-identity-header' },
    });
    for (const call of fetchMock.mock.calls.slice(1)) {
      expect(call[1]).toMatchObject({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer fixture-managed-identity-token',
        }),
      });
    }
  });
});
