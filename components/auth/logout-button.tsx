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
