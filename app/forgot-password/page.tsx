"use client"

import { useState } from "react"
import Link from "next/link"
import { Package, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { shortRequest } from "@/lib/short-request"

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const email = String(fd.get("email") ?? "").trim()

    if (!email) {
      setError("Please enter your email address.")
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: resetError } = await shortRequest(supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/reset-password", window.location.origin).href,
      }), 12000)

      if (resetError && resetError.code !== "user_not_found") {
        setError(resetError.status === 429 ? "Too many requests. Please wait and try again." : "Could not request a reset link. Please try again.")
        return
      }
      setSuccess(true)
    } catch {
      setError("The reset request could not be confirmed. Check your inbox before trying again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-md bg-foreground flex items-center justify-center">
              <Package className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-semibold text-foreground">GoDrop</span>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {success ? (
            <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <CheckCircle className="h-5 w-5 text-foreground" />
              </div>
              <p className="text-sm text-foreground font-medium">Check your inbox</p>
              <p className="text-xs text-muted-foreground">If an account exists for that email address, you’ll receive a password reset link. Open it in the same browser you used to request it.</p>
              <Link href="/login" className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors">Back to sign in</Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="recovery-email" className="text-xs font-medium text-foreground">Email</label>
                  <input id="recovery-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com"
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <Button className="w-full" size="sm" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
