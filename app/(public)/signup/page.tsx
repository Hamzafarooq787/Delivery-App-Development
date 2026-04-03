"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function SignupPage() {
  const [role, setRole] = useState<"customer" | "driver">("customer")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const email = fd.get("email") as string
    const password = fd.get("password") as string
    const full_name = `${fd.get("first_name")} ${fd.get("last_name")}`.trim()
    const phone = (fd.get("phone") as string) || null

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes("already")) {
        setError("An account with this email already exists.")
      } else if (authError.message.toLowerCase().includes("password")) {
        setError("Password is too weak. Use at least 8 characters.")
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <CheckCircle className="h-6 w-6 text-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Check your email</h1>
          <p className="text-sm text-muted-foreground mb-6">
            We sent a confirmation link to your email. Please click it to activate your account before signing in.
          </p>
          <Button size="sm" variant="outline" onClick={() => router.push("/login")}>Go to Sign In</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-md bg-foreground flex items-center justify-center">
              <Package className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-semibold text-foreground">SwiftDeliver</span>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Create an account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Join SwiftDeliver today</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 grid grid-cols-2 rounded-lg border border-border p-1 gap-1">
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`rounded-md py-2 text-xs font-medium transition-colors ${role === "customer" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`rounded-md py-2 text-xs font-medium transition-colors ${role === "driver" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Driver
            </button>
          </div>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">First Name</label>
                <input name="first_name" type="text" required placeholder="John"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Last Name</label>
                <input name="last_name" type="text" required placeholder="Doe"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email</label>
              <input name="email" type="email" required placeholder="you@example.com"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Phone</label>
              <input name="phone" type="tel" placeholder="+1 (555) 000-0000"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Password</label>
              <input name="password" type="password" required placeholder="Min. 8 characters" minLength={8}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <Button className="w-full" size="sm" type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline">Terms of Service</Link>{" "}and{" "}
          <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
