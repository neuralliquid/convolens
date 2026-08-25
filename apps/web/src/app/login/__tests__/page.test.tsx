import { render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../page";

const replaceMock = jest.fn();
let searchParamsValue = new URLSearchParams();

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsValue,
}));

function makeIdToken(expSecondsFromNow: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${base64}.signature`;
}

function mockFetchFor(session: unknown) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/runtime/auth-status")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ mystiraConfigured: true }),
      } as Response);
    }
    if (url.includes("/api/auth/session")) {
      return Promise.resolve({
        ok: true,
        json: async () => session,
      } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
}

describe("LoginPage already-authenticated redirect", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
  });

  it("redirects away when the session has a user and a fresh ID token", async () => {
    mockFetchFor({
      user: { id: "1", email: "preview@example.com" },
      idToken: makeIdToken(3600),
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("does NOT redirect away when the session has a user but a stale ID token", async () => {
    mockFetchFor({
      user: { id: "1", email: "preview@example.com" },
      idToken: makeIdToken(-30),
    });

    render(<LoginPage />);

    await screen.findByRole("button", { name: /Sign in with Mystira Identity/ });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does NOT redirect away when the session has a user but no ID token at all", async () => {
    mockFetchFor({ user: { id: "1", email: "preview@example.com" } });

    render(<LoginPage />);

    await screen.findByRole("button", { name: /Sign in with Mystira Identity/ });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("preserves the redirectTo destination for the explicit reauth path", async () => {
    searchParamsValue = new URLSearchParams({
      redirectTo: "/dashboard/conversations/abc",
    });
    mockFetchFor({
      user: { id: "1", email: "preview@example.com" },
      idToken: makeIdToken(3600),
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/dashboard/conversations/abc",
      );
    });
  });
});
