"use client"

import { useState } from "react"
import Link from "next/link"
import { signUp } from "@/app/actions/auth"
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons"
import { googleReverseGeocode } from "@/lib/google"

type Role = "customer" | "driver"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("customer")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [detectingAddress, setDetectingAddress] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function detectAddress() {
    if (!("geolocation" in navigator)) return
    setDetectingAddress(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords
        const place = await googleReverseGeocode(lat, lng).catch(() => null)
        setAddress(place || `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        setDetectingAddress(false)
      },
      () => setDetectingAddress(false)
    )
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    const parts = name.trim().split(" ")
    formData.set("first_name", parts[0] ?? name)
    formData.set("last_name", parts.slice(1).join(" ") || (parts[0] ?? ""))
    formData.set("email", email)
    formData.set("password", password)
    formData.set("role", role)
    formData.set("phone", phone)
    formData.set("address", address)

    const result = await signUp(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      {/* Background glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#a3a6ff]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#c180ff]/5 blur-[100px]" />
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
          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#a3a6ff] text-3xl">mark_email_read</span>
              </div>
              <h2 className="font-headline text-xl font-bold text-white">Check your inbox</h2>
              <p className="text-[#adaaaa] text-sm leading-relaxed">
                We sent a confirmation link to{" "}
                <span className="text-white font-medium">{email}</span>. Click it to activate your account.
              </p>
              {role === "driver" && (
                <p className="text-[#c180ff] text-xs leading-relaxed bg-[#c180ff]/10 border border-[#c180ff]/20 rounded-xl px-4 py-3">
                  Your driver account will be reviewed by an admin before you can accept jobs.
                </p>
              )}
              <Link
                href="/login"
                className="mt-2 text-[#a3a6ff] hover:text-[#c180ff] font-semibold text-sm transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-headline text-xl font-bold text-white mb-1">Create account</h2>
              <p className="text-[#adaaaa] text-sm mb-6">Join Kinetic Void to get started</p>

              {/* Role Toggle */}
              <div className="flex rounded-xl bg-[#1a1919] border border-[#262626] p-1 mb-6">
                {(["customer", "driver"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                      role === r
                        ? "bg-[#a3a6ff] text-[#0f00a4]"
                        : "text-[#adaaaa] hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {r === "customer" ? "person" : "local_shipping"}
                    </span>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>

              {role === "driver" && (
                <div className="mb-6 flex items-start gap-2 bg-[#c180ff]/10 border border-[#c180ff]/20 text-[#c180ff] text-xs rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">info</span>
                  Driver accounts require admin approval before you can accept jobs.
                </div>
              )}

              {error && (
                <div className="mb-6 flex items-center gap-2 bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-sm rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup} className="flex flex-col gap-5">
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                      person
                    </span>
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-[#1a1919] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                    />
                  </div>
                </div>

                {/* Customer-only fields: Phone and Home Address */}
                {role === "customer" && (
                  <>
                    {/* Phone Number */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phone" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                        Phone Number
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                          phone
                        </span>
                        <input
                          id="phone"
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+92 300 1234567"
                          className="w-full bg-[#1a1919] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                        />
                      </div>
                    </div>

                    {/* Home / Default Address */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="address" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                          Home / Default Address
                        </label>
                        <button
                          type="button"
                          onClick={detectAddress}
                          disabled={detectingAddress}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#a3a6ff] hover:text-white transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {detectingAddress ? "hourglass_empty" : "my_location"}
                          </span>
                          {detectingAddress ? "Detecting…" : "📍 Detect"}
                        </button>
                      </div>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                          location_on
                        </span>
                        <input
                          id="address"
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Your home or default address"
                          className="w-full bg-[#1a1919] border border-[#262626] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

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
                  <label htmlFor="password" className="text-xs font-semibold text-[#adaaaa] uppercase tracking-widest">
                    Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#adaaaa] text-[18px]">
                      lock
                    </span>
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
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
                      Creating account...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Create {role === "driver" ? "Driver" : "Customer"} Account
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[#262626]" />
                <span className="text-xs text-[#494847]">or continue with</span>
                <div className="flex-1 h-px bg-[#262626]" />
              </div>

              {/* Social auth — customer only (drivers must use email) */}
              {role === "customer" ? (
                <>
                  <SocialAuthButtons mode="signup" />
                  <p className="text-center text-[10px] text-[#494847] mt-3 leading-relaxed">
                    Social sign-up creates a <span className="text-[#adaaaa]">Customer</span> account.
                    Driver accounts require email registration.
                  </p>
                </>
              ) : (
                <p className="text-center text-xs text-[#adaaaa]/60">
                  Driver accounts require email & password registration.
                </p>
              )}

              <p className="text-center text-sm text-[#adaaaa] mt-5">
                Already have an account?{" "}
                <Link href="/login" className="text-[#a3a6ff] hover:text-[#c180ff] font-semibold transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#494847] mt-6">
          &copy; {new Date().getFullYear()} Kinetic Void. All rights reserved.
        </p>
      </div>
    </main>
  )
}
