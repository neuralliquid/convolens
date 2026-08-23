import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    batonAccessToken?: string;
    idToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    idToken?: string;
    idTokenExpiresAt?: number;
    refreshError?: "RefreshAccessTokenError";
    refreshToken?: string;
  }
}
