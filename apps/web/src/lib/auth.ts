import { NextAuthOptions, type Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { OAuthConfig } from "next-auth/providers/oauth";

type MystiraProfile = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

type MystiraDiscovery = {
  token_endpoint?: string;
};

type MystiraTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
};

export const DEFAULT_MYSTIRA_IDENTITY_SCOPE =
  "openid profile email offline_access mill.transcribe";

export function getMystiraIdentityScope(): string {
  return process.env.MYSTIRA_IDENTITY_SCOPE || DEFAULT_MYSTIRA_IDENTITY_SCOPE;
}

function getIdTokenExpiry(idToken?: string): number | undefined {
  if (!idToken) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

export async function refreshMystiraToken(token: JWT): Promise<JWT> {
  try {
    const wellKnown = process.env.MYSTIRA_IDENTITY_WELL_KNOWN;
    const clientId = process.env.MYSTIRA_IDENTITY_CLIENT_ID;
    const clientSecret = process.env.MYSTIRA_IDENTITY_CLIENT_SECRET;
    if (!wellKnown || !clientId || !clientSecret || !token.refreshToken) {
      throw new Error("Mystira Identity refresh is not configured");
    }

    const discoveryResponse = await fetch(wellKnown, { cache: "no-store" });
    if (!discoveryResponse.ok) {
      throw new Error(
        `Mystira Identity discovery failed with HTTP ${discoveryResponse.status}`,
      );
    }

    const discovery = (await discoveryResponse.json()) as MystiraDiscovery;
    if (!discovery.token_endpoint) {
      throw new Error("Mystira Identity discovery is missing token_endpoint");
    }

    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      throw new Error(
        `Mystira Identity token refresh failed with HTTP ${tokenResponse.status}`,
      );
    }

    const refreshed = (await tokenResponse.json()) as MystiraTokenResponse;
    if (!refreshed.id_token) {
      throw new Error("Mystira Identity refresh did not return an ID token");
    }

    return {
      ...token,
      accessToken: refreshed.access_token || token.accessToken,
      accessTokenExpiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
      idToken: refreshed.id_token,
      idTokenExpiresAt:
        getIdTokenExpiry(refreshed.id_token) ||
        Date.now() + (refreshed.expires_in || 3600) * 1000,
      refreshToken: refreshed.refresh_token || token.refreshToken,
      refreshError: undefined,
    };
  } catch (error) {
    console.error("Unable to refresh the Mystira Identity session", error);
    return {
      ...token,
      idToken: undefined,
      refreshError: "RefreshAccessTokenError",
    };
  }
}

const mystiraIdentityProvider = (): OAuthConfig<MystiraProfile> => ({
  id: "mystira",
  name: "Mystira Identity",
  type: "oauth",
  wellKnown: process.env.MYSTIRA_IDENTITY_WELL_KNOWN,
  authorization: {
    params: {
      scope: getMystiraIdentityScope(),
    },
  },
  idToken: true,
  checks: ["pkce", "state"],
  clientId: process.env.MYSTIRA_IDENTITY_CLIENT_ID,
  clientSecret: process.env.MYSTIRA_IDENTITY_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.sub,
      name:
        profile.name ||
        profile.preferred_username ||
        profile.email ||
        "Mystira User",
      email: profile.email,
      image: profile.picture,
    };
  },
});

export function sessionFromToken(session: Session, token: JWT): Session {
  if (token.refreshError) {
    return {
      expires: new Date(0).toISOString(),
    };
  }

  return {
    ...session,
    accessToken: token.accessToken as string | undefined,
    idToken: token.idToken as string | undefined,
  };
}

export function shouldRefreshMystiraSession(token: JWT): boolean {
  if (token.refreshError) {
    return false;
  }

  const idExpiresAt = token.idTokenExpiresAt;
  const accessExpiresAt = token.accessTokenExpiresAt;
  return !(
    Boolean(token.idToken) &&
    Boolean(token.accessToken) &&
    typeof idExpiresAt === "number" &&
    typeof accessExpiresAt === "number" &&
    Date.now() < Math.min(idExpiresAt, accessExpiresAt) - 30_000
  );
}

export const authOptions: NextAuthOptions = {
  providers: [mystiraIdentityProvider()],
  session: {
    strategy: "jwt",
    // Browser cookie lifetime. Mystira access tokens refresh ~30s before they
    // expire; a failed refresh must not keep the user signed in (see sessionFromToken).
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.accessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : undefined;
        token.idToken = account.id_token;
        token.idTokenExpiresAt =
          getIdTokenExpiry(account.id_token) ||
          (account.expires_at ? account.expires_at * 1000 : undefined);
        token.refreshToken = account.refresh_token;
        token.refreshError = undefined;
        return token;
      }

      if (!shouldRefreshMystiraSession(token)) {
        return token;
      }

      return refreshMystiraToken(token);
    },
    async session({ session, token }) {
      return sessionFromToken(session, token);
    },
  },
};
