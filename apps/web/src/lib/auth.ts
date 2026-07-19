import { NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

type MystiraProfile = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

const mystiraIdentityProvider = (): OAuthConfig<MystiraProfile> => ({
  id: "mystira",
  name: "Mystira Identity",
  type: "oauth",
  wellKnown: process.env.MYSTIRA_IDENTITY_WELL_KNOWN,
  authorization: {
    params: {
      scope: process.env.MYSTIRA_IDENTITY_SCOPE || "openid profile email",
    },
  },
  idToken: true,
  checks: ["pkce", "state"],
  clientId: process.env.MYSTIRA_IDENTITY_CLIENT_ID,
  clientSecret: process.env.MYSTIRA_IDENTITY_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name || profile.preferred_username || profile.email || "Mystira User",
      email: profile.email,
      image: profile.picture,
    };
  },
});

export const authOptions: NextAuthOptions = {
  providers: [mystiraIdentityProvider()],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
};
