import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin
  const code = requestUrl.searchParams.get("code")
  const signupRole = requestUrl.searchParams.get("role") as "customer" | "driver" | null

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_oauth_code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  const admin = createAdminClient()
  const { data: existing } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  // ── NEW USER ──────────────────────────────────────────────────────────────
  if (!existing) {
    const meta = user.user_metadata ?? {}
    const full_name =
      meta.full_name || meta.name ||
      [meta.given_name, meta.family_name].filter(Boolean).join(" ") ||
      user.email?.split("@")[0] || "User"
    const role = signupRole === "driver" ? "driver" : "customer"

    await admin.from("users").upsert(
      { id: user.id, full_name, role, email: user.email },
      { onConflict: "id" }
    )
    if (role === "driver") {
      await admin.from("driver_profiles").upsert(
        { id: user.id, status: "pending" }, { onConflict: "id" }
      )
    } else {
      await admin.from("customer_profiles").upsert(
        { id: user.id }, { onConflict: "id" }
      )
    }

    if (role === "admin")  return NextResponse.redirect(`${origin}/dashboard/admin`)
    if (role === "driver") return NextResponse.redirect(`${origin}/dashboard/driver`)
    return NextResponse.redirect(`${origin}/dashboard/customer`)
  }

  // ── RETURNING USER — role conflict detection ──────────────────────────────
  const existingRole = existing.role as "customer" | "driver" | "admin"

  if (signupRole && signupRole !== existingRole && existingRole !== "admin") {
    // Same Google account used to sign up with a different role.
    // Auto-add the secondary profile (data of existing role is untouched).
    if (signupRole === "driver") {
      const { data: driverRow } = await supabase
        .from("driver_profiles").select("id").eq("id", user.id).maybeSingle()
      if (!driverRow) {
        await admin.from("driver_profiles").upsert(
          { id: user.id, status: "pending" }, { onConflict: "id" }
        )
      }
    } else {
      const { data: customerRow } = await supabase
        .from("customer_profiles").select("id").eq("id", user.id).maybeSingle()
      if (!customerRow) {
        await admin.from("customer_profiles").upsert(
          { id: user.id }, { onConflict: "id" }
        )
      }
    }
    // Redirect to the confirmation page — explains what happened
    return NextResponse.redirect(
      `${origin}/auth/account-linked?existing=${existingRole}&added=${signupRole}`
    )
  }

  // ── NORMAL LOGIN ──────────────────────────────────────────────────────────
  if (existingRole === "admin")  return NextResponse.redirect(`${origin}/dashboard/admin`)
  if (existingRole === "driver") return NextResponse.redirect(`${origin}/dashboard/driver`)
  return NextResponse.redirect(`${origin}/dashboard/customer`)
}
