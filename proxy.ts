import {createAdminClient} from "@/lib/supabase/admin"
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  // Per Supabase SSR docs: this response object is what carries any
  // refreshed session cookies forward. If we return a *different* response
  // (e.g. a redirect) further down, we must copy these cookies onto it —
  // otherwise a session refresh gets silently dropped and the next request
  // reads a stale/invalid token.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // getAll/setAll (not the deprecated get/set/remove trio) — required
        // for Supabase to correctly read/write session cookies that get
        // split into multiple chunks (sb-<project>-auth-token.0, .1, ...)
        // once the JWT grows past ~4KB. The old singular get/set/remove API
        // only ever sees one chunk, which can silently corrupt or drop the
        // session on the very next request after a successful sign-in.
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  // Copies any refreshed-session cookies from supabaseResponse onto a
  // redirect response before returning it, so a session refresh that
  // happened during this request isn't lost.
  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // RESCUE STRANDED AUTH CODES
  // When a Supabase auth redirect URL isn't in the dashboard's Redirect URLs
  // allowlist, Supabase silently falls back to the Site URL (the home page)
  // and appends ?code=... — leaving the PKCE code unexchanged and the user
  // stuck logged-out on the marketing page. Forward the code to
  // /auth/callback (preserving all query params, e.g. role) so it gets
  // exchanged and the user lands on their dashboard.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/callback"
    return redirectWithCookies(url)
  }

  // PUBLIC ROUTES - always allow access
  if (
    pathname === "/" ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/how-it-works") ||
    pathname.startsWith("/fleet") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/unauthorized") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return supabaseResponse
  }

  // REDIRECT LOGGED-IN USERS AWAY FROM AUTH PAGES
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    return redirectWithCookies(new URL("/dashboard", request.url))
  }

  // Auth pages are public for logged-out users
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return supabaseResponse
  }

  // Driver login is its own page (app/driver/login) — it must not fall into
  // the legacy /driver → /dashboard/driver redirect below, which would send
  // it to a non-existent /dashboard/driver/login.
  if (pathname === "/driver/login") {
    if (user) {
      return redirectWithCookies(new URL("/dashboard", request.url))
    }
    return supabaseResponse
  }

  // REDIRECT OLD ROUTES: /admin → /dashboard/admin, /driver → /dashboard/driver
  if (pathname.startsWith("/admin") && !pathname.startsWith("/dashboard")) {
    return redirectWithCookies(new URL(pathname.replace("/admin", "/dashboard/admin"), request.url))
  }
  if (pathname.startsWith("/driver") && !pathname.startsWith("/dashboard")) {
    return redirectWithCookies(new URL(pathname.replace("/driver", "/dashboard/driver"), request.url))
  }

  // PROTECTED ROUTES - require authentication + role check
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      return redirectWithCookies(new URL("/login", request.url))
    }

    // Fetch the user's role from the users table.
    // RLS policy "Allow user to read own row" permits this select.
    const { data } = await supabase.from("users").select("role,account_status,admin_access").eq("id", user.id).maybeSingle()

    const role = data?.role as "admin" | "driver" | "customer" | undefined
    if(data?.account_status && data.account_status!=='active')return redirectWithCookies(new URL('/unauthorized',request.url))
    if(role==='admin'&&pathname.startsWith('/dashboard/admin')&&pathname!=='/dashboard/admin/security'){
      const config=await createAdminClient().from('surge_pricing_settings').select('operational_settings').eq('id',true).single()
      if(config.error)return new NextResponse('Admin settings are unavailable. Please retry.',{status:503})
      if(config.data.operational_settings?.requireAdminMfa){const level=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(level.error||level.data.currentLevel!=='aal2')return redirectWithCookies(new URL('/dashboard/admin/security',request.url))}
      const section=pathname.split('/')[3]??''
      const allowed:Record<string,string[]>={payments:['finance'],payouts:['finance'],reports:['finance'],settings:['settings'],theme:['settings'],audit:['settings'],marketing:['marketing'],promotions:['settings'],support:['support'],reviews:['support'],disputes:['support'],tracking:['operations'],drivers:['operations'],verification:['operations'],customers:['operations','support'],orders:['operations','finance','support']}
      if(!data?.admin_access?.owner&&allowed[section]&&!allowed[section].some(scope=>data?.admin_access?.scopes?.includes(scope)))return redirectWithCookies(new URL('/unauthorized',request.url))
    }


    // Role-based restriction - block cross-role access.
    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      return redirectWithCookies(new URL("/unauthorized", request.url))
    }

    if (pathname.startsWith("/dashboard/driver") && role !== "driver") {
      return redirectWithCookies(new URL("/unauthorized", request.url))
    }

    if (pathname.startsWith("/dashboard/customer") && role !== "customer") {
      return redirectWithCookies(new URL("/unauthorized", request.url))
    }

    // Bare /dashboard - route to the user's role-appropriate dashboard.
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      if (role === "admin") {
        return redirectWithCookies(new URL("/dashboard/admin", request.url))
      }
      if (role === "driver") {
        return redirectWithCookies(new URL("/dashboard/driver", request.url))
      }
      if (role === "customer") {
        return redirectWithCookies(new URL("/dashboard/customer", request.url))
      }
      // No role assigned yet
      return redirectWithCookies(new URL("/unauthorized", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
