const sessionCookieNames = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function hasSessionCookie(cookieNames: Iterable<string>) {
  return Array.from(cookieNames).some((cookieName) =>
    sessionCookieNames.some(
      (sessionName) =>
        cookieName === sessionName || cookieName.startsWith(`${sessionName}.`),
    ),
  );
}
