import { refreshMystiraToken, sessionFromToken } from "../auth";

describe("Mystira Identity token refresh", () => {
  const originalWellKnown = process.env.MYSTIRA_IDENTITY_WELL_KNOWN;
  const originalClientId = process.env.MYSTIRA_IDENTITY_CLIENT_ID;
  const originalClientSecret = process.env.MYSTIRA_IDENTITY_CLIENT_SECRET;

  beforeEach(() => {
    process.env.MYSTIRA_IDENTITY_WELL_KNOWN =
      "https://identity.example/.well-known/openid-configuration";
    process.env.MYSTIRA_IDENTITY_CLIENT_ID = "convolens-client";
    process.env.MYSTIRA_IDENTITY_CLIENT_SECRET = "client-secret";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.MYSTIRA_IDENTITY_WELL_KNOWN = originalWellKnown;
    process.env.MYSTIRA_IDENTITY_CLIENT_ID = originalClientId;
    process.env.MYSTIRA_IDENTITY_CLIENT_SECRET = originalClientSecret;
    jest.restoreAllMocks();
  });

  it("rotates the refresh token and ID token", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const idToken = [
      Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url"),
      Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url"),
      "signature",
    ].join(".");
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token_endpoint: "https://identity.example/connect/token",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-2",
          id_token: idToken,
          refresh_token: "refresh-2",
          expires_in: 3600,
        }),
      } as Response);

    const result = await refreshMystiraToken({
      accessToken: "access-1",
      idToken: "expired-id-token",
      refreshToken: "refresh-1",
    });

    expect(result).toMatchObject({
      accessToken: "access-2",
      accessTokenExpiresAt: expect.any(Number),
      idToken,
      idTokenExpiresAt: expiresAt * 1000,
      refreshToken: "refresh-2",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://identity.example/connect/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    expect(
      (fetchMock.mock.calls[1][1]?.body as URLSearchParams).toString(),
    ).toContain("grant_type=refresh_token");
  });

  it("does not expose an expired ID token when refresh is unavailable", async () => {
    delete process.env.MYSTIRA_IDENTITY_CLIENT_SECRET;
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await refreshMystiraToken({
      idToken: "expired-id-token",
      refreshToken: "refresh-1",
    });

    expect(result.idToken).toBeUndefined();
    expect(result.refreshError).toBe("RefreshAccessTokenError");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it("treats a refresh failure as a signed-out session", () => {
    const session = sessionFromToken(
      {
        expires: "2099-01-01T00:00:00.000Z",
        user: { name: "Preview", email: "preview@example.com" },
        accessToken: "access-1",
        idToken: "id-1",
      },
      { refreshError: "RefreshAccessTokenError" },
    );

    expect(session.user).toBeUndefined();
    expect(session.accessToken).toBeUndefined();
    expect(session.idToken).toBeUndefined();
    expect(Date.parse(session.expires)).toBe(0);
  });
});
