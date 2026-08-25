import { isIdTokenFresh } from "@convolens/contexts";

function makeIdToken(expSecondsFromNow: number | undefined): string {
  const payload =
    expSecondsFromNow === undefined
      ? {}
      : { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${base64}.signature`;
}

describe("isIdTokenFresh", () => {
  it("returns true for a token whose exp claim is in the future", () => {
    expect(isIdTokenFresh(makeIdToken(3600))).toBe(true);
  });

  it("returns false for a token whose exp claim is in the past", () => {
    expect(isIdTokenFresh(makeIdToken(-30))).toBe(false);
  });

  it("returns false when there is no token", () => {
    expect(isIdTokenFresh(undefined)).toBe(false);
    expect(isIdTokenFresh(null)).toBe(false);
    expect(isIdTokenFresh("")).toBe(false);
  });

  it("returns false for a malformed token", () => {
    expect(isIdTokenFresh("not-a-jwt")).toBe(false);
    expect(isIdTokenFresh("header.not-base64!!!.signature")).toBe(false);
  });

  it("returns false when the payload has no numeric exp claim", () => {
    expect(isIdTokenFresh(makeIdToken(undefined))).toBe(false);
  });
});
