import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Only run middleware on:
     * - /login and /signup (to redirect already-authenticated users)
     * - /dashboard/* (protected routes)
     * - /admin/* (protected routes)
     * - /driver/* (protected routes)
     *
     * Public routes like /, /about, /contact, /how-it-works, /fleet
     * are intentionally excluded so they are never intercepted.
     */
    '/login',
    '/signup',
    '/dashboard/:path*',
    '/admin/:path*',
    '/driver/:path*',
  ],
}
