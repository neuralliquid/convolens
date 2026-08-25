/**
 * Client-safe JWT expiry check.
 *
 * Decodes the `exp` claim of a JWT without verifying its signature and
 * reports whether it is still inside its validity window. This is a
 * freshness *signal*, never an authorization check — the caller must not
 * treat a `true` result as proof the token is valid, only as evidence that
 * it is not yet stale.
 *
 * Why this exists: a NextAuth session can carry `user` (truthy) while its
 * forwarded Mystira `idToken` has quietly expired — the session cookie
 * itself is long-lived (30 days) and independent of the much shorter-lived
 * ID token, and there is a window before a failed refresh attempt sets
 * `refreshError` where the stale token is still present on the session.
 * Callers that only checked `session.user` for "is this session usable"
 * bounced a stale-but-"signed in" user straight back into pages that would
 * immediately fail their API calls. Checking `isIdTokenFresh(session.idToken)`
 * alongside `session.user` closes that gap.
 */
export function isIdTokenFresh(
  idToken: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!idToken) {
    return false;
  }

  const payloadSegment = idToken.split(".")[1];
  if (!payloadSegment) {
    return false;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(decoded) as { exp?: unknown };
    return typeof payload.exp === "number" && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}
