"use client"

/**
 * PushNotificationManager
 *
 * Mounts silently on the driver dashboard layout.
 * On first render it checks whether push notifications are already subscribed;
 * if not it waits for the first user interaction, then auto-subscribes so the
 * driver receives native OS push alerts for new job notifications.
 *
 * The first-interaction requirement satisfies the browser's "user gesture"
 * rule for Notification.requestPermission() on most browsers.
 */

import { useEffect, useRef } from "react"
import { subscribeToPush, isPushSupported } from "@/lib/push-client"

export function PushNotificationManager() {
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (subscribedRef.current) return

    // If permission is already granted, subscribe immediately
    if (Notification.permission === "granted") {
      subscribedRef.current = true
      subscribeToPush().catch(() => {})
      return
    }

    // Otherwise wait for the first click/tap — satisfies the browser gesture rule
    const handleInteraction = () => {
      if (subscribedRef.current) return
      subscribedRef.current = true
      subscribeToPush().catch(() => {})
      cleanup()
    }

    function cleanup() {
      document.removeEventListener("click",      handleInteraction, { capture: true })
      document.removeEventListener("touchstart", handleInteraction, { capture: true })
      document.removeEventListener("keydown",    handleInteraction, { capture: true })
    }

    document.addEventListener("click",      handleInteraction, { capture: true, once: true })
    document.addEventListener("touchstart", handleInteraction, { capture: true, once: true })
    document.addEventListener("keydown",    handleInteraction, { capture: true, once: true })

    return cleanup
  }, [])

  return null   // invisible component
}
