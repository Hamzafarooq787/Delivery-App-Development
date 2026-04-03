import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Fetch the user's role to redirect to the right dashboard
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single()

      const role = profile?.role ?? "customer"
      if (role === "admin") return NextResponse.redirect(`${origin}/admin`)
      if (role === "driver") return NextResponse.redirect(`${origin}/driver`)
      return NextResponse.redirect(`${origin}/customer`)
    }
  }

  // Exchange failed or no code — send to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
