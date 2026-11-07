"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { shortRequest } from "@/lib/short-request"

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "invalid">("checking")

  useEffect(() => {
    let active = true
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    if (url.searchParams.has("error") || hash.has("error")) {
      setSessionState("invalid")
      return
    }

    // The callback saves the recovery session before rendering this page.
    // A plain visit or expired session must not show the password form.
    void (async () => {
      try {
        const { data, error } = await shortRequest(createClient().auth.getUser(), 10000)
        if (active) setSessionState(data.user && !error ? "ready" : "invalid")
      } catch {
        if (active) setSessionState("invalid")
      }
    })()
    return () => { active = false }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sessionState !== "ready") return
    setError(null)
    const fd = new FormData(e.currentTarget)
    const password = fd.get("password") as string
    const confirm = fd.get("confirm") as string
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await shortRequest(supabase.auth.updateUser({ password }), 12000)
      if (updateError) {
        setError(updateError.message)
        return
      }

      // Clear this recovery session and require sign-in with the new password.
      const { error: signOutError } = await shortRequest(supabase.auth.signOut({ scope: "local" }), 10000)
      if (signOutError) {
        setError("Your password was changed, but we couldn’t sign you out. Sign out before using your new password.")
        return
      }
      window.location.replace("/login?reset=success")
    } catch {
      setError("We couldn’t finish the reset. Try signing in with your new password or request another link.")
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
          <h1 className="text-2xl font-semibold text-foreground">Set new password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Choose a strong, unique password.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {error && (
            <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {sessionState === "checking" ? (
            <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
              Checking reset link…
            </div>
          ) : sessionState === "invalid" ? (
            <div role="alert" className="space-y-3 text-sm">
              <p>This password reset link is invalid or has expired. Open your latest reset email in the same browser you used to request it.</p>
              <Link href="/forgot-password" className="inline-flex min-h-11 items-center underline">Request a new reset link</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-password" className="text-xs font-medium text-foreground">New Password</label>
                <input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Min. 8 characters"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reset-confirm" className="text-xs font-medium text-foreground">Confirm Password</label>
                <input id="reset-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} placeholder="••••••••"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <Button className="w-full" size="sm" type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
