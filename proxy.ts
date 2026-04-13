import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  if (isApiRoute || isLoginPage) {
    return NextResponse.next()
  }

  // Check for session cookie
  const user = request.cookies.get('opp_prep_user')

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
