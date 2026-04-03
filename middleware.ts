import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''

  const base = `sb-${projectRef}-auth-token`
  const hasSession =
    !!request.cookies.get(base)?.value ||
    !!request.cookies.get(`${base}.0`)?.value ||
    !!request.cookies.get(`${base}.1`)?.value ||
    !!request.cookies.get('sb-access-token')?.value

  const protectedPrefixes = ['/customer', '/driver', '/admin']
  if (protectedPrefixes.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

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
