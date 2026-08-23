import { getServerSession } from "next-auth";
import { getConvolensPublishTokens } from "../convolens-api";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

describe("ConvoLens publish token resolution", () => {
  const originalBatonEnabled = process.env.BATON_OAUTH_MCP_ENABLED;

  beforeEach(() => {
    process.env.BATON_OAUTH_MCP_ENABLED = "true";
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1" },
      idToken: "id-token",
      accessToken: "access-token",
      batonAccessToken: "baton-access-token",
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "convolens-token" }),
    });
  });

  afterAll(() => {
    process.env.BATON_OAUTH_MCP_ENABLED = originalBatonEnabled;
  });

  it("forwards the distinct Baton resource token", async () => {
    await expect(getConvolensPublishTokens()).resolves.toEqual({
      apiToken: "convolens-token",
      batonToken: "baton-access-token",
    });
    expect(getServerSession).toHaveBeenCalledTimes(1);
  });

  it("does not reuse the XtOX access token when a Baton token is absent", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1" },
      idToken: "id-token",
      accessToken: "xtox-token",
    });

    await expect(getConvolensPublishTokens()).rejects.toMatchObject({
      status: 401,
      message: "A distinct Baton OAuth session is required",
    });
  });

  it("fails closed while the Baton OAuth consumer is dark", async () => {
    process.env.BATON_OAUTH_MCP_ENABLED = "false";

    await expect(getConvolensPublishTokens()).rejects.toMatchObject({
      status: 503,
      message: "Baton OAuth publishing is not enabled",
    });
    expect(getServerSession).not.toHaveBeenCalled();
  });
});
