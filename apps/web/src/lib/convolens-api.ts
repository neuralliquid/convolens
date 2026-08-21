import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export class ConvolensApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ConvolensApiAuthError";
  }
}

export function getConvolensApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
  ).replace(/\/$/, "");
}

async function exchangeConvolensApiToken(session: {
  user?: unknown;
  idToken?: string;
}): Promise<string> {
  if (!session?.user) {
    throw new ConvolensApiAuthError("Unauthorized", 401);
  }
  if (!session.idToken) {
    throw new ConvolensApiAuthError(
      "Your Mystira Identity session needs to be refreshed",
      401,
    );
  }

  const response = await fetch(
    `${getConvolensApiBaseUrl()}/api/auth/mystira/exchange`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: session.idToken }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new ConvolensApiAuthError(
      "Unable to authorize the ConvoLens API session",
      response.status === 401 ? 401 : 502,
    );
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new ConvolensApiAuthError(
      "ConvoLens API token exchange returned an invalid response",
      502,
    );
  }

  return payload.token;
}

export async function getConvolensApiToken(): Promise<string> {
  const session = await getServerSession(authOptions);
  return exchangeConvolensApiToken(session || {});
}

async function getConvolensForwardedTokens(): Promise<{
  apiToken: string;
  accessToken: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    throw new ConvolensApiAuthError(
      "Your Mystira Identity session needs to be refreshed",
      401,
    );
  }
  return {
    apiToken: await exchangeConvolensApiToken(session),
    accessToken: session.accessToken,
  };
}

export async function getConvolensPublishTokens(): Promise<{
  apiToken: string;
  batonToken: string;
}> {
  const { apiToken, accessToken } = await getConvolensForwardedTokens();
  return { apiToken, batonToken: accessToken };
}

export async function getConvolensTranscriptionTokens(): Promise<{
  apiToken: string;
  mystiraToken: string;
}> {
  const { apiToken, accessToken } = await getConvolensForwardedTokens();
  return { apiToken, mystiraToken: accessToken };
}

export async function getMystiraAccessToken(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    throw new ConvolensApiAuthError(
      "Your Mystira Identity session needs to be refreshed",
      401,
    );
  }
  return session.accessToken;
}

export function apiAuthErrorResponse(error: unknown): Response {
  if (error instanceof ConvolensApiAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("ConvoLens API proxy error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
