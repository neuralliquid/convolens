import { NextResponse, type NextRequest } from 'next/server'

const sessionCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

export function proxy(request: NextRequest) {
  const hasSessionCookie = sessionCookieNames.some((name) => request.cookies.has(name))

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()
  response.headers.set('x-theme', request.cookies.get('theme')?.value || 'light')
  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/personal/:path*',
    '/groups/:path*',
    '/settings/:path*',
    '/notifications/:path*',
    '/customize/:path*',
    '/distribution/:path*',
    '/cross-platform-groups/:path*',
    '/moodboard/:path*',
  ],
}
