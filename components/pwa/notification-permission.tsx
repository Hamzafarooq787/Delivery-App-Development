/**
 * components/pwa/notification-permission.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Non-intrusive banner that asks authenticated users to enable push
 * notifications. Only shown when:
 *   • The user is logged in (userId is provided)
 *   • The browser supports the Push API (or is iOS Safari → install prompt)
 *   • Permission is still "default" (not yet granted or denied)
 *   • The user hasn't dismissed it before (localStorage key)
 *
 * Platform handling:
 *   iOS Safari (browser)  → Push API unavailable → "Add to Home Screen" tip
 *   iOS PWA / Android     → Normal "Enable" button → Notification.requestPermission()
 *   Desktop               → Normal "Enable" button
 */
"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Storage key to remember user's dismissal ──────────────────────────────────
const DISMISSED_KEY = "kv-notif-banner-dismissed"

// ── iOS detection helpers ─────────────────────────────────────────────────────

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
}

function isInstalledPWA(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  )
}

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
  const [isIOSSafari, setIsIOSSafari] = useState(false)

  const { permission, isSupported, isLoading, requestPermission } =
    usePushNotifications({ userId })

  // ── Decide whether to show the banner ────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const iosSafari = isIOSDevice() && !isInstalledPWA()
    setIsIOSSafari(iosSafari)

    // iOS Safari: Push API not available but we still want to show the
    // "Add to Home Screen" tip. Check the dismiss flag and show after delay.
    if (iosSafari) {
      try {
        if (localStorage.getItem(DISMISSED_KEY)) return
      } catch { /* private browsing mode */ }
      const timer = setTimeout(() => setVisible(true), 4500)
      return () => clearTimeout(timer)
    }

    if (!isSupported) return
    if (permission === "granted") return

    // For denied: show the banner so the user knows how to fix it
    if (permission === "denied") {
      const timer = setTimeout(() => setVisible(true), 4500)
      return () => clearTimeout(timer)
    }

    // For default: check if the user previously dismissed the banner
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch { /* private browsing mode */ }

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
      toast("Notifications blocked", {
        description:
          "To enable later, tap the lock icon in your browser's address bar.",
        duration: 6000,
      })
    }
  }

  // ── Handler: user dismisses without enabling ──────────────────────────────
  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, "1")
    } catch { /* private browsing mode */ }
  }

  if (!visible) return null

  const isBlocked = !isIOSSafari && permission === "denied"

  return (
    <div
      role="alertdialog"
      aria-label={
        isIOSSafari
          ? "Install app to enable notifications"
          : isBlocked
            ? "Push notifications are blocked"
            : "Enable push notifications"
      }
      aria-live="polite"
      className={cn(
        // bottom-24 (96px) ensures the banner clears the bottom nav (h-16 = 64px)
        // even on iOS with home indicator safe-area inset (~34px)
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[60]",
        "flex items-center gap-3",
        "px-4 py-3 rounded-2xl",
        "bg-[rgba(17,17,17,0.96)] backdrop-blur-xl",
        isBlocked
          ? "border border-[#ff6e84]/40"
          : isIOSSafari
            ? "border border-[#f5a623]/40"
            : "border border-[rgba(73,72,71,0.25)]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(163,166,255,0.06)]",
        "w-[min(22rem,calc(100vw-2rem))]",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        className
      )}
    >
      {/* Icon */}
      <div
        aria-hidden="true"
        className={cn(
          "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
          isBlocked
            ? "bg-[#ff6e84]/10"
            : isIOSSafari
              ? "bg-[#f5a623]/10"
              : "bg-[#a3a6ff]/10"
        )}
      >
        <Bell
          className={cn(
            "w-4 h-4",
            isBlocked ? "text-[#ff6e84]" : isIOSSafari ? "text-[#f5a623]" : "text-[#a3a6ff]"
          )}
        />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        {isIOSSafari ? (
          <>
            <p className="text-[#f5a623] text-[13px] font-semibold leading-tight">
              Enable notifications
            </p>
            <p className="text-[#adaaaa] text-[11px] leading-snug mt-0.5">
              Tap Share → "Add to Home Screen" to receive delivery alerts
            </p>
          </>
        ) : isBlocked ? (
          <>
            <p className="text-[#ff6e84] text-[13px] font-semibold leading-tight">
              Notifications blocked
            </p>
            <p className="text-[#adaaaa] text-[11px] leading-snug mt-0.5">
              Tap the lock icon in your address bar to re‑enable
            </p>
          </>
        ) : (
          <>
            <p className="text-white text-[13px] font-semibold leading-tight">
              Enable notifications
            </p>
            <p className="text-[#adaaaa] text-[11px] leading-snug mt-0.5">
              Get real‑time updates for your deliveries
            </p>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!isBlocked && !isIOSSafari && (
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
        )}

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="p-1.5 rounded-lg text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-all active:scale-95"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
