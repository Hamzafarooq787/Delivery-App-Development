"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Platform = "chrome" | "ios" | "other" | "installed" | "loading"

export function InstallButton() {
  const [platform, setPlatform] = useState<Platform>("loading")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA — hide button
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setPlatform("installed")
      return
    }

    // iOS Safari detection
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    if (isIOS) {
      setPlatform("ios")
      return
    }

    // Chrome / Edge / Samsung / Android — listen for native prompt
    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setPlatform("chrome")
    }
    window.addEventListener("beforeinstallprompt", handler)

    // If the browser doesn't fire beforeinstallprompt within 1.5s,
    // still show the button with a manual install guide
    const timer = setTimeout(() => {
      setPlatform((prev) => (prev === "loading" ? "other" : prev))
    }, 1500)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      clearTimeout(timer)
    }
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      setInstalling(true)
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        setInstalled(true)
        setPlatform("installed")
      }
      setDeferredPrompt(null)
      setInstalling(false)
    } else {
      setShowModal(true)
    }
  }

  if (platform === "installed" || installed) return null
  if (platform === "loading") return null

  return (
    <>
      {/* ── Install pill button ─────────────────────────────────────────── */}
      <button
        onClick={handleInstall}
        disabled={installing}
        title="Install Kinetic Void app"
        className="relative flex items-center gap-1.5 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 border border-[#a3a6ff]/25 text-[#a3a6ff] text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-60 select-none"
      >
        {installing ? (
          <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <span
            className="material-symbols-outlined text-[15px] shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            download
          </span>
        )}
        <span className="hidden sm:inline">
          {installing ? "Installing…" : "Install App"}
        </span>
      </button>

      {/* ── Instructions modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-sm bg-[#1a1919] border border-[#494847]/30 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-[#262626] text-[#adaaaa] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">Install Kinetic Void</p>
                <p className="text-[#adaaaa] text-xs">Add to your home screen</p>
              </div>
            </div>

            {/* iOS */}
            {platform === "ios" && (
              <div className="space-y-3">
                {[
                  { icon: "ios_share",          label: "Tap the Share button",       sub: "at the bottom of Safari" },
                  { icon: "add_box",             label: 'Tap "Add to Home Screen"',   sub: "scroll down in the share sheet" },
                  { icon: "touch_app",           label: 'Tap "Add"',                 sub: "to confirm installation" },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#262626] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[#a3a6ff] text-[16px]">{s.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-semibold">{s.label}</p>
                      <p className="text-[11px] text-[#adaaaa]">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chrome / other */}
            {(platform === "chrome" || platform === "other") && (
              <div className="space-y-3">
                {[
                  { icon: "more_vert",           label: "Open your browser menu",      sub: "Click the ⋮ icon in the top-right" },
                  { icon: "add_to_home_screen",  label: 'Click "Install app"',         sub: 'or "Add to Home Screen"' },
                  { icon: "check_circle",        label: "Done!",                       sub: "Kinetic Void is now on your device" },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#262626] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[#a3a6ff] text-[16px]">{s.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-semibold">{s.label}</p>
                      <p className="text-[11px] text-[#adaaaa]">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-5 w-full text-center text-xs text-[#494847] hover:text-[#adaaaa] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
