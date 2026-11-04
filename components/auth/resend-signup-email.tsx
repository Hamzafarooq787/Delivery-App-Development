"use client"

import { useState } from "react"
import { shortRequest } from "@/lib/short-request"

export function ResendSignupEmail({ knownEmail }: { knownEmail?: string }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [cooldown, setCooldown] = useState(0)

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || Date.now() < cooldown) return
    setLoading(true)
    setMessage("")
    try {
      const body = new FormData()
      body.set("email", knownEmail ?? email)
      const result = await shortRequest((async () => {
        const response = await fetch("/api/auth/resend", { method: "POST", body, signal: AbortSignal.timeout(10500) })
        return await response.json()
      })(), 11000)
      if (!result.success) {
        setMessage(result.error || "Could not request a new email. Try again in a few minutes.")
        return
      }
      setMessage("If this address still needs confirmation, a new link will arrive shortly. Check your spam folder too.")
      setCooldown(Date.now() + 60000)
      window.setTimeout(() => setCooldown(0), 60000)
    } catch {
      setMessage("Could not check the email request. Check your inbox before trying again.")
    } finally {
      setLoading(false)
    }
  }

  return <form onSubmit={resend} className="flex w-full flex-col gap-3">
    {!knownEmail && <label className="text-sm text-[#adaaaa]">
      Email address
      <input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" className="mt-1 w-full rounded-xl border border-[#262626] bg-[#1a1919] px-4 py-3 text-white" />
    </label>}
    <button type="submit" disabled={loading || cooldown > 0} className="rounded-xl border border-[#333] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-60">
      {loading ? "Requesting…" : "Resend confirmation email"}
    </button>
    {message && <p role="status" className="text-sm text-[#adaaaa]">{message}</p>}
  </form>
}
