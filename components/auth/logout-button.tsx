"use client"

import { createBrowserClient } from "@supabase/ssr"
import { useState, type ReactNode } from "react"

interface LogoutButtonProps {
  className?: string
  children?: ReactNode
  "aria-label"?: string
}

export function LogoutButton({
  className,
  children,
  "aria-label": ariaLabel = "Sign out",
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    if (isLoading) return
    setIsLoading(true)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Detach only this browser before signing out; other devices stay registered.
    try {
      const token = localStorage.getItem("godrop-device-token")
      if (token) {
        const response = await fetch("/api/notifications/token", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),signal:AbortSignal.timeout(5000)})
        if (response.ok) localStorage.removeItem("godrop-device-token")
      }
    } catch { /* A missing/offline push service must not prevent sign-out. */ }

    // Clear the Supabase session in the browser
    await supabase.auth.signOut()

    // Force a full reload so middleware re-evaluates auth state
    window.location.href = "/login"
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  )
}
