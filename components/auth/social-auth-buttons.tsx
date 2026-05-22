"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Props = {
  /** Shown below the buttons, e.g. "Already have an account? Sign in" */
  mode?: "signin" | "signup"
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

// Official Google G SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// Apple logo SVG
function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.5-167.3-107.4C67.3 742.5 0 624.8 0 510.5c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
  )
}

export function SocialAuthButtons({ mode = "signin" }: Props) {
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingApple, setLoadingApple] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const busy = loadingGoogle || loadingApple

  async function handleOAuth(provider: "google" | "apple") {
    setError(null)
    if (provider === "google") setLoadingGoogle(true)
    else setLoadingApple(true)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === "google"
            ? { access_type: "offline", prompt: "consent" }
            : undefined,
        },
      })

      if (error) {
        setError(error.message)
        setLoadingGoogle(false)
        setLoadingApple(false)
      }
      // On success the browser redirects — no need to reset loading
    } catch {
      setError("Something went wrong. Please try again.")
      setLoadingGoogle(false)
      setLoadingApple(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-center gap-2 bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] text-xs rounded-xl px-3 py-2.5">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {/* Google */}
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={busy}
        className="relative w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm rounded-xl py-3 px-4 border border-gray-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
      >
        {loadingGoogle ? <Spinner /> : <GoogleIcon />}
        <span>Continue with Google</span>
      </button>

      {/* Apple */}
      <button
        type="button"
        onClick={() => handleOAuth("apple")}
        disabled={busy}
        className="relative w-full flex items-center justify-center gap-3 bg-black hover:bg-[#111] text-white font-semibold text-sm rounded-xl py-3 px-4 border border-[#333] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
      >
        {loadingApple ? <Spinner /> : <AppleIcon />}
        <span>Continue with Apple</span>
      </button>
    </div>
  )
}
