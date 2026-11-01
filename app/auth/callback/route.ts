import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureVerifiedProfile } from "@/lib/auth-profile"
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
  const requestedRole = requestUrl.searchParams.get("role")
  const signupRole = requestedRole === "driver" || requestedRole === "customer" ? requestedRole : null
  // Set when this code came from a password-recovery email (forgotPassword())
  // that got rescued through here by proxy.ts's stranded-code handling — see
  // below. Distinct from a normal sign-in/OAuth code.
  const type = requestUrl.searchParams.get("type")

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

  // 2b. Password-recovery codes must land on the "set new password" form, not
  // fall through to the normal role-based dashboard redirect below — otherwise
  // the user is silently logged in and never gets a chance to set a new
  // password.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // 3. Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error("[auth/callback] getUser error:", userError?.message)
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  try {
    const role = await ensureVerifiedProfile(user, signupRole ?? "customer")
    if (signupRole && signupRole !== role && role !== "admin") {
      const db = createAdminClient()
      const result = await db.from(signupRole === "driver" ? "driver_profiles" : "customer_profiles")
        .upsert(signupRole === "driver" ? {id:user.id,status:"pending"} : {id:user.id},{onConflict:"id",ignoreDuplicates:true})
      if (result.error) throw new Error("Profile unavailable")
      return NextResponse.redirect(`${origin}/auth/account-linked?existing=${role}&added=${signupRole}`)
    }
    return NextResponse.redirect(`${origin}/dashboard/${role}`)
  } catch {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=profile_unavailable`)
  }
}
