import { getServerSession } from "next-auth";
import { getConvolensPublishTokens } from "../convolens-api";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

describe("ConvoLens publish token resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1" },
      idToken: "id-token",
      accessToken: "access-token",
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "convolens-token" }),
    });
  });

  it("derives both credentials from one refreshed session", async () => {
    await expect(getConvolensPublishTokens()).resolves.toEqual({
      apiToken: "convolens-token",
      batonToken: "access-token",
    });
    expect(getServerSession).toHaveBeenCalledTimes(1);
  });
});
