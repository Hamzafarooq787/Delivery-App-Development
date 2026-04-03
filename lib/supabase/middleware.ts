import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Detect auth session via Supabase cookie (written by createBrowserClient on sign-in)
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''
  const hasSession =
    !!request.cookies.get('sb-access-token')?.value ||
    !!request.cookies.get(`sb-${projectRef}-auth-token`)?.value

  // Protect dashboard routes
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

  return NextResponse.next({ request })
}
