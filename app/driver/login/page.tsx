"use client"

import { BrandLogo } from '@/components/shared/brand-logo'
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { signInAsDriver } from "@/app/actions/auth"

export default function DriverLoginPage() {
  return (
    <Suspense fallback={null}>
      <DriverLoginContent />
    </Suspense>
  )
}

function DriverLoginContent() {
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered") === "1"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signInAsDriver(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      {/* Background glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[var(--color-secondary)]/5 blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-[var(--color-primary)]/3 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/" className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-3xl">local_shipping</span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold text-white tracking-tight">
              GO DROP
            </h1>
          </Link>
          <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest">Driver Portal</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#1a1919] rounded-2xl border border-[#262626] p-8 shadow-2xl">
          <h2 className="font-headline text-xl font-bold text-white mb-1">Driver Sign In</h2>
          <p className="text-[#adaaaa] text-sm mb-8">Access your driver dashboard to manage deliveries.</p>

          {registered && !error && (
            <div className="mb-6 flex items-start gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">mark_email_read</span>
              <span>Account created! Check your email to confirm, then sign in here.</span>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-2 bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <form action={handleLogin} className="flex flex-col gap-5">
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
                  name="email"
                  type="email"
                  required
                  placeholder="driver@example.com"
                  className="w-full bg-[#131313] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/60 focus:ring-1 focus:ring-[var(--color-primary)]/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                  Password
                </label>
                <Link href="/login" className="text-xs text-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#131313] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/60 focus:ring-1 focus:ring-[var(--color-primary)]/30 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-[var(--color-primary-fixed-dim)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(var(--brand-rgb),0.25)]"
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
                  Sign In to Driver Portal
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#262626]" />
            <span className="text-xs text-[#494847]">or</span>
            <div className="flex-1 h-px bg-[#262626]" />
          </div>

          <p className="text-center text-sm text-[#adaaaa]">
            New driver?{" "}
            <Link href="/signup" className="text-[var(--color-primary)] hover:text-[var(--color-secondary)] font-semibold transition-colors">
              Create driver account
            </Link>
          </p>
        </div>

        {/* Links */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link href="/login" className="text-xs text-[#494847] hover:text-[#adaaaa] transition-colors">
            Customer Sign In
          </Link>
          <span className="text-[#494847]">·</span>
          <Link href="/" className="text-xs text-[#494847] hover:text-[#adaaaa] transition-colors">
            Back to Home
          </Link>
        </div>

        <p className="text-center text-xs text-[#494847] mt-4">
          &copy; {new Date().getFullYear()} Go Drop. All rights reserved.
        </p>
      </div>
    </main>
  )
}

