"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      )

      if (exchangeError || !data.session) {
        setError(true)
        return
      }

      // Fetch the user's role to redirect to the correct dashboard
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError(true)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      // Log error for debugging but don't block login
      if (profileError) {
        console.error("Role fetch error:", profileError)
      }

      // Fallback to customer role if fetch fails or no data
      const role = profile?.role || "customer"

      // Ensure driver_profiles row exists for drivers (handles re-confirmation)
      if (role === "driver") {
        await supabase
          .from("driver_profiles")
          .upsert({ id: user.id, status: "pending" }, { onConflict: "id" })
      }

      if (role === "admin") {
        router.push("/dashboard/admin")
      } else if (role === "driver") {
        router.push("/dashboard/driver")
      } else {
        router.push("/dashboard/customer")
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Invalid or expired link</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Please request a new confirmation email.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}
