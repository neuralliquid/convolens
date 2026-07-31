import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/constants';
import { exchangeMystiraIdToken, resetMystiraDiscoveryCache } from '../mystira-auth.service';

describe('Mystira extension authentication', () => {
  const originalWellKnown = process.env.MYSTIRA_IDENTITY_WELL_KNOWN;
  const originalClientId = process.env.MYSTIRA_IDENTITY_CLIENT_ID;
  const originalAdminEmails = process.env.MYSTIRA_ADMIN_EMAILS;
  const originalAdminSubjects = process.env.MYSTIRA_ADMIN_SUBJECTS;
  const issuer = 'https://identity.example';
  const clientId = 'convolens-client';
  const keyId = 'mystira-signing-key';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const publicJwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: keyId,
    use: 'sig',
    alg: 'RS256',
  };

  beforeEach(() => {
    process.env.MYSTIRA_IDENTITY_WELL_KNOWN =
      'https://identity.example/.well-known/openid-configuration';
    process.env.MYSTIRA_IDENTITY_CLIENT_ID = clientId;
    delete process.env.MYSTIRA_ADMIN_EMAILS;
    delete process.env.MYSTIRA_ADMIN_SUBJECTS;
    resetMystiraDiscoveryCache();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    restoreEnvironment('MYSTIRA_IDENTITY_WELL_KNOWN', originalWellKnown);
    restoreEnvironment('MYSTIRA_IDENTITY_CLIENT_ID', originalClientId);
    restoreEnvironment('MYSTIRA_ADMIN_EMAILS', originalAdminEmails);
    restoreEnvironment('MYSTIRA_ADMIN_SUBJECTS', originalAdminSubjects);
    jest.restoreAllMocks();
  });

  function restoreEnvironment(name: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  it('issues an admin API token only for an explicitly configured verified identity', async () => {
    process.env.MYSTIRA_ADMIN_EMAILS = 'other@example.com, operator@example.com';
    mockDiscoveryAndKeys();

    const result = await exchangeMystiraIdToken(createIdToken());
    const claims = jwt.verify(result.token, JWT_SECRET) as jwt.JwtPayload;

    expect(claims.role).toBe('admin');
  });

  it('does not elevate an unconfigured verified identity', async () => {
    process.env.MYSTIRA_ADMIN_EMAILS = 'other@example.com';
    mockDiscoveryAndKeys();

    const result = await exchangeMystiraIdToken(createIdToken());
    const claims = jwt.verify(result.token, JWT_SECRET) as jwt.JwtPayload;

    expect(claims.role).toBe('user');
  });

  function createIdToken(overrides: Record<string, unknown> = {}): string {
    return jwt.sign(
      {
        sub: 'mystira-user-123',
        email: 'operator@example.com',
        name: 'Operator',
        ...overrides,
      },
      privateKey,
      {
        algorithm: 'RS256',
        issuer,
        audience: clientId,
        keyid: keyId,
        expiresIn: '5m',
      }
    );
  }

  function mockDiscoveryAndKeys(): jest.MockedFunction<typeof fetch> {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            issuer,
            jwks_uri: 'https://identity.example/.well-known/jwks',
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
        })
      );
    return fetchMock;
  }

  it('validates the Mystira ID token and returns a short-lived API token', async () => {
    mockDiscoveryAndKeys();

    const result = await exchangeMystiraIdToken(createIdToken());
    const claims = jwt.verify(result.token, JWT_SECRET) as jwt.JwtPayload;

    expect(result.user).toEqual({
      id: 'mystira-user-123',
      email: 'operator@example.com',
      name: 'Operator',
    });
    expect(result.expiresIn).toBe(900);
    expect(claims).toMatchObject({
      id: 'mystira-user-123',
      userId: 'mystira-user-123',
      email: 'operator@example.com',
      role: 'user',
      authProvider: 'mystira',
      sub: 'mystira-user-123',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    mockDiscoveryAndKeys();

    await expect(
      exchangeMystiraIdToken(
        jwt.sign(
          {
            sub: 'mystira-user-123',
            email: 'operator@example.com',
          },
          privateKey,
          {
            algorithm: 'RS256',
            issuer,
            audience: 'different-client',
            keyid: keyId,
            expiresIn: '5m',
          }
        )
      )
    ).rejects.toThrow('jwt audience invalid');
  });

  it('rejects a token whose signing key is not published by Mystira', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            issuer,
            jwks_uri: 'https://identity.example/.well-known/jwks',
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ keys: [] }), {
          status: 200,
        })
      );

    await expect(exchangeMystiraIdToken(createIdToken())).rejects.toThrow(
      'Mystira Identity signing key was not found'
    );
  });
});
