import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * OAuth / email-confirmation callback.
 *
 * Supabase redirects here with ?code=<PKCE code>.
 * We exchange the code for a session server-side (required by @supabase/ssr),
 * ensure the public.users row exists, then redirect to the right dashboard.
 *
 * The `role` query param is set by SocialAuthButtons when the user picks
 * Customer or Driver on the signup page. It controls which profile table
 * row gets created for first-time OAuth sign-ups.
 *
 * Using `origin` from the request URL means this NEVER hard-codes localhost
 * or any other domain — it always redirects back to wherever it was called from.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin   // e.g. https://your-app.vercel.app
  const code   = requestUrl.searchParams.get("code")
  // Role passed by the signup page via redirectTo URL — used only for new users
  const signupRole = requestUrl.searchParams.get("role") as "customer" | "driver" | null

  // 1. Must have a code
  if (!code) {
    console.error("[auth/callback] No code in request URL")
    return NextResponse.redirect(`${origin}/login?error=missing_oauth_code`)
  }

  // 2. Exchange PKCE code for session (server-side — required by @supabase/ssr)
  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession error:", exchangeError.message)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // 3. Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error("[auth/callback] getUser error:", userError?.message)
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // 4. Check if a public.users row already exists (returning user)
  const { data: existing } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  let role = existing?.role ?? "customer"

  // 5. First-time OAuth user — create profile rows via admin client (bypasses RLS)
  if (!existing) {
    const admin = createAdminClient()
    const meta = user.user_metadata ?? {}
    const full_name =
      meta.full_name ||
      meta.name ||
      [meta.given_name, meta.family_name].filter(Boolean).join(" ") ||
      user.email?.split("@")[0] ||
      "User"

    // Use the role passed from the signup page; fall back to "customer"
    role = signupRole === "driver" ? "driver" : "customer"

    // Create the shared users row
    await admin
      .from("users")
      .upsert(
        { id: user.id, full_name, role, email: user.email },
        { onConflict: "id" }
      )

    // Create the role-specific profile row
    if (role === "driver") {
      await admin
        .from("driver_profiles")
        .upsert({ id: user.id, status: "pending" }, { onConflict: "id" })
    } else {
      await admin
        .from("customer_profiles")
        .upsert({ id: user.id }, { onConflict: "id" })
    }
  }

  // 6. Redirect to the correct dashboard based on role
  if (role === "admin")  return NextResponse.redirect(`${origin}/dashboard/admin`)
  if (role === "driver") return NextResponse.redirect(`${origin}/dashboard/driver`)
  return NextResponse.redirect(`${origin}/dashboard/customer`)
}
