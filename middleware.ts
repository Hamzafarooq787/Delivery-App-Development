import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Detect a Supabase session by checking known cookie name patterns.
  // Supabase stores the session in cookies named:
  //   sb-<project-ref>-auth-token        (full token, compact sessions)
  //   sb-<project-ref>-auth-token.0/.1   (chunked tokens)
  //   sb-access-token                    (legacy)
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''

  const cookieName = `sb-${projectRef}-auth-token`
  const hasSession =
    !!request.cookies.get(cookieName)?.value ||
    !!request.cookies.get(`${cookieName}.0`)?.value ||
    !!request.cookies.get(`${cookieName}.1`)?.value ||
    !!request.cookies.get('sb-access-token')?.value

  // Protect dashboard routes — redirect to /login if no session
  const protectedPrefixes = ['/customer', '/driver', '/admin']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))
  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password']
  if (hasSession && authPages.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/customer'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
