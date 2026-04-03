import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Read the Supabase auth token cookie (set by @supabase/ssr on sign-in)
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.cookies.get(
      `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`,
    )?.value

  // A session exists if the cookie is present and non-empty
  const hasSession = !!accessToken

  // Protected route groups — redirect unauthenticated users to /login
  const protectedPrefixes = ['/customer', '/driver', '/admin']
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  )
  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect already-logged-in users away from auth pages
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password']
  if (hasSession && authPages.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/customer'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

