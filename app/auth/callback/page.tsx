"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ensureOAuthUserProfile } from "@/app/actions/auth"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()

      // Exchange the auth code for a session (works for both email confirm & OAuth)
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      )

      if (exchangeError || !data.session) {
        setError(true)
        return
      }

      // Ensure the users table row exists (critical for new OAuth sign-ins)
      // and get back the user's role for correct redirect
      const { role } = await ensureOAuthUserProfile()

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
      <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[#ff6e84] text-2xl">link_off</span>
          </div>
          <p className="text-white font-bold text-base">Invalid or expired link</p>
          <p className="text-[#adaaaa] text-sm">Please request a new confirmation or sign-in link.</p>
          <a href="/login" className="inline-block mt-2 text-[#a3a6ff] hover:text-[#c180ff] font-semibold text-sm transition-colors">
            Back to Sign In
          </a>
        </div>
      </main>
    )
  }

  // Loading state while redirecting
  return (
    <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4">
        {/* Animated logo */}
        <div className="w-14 h-14 rounded-2xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#a3a6ff] text-2xl animate-pulse">bolt</span>
        </div>
        {/* Spinner */}
        <svg className="animate-spin w-5 h-5 text-[#a3a6ff]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-[#adaaaa] text-sm">Signing you in…</p>
      </div>
    </main>
  )
}
