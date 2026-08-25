import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@convolens/contexts";

function makeIdToken(expSecondsFromNow: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${base64}.signature`;
}

const mystiraSession = {
  user: {
    id: "mystira-1",
    email: "preview@example.com",
    name: "Preview",
  },
  idToken: makeIdToken(3600),
};

function Probe() {
  const { user, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="status">{isAuthenticated ? "in" : "out"}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
      <button
        type="button"
        onClick={() => {
          void login("api@example.com", "password123");
        }}
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        Logout
      </button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("AuthProvider session expiry and logout", () => {
  const fetchMock = jest.fn();
  let intervalCallback: (() => void) | null;

  beforeEach(() => {
    intervalCallback = null;
    localStorage.clear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(window, "setInterval").mockImplementation((callback) => {
      intervalCallback = callback as () => void;
      return 123 as unknown as ReturnType<typeof setInterval>;
    });
    jest.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("does not restore a user from a delayed session poll after logout", async () => {
    let resolvePoll: ((value: Response) => void) | undefined;
    let sessionCalls = 0;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        sessionCalls += 1;
        if (sessionCalls === 1) {
          return Promise.resolve(jsonResponse(mystiraSession));
        }
        return new Promise<Response>((resolve) => {
          resolvePoll = resolve;
        });
      }
      if (url.includes("/api/auth/csrf")) {
        return Promise.resolve(jsonResponse({ csrfToken: "csrf-token" }));
      }
      if (url.includes("/api/auth/signout")) {
        return Promise.resolve(jsonResponse({}));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("in");
    });

    expect(intervalCallback).toEqual(expect.any(Function));
    act(() => {
      intervalCallback?.();
    });
    expect(resolvePoll).toEqual(expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });

    await act(async () => {
      resolvePoll?.(jsonResponse(mystiraSession));
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("out");
    expect(screen.getByTestId("email")).toHaveTextContent("");
    expect(localStorage.getItem("convolens_user")).toBeNull();
  });

  it("does not restore auth if the expiry interval fires during NextAuth sign-out", async () => {
    let resolveCsrf: ((value: Response) => void) | undefined;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return Promise.resolve(jsonResponse(mystiraSession));
      }
      if (url.includes("/api/auth/csrf")) {
        return new Promise<Response>((resolve) => {
          resolveCsrf = resolve;
        });
      }
      if (url.includes("/api/auth/signout")) {
        return Promise.resolve(jsonResponse({}));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("in");
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });

    await act(async () => {
      intervalCallback?.();
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("out");

    await act(async () => {
      resolveCsrf?.(jsonResponse({ csrfToken: "csrf-token" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });
    expect(screen.getByTestId("email")).toHaveTextContent("");
  });

  it("revokes the API session when logging out immediately after API login, even if CSRF fails", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return Promise.resolve(jsonResponse({}));
      }
      if (url.endsWith("/auth/login")) {
        return Promise.resolve(
          jsonResponse({
            user: { id: "api-1", email: "api@example.com", name: "API" },
            token: "api-token",
          }),
        );
      }
      if (url.includes("/api/auth/csrf")) {
        return Promise.resolve(jsonResponse({}, false));
      }
      if (url.endsWith("/auth/logout")) {
        return Promise.resolve(jsonResponse({}));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("api@example.com");
    });
    expect(screen.getByTestId("status")).toHaveTextContent("in");

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/auth/logout"))).toBe(
      true,
    );
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("/api/auth/signout")),
    ).toBe(false);
  });

  it("does not restore auth when the session carries a stale Mystira ID token", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return Promise.resolve(
          jsonResponse({
            user: mystiraSession.user,
            idToken: makeIdToken(-30),
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });
    expect(screen.getByTestId("email")).toHaveTextContent("");
    expect(localStorage.getItem("convolens_user")).toBeNull();
  });

  it("does not restore auth when the session has a user but no ID token at all", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return Promise.resolve(jsonResponse({ user: mystiraSession.user }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("out");
    });
    expect(localStorage.getItem("convolens_user")).toBeNull();
  });
});
