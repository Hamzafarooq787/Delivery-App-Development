"use client"

import { useState } from "react"
import { toast } from "sonner"

/**
 * Dev-only button that fires a self-addressed test push while keeping
 * the dashboard tab open and visible.
 *
 * Uses fetch() instead of navigation so the push arrives while the user
 * is already looking at the dashboard — the Sonner toast is impossible
 * to miss this way.
 *
 * Remove this component once push notifications are confirmed working in prod.
 */
export function TestPushButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications/send", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({test:true})})
      const data = await res.json()

      if (!res.ok) toast.error(data.error ?? "Could not send test notification.")
      else if (data.successCount > 0) toast.success("Test notification sent.")
      else toast.warning("No device received the test. Check notification permission and your notification settings.")
    } catch {
      toast.error("Failed to reach debug endpoint", { duration: 6_000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Send a test push notification to yourself"
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[var(--brand-soft)] border border-[var(--brand-strong)]/30 hover:bg-[var(--brand-strong)]/10 active:scale-95 transition-all disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">notifications_active</span>
      {loading ? "Sending…" : "Test Push"}
    </button>
  )
}

