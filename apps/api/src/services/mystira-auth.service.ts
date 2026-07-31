import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

type MystiraDiscovery = {
  issuer?: string;
  jwks_uri?: string;
};

type MystiraIdTokenClaims = jwt.JwtPayload & {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  role?: string;
  roles?: string[];
};

type JsonWebKeySet = {
  keys?: Array<Record<string, unknown> & { kid?: string }>;
};

export type ExtensionIdentity = {
  id: string;
  email: string;
  name?: string;
};

const DISCOVERY_CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

function configuredValues(name: string): Set<string> {
  return new Set(
    (process.env[name] || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function resolveMystiraApiRole(profile: MystiraIdTokenClaims): 'admin' | 'user' {
  const roles = [profile.role, ...(Array.isArray(profile.roles) ? profile.roles : [])]
    .filter((role): role is string => typeof role === 'string')
    .map((role) => role.toLowerCase());
  const email = profile.email || profile.preferred_username;

  if (
    roles.includes('admin') ||
    (profile.sub && configuredValues('MYSTIRA_ADMIN_SUBJECTS').has(profile.sub.toLowerCase())) ||
    (email && configuredValues('MYSTIRA_ADMIN_EMAILS').has(email.toLowerCase()))
  ) {
    return 'admin';
  }

  return 'user';
}

let cachedDiscovery:
  | {
      expiresAt: number;
      value: MystiraDiscovery;
    }
  | undefined;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Mystira Identity request failed with HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getDiscovery(): Promise<MystiraDiscovery> {
  if (cachedDiscovery && cachedDiscovery.expiresAt > Date.now()) {
    return cachedDiscovery.value;
  }

  const wellKnownUrl = process.env.MYSTIRA_IDENTITY_WELL_KNOWN;
  if (!wellKnownUrl) {
    throw new Error('Mystira Identity discovery is not configured');
  }

  const discovery = (await fetchJson(wellKnownUrl)) as MystiraDiscovery;
  if (!discovery.issuer || !discovery.jwks_uri) {
    throw new Error('Mystira Identity discovery is missing issuer or jwks_uri');
  }

  cachedDiscovery = {
    expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    value: discovery,
  };

  return discovery;
}

export async function exchangeMystiraIdToken(
  idToken: string
): Promise<{ token: string; user: ExtensionIdentity; expiresIn: number }> {
  if (!idToken) {
    throw new Error('Mystira Identity ID token is required');
  }

  const discovery = await getDiscovery();
  const clientId = process.env.MYSTIRA_IDENTITY_CLIENT_ID;
  if (!clientId) {
    throw new Error('Mystira Identity client ID is not configured');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') {
    throw new Error('Mystira Identity ID token has an unsupported signing header');
  }

  const jwks = (await fetchJson(discovery.jwks_uri!)) as JsonWebKeySet;
  const jwk = jwks.keys?.find((key) => key.kid === decoded.header.kid);
  if (!jwk) {
    throw new Error('Mystira Identity signing key was not found');
  }

  const signingKey = createPublicKey({
    key: jwk,
    format: 'jwk',
  } as Parameters<typeof createPublicKey>[0]);
  const profile = jwt.verify(idToken, signingKey, {
    algorithms: ['RS256'],
    issuer: discovery.issuer,
    audience: clientId,
  }) as MystiraIdTokenClaims;

  const email = profile.email || profile.preferred_username;
  if (!profile.sub || !email) {
    throw new Error('Mystira Identity profile is missing a stable subject or email');
  }

  const user: ExtensionIdentity = {
    id: profile.sub,
    email,
    name: profile.name,
  };
  const role = resolveMystiraApiRole(profile);
  const expiresIn = 15 * 60;
  const token = jwt.sign(
    {
      id: user.id,
      userId: user.id,
      email: user.email,
      role,
      authProvider: 'mystira',
    },
    JWT_SECRET,
    {
      expiresIn,
      subject: user.id,
    }
  );

  return { token, user, expiresIn };
}

export function resetMystiraDiscoveryCache(): void {
  cachedDiscovery = undefined;
}
