import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set(name, value, options)
        },
        remove(name, options) {
          response.cookies.set(name, "", options)
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

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
    return response
  }

  // REDIRECT LOGGED-IN USERS AWAY FROM AUTH PAGES
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Auth pages are public for logged-out users
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return response
  }

  // REDIRECT OLD ROUTES: /admin → /dashboard/admin, /driver → /dashboard/driver
  if (pathname.startsWith("/admin") && !pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL(pathname.replace("/admin", "/dashboard/admin"), request.url))
  }
  if (pathname.startsWith("/driver") && !pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL(pathname.replace("/driver", "/dashboard/driver"), request.url))
  }

  // PROTECTED ROUTES - require authentication + role check
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Fetch the user's role from the users table.
    // RLS policy "Allow user to read own row" permits this select.
    const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()

    const role = data?.role as "admin" | "driver" | "customer" | undefined

    // Role-based restriction - block cross-role access.
    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    if (pathname.startsWith("/dashboard/driver") && role !== "driver") {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    if (pathname.startsWith("/dashboard/customer") && role !== "customer") {
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // Bare /dashboard - route to the user's role-appropriate dashboard.
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      if (role === "admin") {
        return NextResponse.redirect(new URL("/dashboard/admin", request.url))
      }
      if (role === "driver") {
        return NextResponse.redirect(new URL("/dashboard/driver", request.url))
      }
      if (role === "customer") {
        return NextResponse.redirect(new URL("/dashboard/customer", request.url))
      }
      // No role assigned yet
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
