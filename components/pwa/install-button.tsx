"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallButton() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Hide if already running as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    setIsReady(true)

    // Capture native prompt if available
    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  // Hidden when running as installed PWA
  if (isInstalled || !isReady) return null

  // Chrome/Android/Desktop: one-tap native install if prompt is available
  if (deferredPrompt) {
    return (
      <button
        onClick={async () => {
          setInstalling(true)
          await deferredPrompt.prompt()
          const { outcome } = await deferredPrompt.userChoice
          if (outcome === "accepted") setIsInstalled(true)
          setDeferredPrompt(null)
          setInstalling(false)
        }}
        disabled={installing}
        title="Install app"
        className="flex items-center gap-1.5 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 border border-[#a3a6ff]/25 text-[#a3a6ff] text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-60 select-none"
      >
        {installing ? (
          <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <span className="material-symbols-outlined text-[15px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            download
          </span>
        )}
        <span className="hidden sm:inline">{installing ? "Installing…" : "Install App"}</span>
      </button>
    )
  }

  // iOS / Firefox / other: link to the full download guide page
  return (
    <Link
      href="/download"
      title="Get the app"
      className="flex items-center gap-1.5 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 border border-[#a3a6ff]/25 text-[#a3a6ff] text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 select-none"
    >
      <span className="material-symbols-outlined text-[15px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
        download
      </span>
      <span className="hidden sm:inline">Install App</span>
    </Link>
  )
}
