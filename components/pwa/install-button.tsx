"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type InstallState = "idle" | "available" | "ios" | "installed"

export function InstallButton() {
  const [state, setState] = useState<InstallState>("idle")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    // Already installed as PWA?
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setState("installed")
      return
    }

    // iOS detection
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(navigator as unknown as { standalone?: boolean }).standalone

    if (isIOS) {
      // Only show if user hasn't dismissed before
      const dismissed = localStorage.getItem("kv-pwa-ios-dismissed")
      if (!dismissed) setState("ios")
      return
    }

    // Chrome / Edge / Android — listen for install prompt
    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setState("available")
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setState("installed")
    }
    setDeferredPrompt(null)
    setInstalling(false)
  }

  function dismissIOS() {
    localStorage.setItem("kv-pwa-ios-dismissed", "1")
    setState("idle")
    setShowIOSHint(false)
  }

  if (state === "installed" || state === "idle") return null

  // ── iOS hint popup ──────────────────────────────────────────────────────────
  if (state === "ios") {
    return (
      <>
        {/* Trigger button */}
        <button
          onClick={() => setShowIOSHint((v) => !v)}
          className="relative flex items-center gap-1.5 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 border border-[#a3a6ff]/25 text-[#a3a6ff] text-[11px] font-bold px-3 py-1.5 rounded-full transition-all"
          aria-label="Install app"
        >
          <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            download
          </span>
          <span className="hidden sm:inline">Install</span>
        </button>

        {/* iOS instructions popover */}
        {showIOSHint && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center" onClick={dismissIOS}>
            <div
              className="relative w-full max-w-sm bg-[#1a1919] border border-[#494847]/30 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={dismissIOS}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-[#262626] text-[#adaaaa] hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    bolt
                  </span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Install Kinetic Void</p>
                  <p className="text-[#adaaaa] text-xs">Add to your home screen</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { icon: "ios_share", label: "Tap the Share button", sub: "at the bottom of Safari" },
                  { icon: "add_box", label: "Tap \"Add to Home Screen\"", sub: "scroll down in the share menu" },
                  { icon: "touch_app", label: "Tap \"Add\"", sub: "to confirm the installation" },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#262626] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#a3a6ff] text-[16px]">{step.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{step.label}</p>
                      <p className="text-[11px] text-[#adaaaa]">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={dismissIOS}
                className="mt-5 w-full text-center text-xs text-[#494847] hover:text-[#adaaaa] transition-colors"
              >
                Don&apos;t show again
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Chrome / Android / Desktop install button ──────────────────────────────
  return (
    <button
      onClick={handleInstall}
      disabled={installing}
      className="relative flex items-center gap-1.5 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 border border-[#a3a6ff]/25 text-[#a3a6ff] text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-60"
      aria-label="Install app"
    >
      {installing ? (
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          download
        </span>
      )}
      <span className="hidden sm:inline">{installing ? "Installing…" : "Install"}</span>
    </button>
  )
}
