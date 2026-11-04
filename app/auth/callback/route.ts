import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureVerifiedProfile } from "@/lib/auth-profile"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirect = (path: string) => NextResponse.redirect(new URL(path,url.origin))
  const code = url.searchParams.get("code")
  const requested = url.searchParams.get("role")
  const signupRole = requested === "driver" || requested === "customer" ? requested : null
  if (!code) return redirect(signupRole ? "/auth/confirm" : "/login?error=missing_oauth_code")
  const deadline = AbortSignal.timeout(12000)
  const boundedFetch: typeof fetch = (input, init) => fetch(input,{
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal,deadline]) : deadline,
  })
  let exchanged = false
  try {
    const supabase = await createClient(boundedFetch)
    // A PKCE code is single-use. Start a fresh sign-in after an uncertain exchange.
    const {data,error} = await supabase.auth.exchangeCodeForSession(code)
    if (error && signupRole && ["AuthPKCECodeVerifierMissingError", "AuthPKCEGrantCodeExchangeError"].includes(error.name)) {
      return redirect("/login?confirmation=check")
    }
    if (error && signupRole && ["bad_code_verifier", "flow_state_not_found", "flow_state_expired"].includes(error.code ?? "")) {
      return redirect("/login?confirmation=check")
    }
    if (error) return redirect(deadline.aborted || (error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError"
      ? "/login?error=oauth_unavailable" : "/login?error=oauth_failed")
    exchanged = true
    if (!data.user) return redirect("/login?error=no_user")
    if (url.searchParams.get("type") === "recovery") return redirect("/reset-password")

    const db = createAdminClient(boundedFetch)
    const role = await ensureVerifiedProfile(data.user,signupRole ?? "customer",db)
    if (signupRole && signupRole !== role && role !== "admin") {
      const result = await db.from(signupRole === "driver" ? "driver_profiles" : "customer_profiles")
        .upsert(signupRole === "driver" ? {id:data.user.id,status:"pending"} : {id:data.user.id},{onConflict:"id",ignoreDuplicates:true})
      if (result.error) return redirect("/login?error=profile_unavailable")
      return redirect(`/auth/account-linked?existing=${role}&added=${signupRole}`)
    }
    return redirect(`/dashboard/${role}`)
  } catch {
    return redirect(deadline.aborted || !exchanged ? "/login?error=oauth_unavailable" : "/login?error=profile_unavailable")
  }
}
