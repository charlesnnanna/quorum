import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let BetterAuth handle its own routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Check for BetterAuth session token cookie
  // This avoids importing auth.ts which pulls in pg (Node.js-only)
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ??
    request.cookies.get('__Secure-better-auth.session_token')?.value

  const hasSession = !!sessionToken

  // Protect (app) routes — redirect to /login if no session
  if (
    !hasSession &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/register')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (hasSession && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}