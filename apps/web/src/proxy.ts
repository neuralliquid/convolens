import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/session-cookie";

export function proxy(request: NextRequest) {
  const hasSession = hasSessionCookie(
    request.cookies.getAll().map(({ name }) => name),
  );

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set(
      "redirectTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set(
    "x-theme",
    request.cookies.get("theme")?.value || "light",
  );
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/personal/:path*",
    "/groups/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/customize/:path*",
    "/distribution/:path*",
    "/cross-platform-groups/:path*",
    "/moodboard/:path*",
  ],
};
