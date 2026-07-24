import { hasSessionCookie } from "../session-cookie";

describe("NextAuth session cookie detection", () => {
  it.each([
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.session-token.2",
  ])("accepts %s", (cookieName) => {
    expect(hasSessionCookie(["theme", cookieName])).toBe(true);
  });

  it("does not accept similarly named or unrelated cookies", () => {
    expect(
      hasSessionCookie([
        "theme",
        "__Secure-next-auth.callback-url",
        "__Secure-next-auth.session-token-invalid",
      ]),
    ).toBe(false);
  });
});
