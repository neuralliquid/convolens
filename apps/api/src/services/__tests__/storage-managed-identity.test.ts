import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  AZURE_MANAGED_IDENTITY_TIMEOUT_MS,
  AZURE_DELETE_REQUEST_TIMEOUT_MS,
  AZURE_UPLOAD_MAX_RETRIES,
  AZURE_UPLOAD_REQUEST_TIMEOUT_MS,
  AZURE_UPLOAD_TOTAL_TIMEOUT_MS,
  StorageService,
} from '../storage/storage.service';

const originalEnvironment = {
  account: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  container: process.env.AZURE_STORAGE_CONTAINER,
  sasToken: process.env.AZURE_STORAGE_SAS_TOKEN,
  accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
  endpoint: process.env.IDENTITY_ENDPOINT,
  header: process.env.IDENTITY_HEADER,
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  for (const [name, value] of Object.entries({
    AZURE_STORAGE_ACCOUNT_NAME: originalEnvironment.account,
    AZURE_STORAGE_CONTAINER: originalEnvironment.container,
    AZURE_STORAGE_SAS_TOKEN: originalEnvironment.sasToken,
    AZURE_STORAGE_ACCOUNT_KEY: originalEnvironment.accountKey,
    IDENTITY_ENDPOINT: originalEnvironment.endpoint,
    IDENTITY_HEADER: originalEnvironment.header,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('StorageService managed identity', () => {
  it('bounds identity lookup and Blob retries below the 60-second caller timeout', () => {
    const worstCaseConfiguredDuration =
      AZURE_MANAGED_IDENTITY_TIMEOUT_MS +
      AZURE_UPLOAD_REQUEST_TIMEOUT_MS * (AZURE_UPLOAD_MAX_RETRIES + 1) +
      1_000;

    expect(worstCaseConfiguredDuration).toBeLessThan(AZURE_UPLOAD_TOTAL_TIMEOUT_MS);
    expect(AZURE_UPLOAD_TOTAL_TIMEOUT_MS).toBeLessThan(60_000);
    expect(AZURE_DELETE_REQUEST_TIMEOUT_MS).toBeLessThan(60_000);
  });

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

  it('aborts a stalled Blob deletion inside the caller window', async () => {
    jest.useFakeTimers();
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'fixturestorage';
    process.env.AZURE_STORAGE_CONTAINER = 'chat-exports';
    process.env.AZURE_STORAGE_SAS_TOKEN = 'fixture-sas';
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        })
    );
    const storage = new StorageService({ provider: 'azure-blob' });

    const assertion = expect(
      storage.deleteFile('raw-intakes/a/stalled.json')
    ).rejects.toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(AZURE_DELETE_REQUEST_TIMEOUT_MS);

    await assertion;
  });

  it('uses SharedKey authentication for Blob deletion when an account key is configured', async () => {
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'fixturestorage';
    process.env.AZURE_STORAGE_CONTAINER = 'chat-exports';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = Buffer.from('fixture-account-key').toString('base64');
    delete process.env.AZURE_STORAGE_SAS_TOKEN;
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }));
    const storage = new StorageService({ provider: 'azure-blob' });

    await storage.deleteFile('raw-intakes/a/account-key.json');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: expect.objectContaining({
        Authorization: expect.stringMatching(/^SharedKey fixturestorage:/),
        'x-ms-date': expect.any(String),
      }),
    });
  });
});
