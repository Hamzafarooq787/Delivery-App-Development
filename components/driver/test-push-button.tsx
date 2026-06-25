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
      const res = await fetch("/api/notifications/debug?send=1")
      const data = await res.json()

      if (data?.testSend?.successCount > 0) {
        toast.info("Test push sent! Toast should appear above this message shortly.", {
          duration: 10_000,
        })
      } else if (data?.testSend?.successCount === 0) {
        toast.warning("Push sent but FCM reported 0 successes — token may be stale. Try reloading.", {
          duration: 8_000,
        })
      } else if (typeof data?.testSend === "string" && data.testSend.startsWith("SKIPPED")) {
        toast.error(`Debug: ${data.testSend}`, { duration: 8_000 })
      } else {
        toast.success("Push dispatched via FCM", { duration: 6_000 })
      }
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
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#a3a6ff] border border-[#a3a6ff]/30 hover:bg-[#a3a6ff]/10 active:scale-95 transition-all disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">notifications_active</span>
      {loading ? "Sending…" : "Test Push"}
    </button>
  )
}
