"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resetSuccess = searchParams.get("reset") === "success"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Get the logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Sign in failed. Please try again.")
      setLoading(false)
      return
    }

    // Fetch role from database
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      setError("Unable to load your account. Please try again.")
      setLoading(false)
      return
    }

    // Redirect based on role (with null safety — default to customer)
    const role = profile?.role ?? "customer"

    if (role === "admin") {
      router.push("/dashboard/admin")
    } else if (role === "driver") {
      router.push("/dashboard/driver")
    } else {
      router.push("/dashboard/customer")
    }

    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      {/* Background glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#a3a6ff]/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#c180ff]/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/" className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a3a6ff] text-2xl">bolt</span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold text-white tracking-tight">
              KINETIC VOID
            </h1>
          </Link>
          <p className="text-[#adaaaa] text-sm mt-1">Premium Logistics Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl border border-[#262626] p-8">
          <h2 className="font-headline text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-[#adaaaa] text-sm mb-8">Sign in to your account to continue</p>

          {resetSuccess && !error && (
            <div className="mb-6 flex items-center gap-2 bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Password reset successfully. Please sign in with your new password.
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-2 bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#1a1919] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                  Password
                </label>
                <button type="button" className="text-xs text-[#a3a6ff] hover:text-[#c180ff] transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1a1919] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full milled-gradient text-white font-semibold text-sm rounded-xl py-3 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed glow-primary"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#262626]" />
            <span className="text-xs text-[#494847]">or</span>
            <div className="flex-1 h-px bg-[#262626]" />
          </div>

          {/* Sign up */}
          <p className="text-center text-sm text-[#adaaaa]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#a3a6ff] hover:text-[#c180ff] font-semibold transition-colors">
              Create account
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#494847] mt-6">
          &copy; {new Date().getFullYear()} Kinetic Void. All rights reserved.
        </p>
      </div>
    </main>
  )
}
