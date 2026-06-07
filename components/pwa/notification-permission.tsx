/**
 * components/pwa/notification-permission.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Non-intrusive banner that asks authenticated users to enable push
 * notifications. Only shown when:
 *   • The user is logged in (userId is provided)
 *   • The browser supports the Push API
 *   • Permission is still "default" (not yet granted or denied)
 *   • The user hasn't dismissed it before (localStorage key)
 *
 * Design principle: matches the existing Kinetic Void dark glass-card UI.
 * Does NOT modify any existing component or page layout.
 */
"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Storage key to remember user's dismissal ──────────────────────────────────
const DISMISSED_KEY = "kv-notif-banner-dismissed"

// ── Props ─────────────────────────────────────────────────────────────────────
interface NotificationPermissionProps {
  /** Supabase user ID — required before the banner is shown. */
  userId?: string | null
  /** Extra Tailwind classes for the container (optional). */
  className?: string
}

/**
 * Floating notification permission banner.
 * Renders at the bottom of the screen as a fixed overlay.
 * Dismisses gracefully without blocking the page.
 */
export function NotificationPermission({
  userId,
  className,
}: NotificationPermissionProps) {
  const [visible, setVisible] = useState(false)

  const { permission, isSupported, isLoading, requestPermission } =
    usePushNotifications({ userId })

  // ── Decide whether to show the banner ────────────────────────────────────
  useEffect(() => {
    if (!isSupported) return
    if (!userId) return
    if (permission === "granted" || permission === "denied") return

    // Check if the user previously dismissed the banner
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch {
      /* private browsing mode — ignore */
    }

    // Delay appearance slightly so it doesn't flash on page load
    const timer = setTimeout(() => setVisible(true), 4500)
    return () => clearTimeout(timer)
  }, [isSupported, userId, permission])

  // ── Handler: user clicks "Enable" ────────────────────────────────────────
  const handleEnable = async () => {
    setVisible(false)
    const granted = await requestPermission()

    if (granted) {
      toast.success("Notifications enabled!", {
        description: "You'll receive real-time delivery updates.",
        duration: 4000,
      })
    } else {
      // Permission was denied — let the user know how to re-enable
      toast("Notifications blocked", {
        description:
          "To enable later, click the lock icon in your browser's address bar.",
        duration: 6000,
      })
    }
  }

  // ── Handler: user dismisses without enabling ──────────────────────────────
  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, "1")
    } catch {
      /* private browsing mode */
    }
  }

  if (!visible) return null

  return (
    <div
      role="alertdialog"
      aria-label="Enable push notifications"
      aria-live="polite"
      className={cn(
        // Fixed position — bottom-center, above any bottom nav bars
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-[60]",
        "flex items-center gap-3",
        "px-4 py-3 rounded-2xl",
        // Kinetic Void glass-card style (matches existing UI)
        "bg-[rgba(17,17,17,0.96)] backdrop-blur-xl",
        "border border-[rgba(73,72,71,0.25)]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(163,166,255,0.06)]",
        // Responsive width
        "w-[min(22rem,calc(100vw-2rem))]",
        // Entrance animation
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        className
      )}
    >
      {/* Bell icon */}
      <div
        aria-hidden="true"
        className="shrink-0 w-9 h-9 rounded-xl bg-[#a3a6ff]/10 flex items-center justify-center"
      >
        <Bell className="w-4 h-4 text-[#a3a6ff]" />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-[13px] font-semibold leading-tight">
          Enable notifications
        </p>
        <p className="text-[#adaaaa] text-[11px] leading-snug mt-0.5">
          Get real‑time updates for your deliveries
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleEnable}
          disabled={isLoading}
          aria-label="Allow push notifications"
          className={cn(
            "px-3 py-1.5 rounded-lg text-[12px] font-bold",
            "bg-[#a3a6ff] text-[#0f00a4]",
            "hover:brightness-110 active:scale-95 transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? "Enabling…" : "Enable"}
        </button>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
          className="p-1.5 rounded-lg text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-all active:scale-95"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
