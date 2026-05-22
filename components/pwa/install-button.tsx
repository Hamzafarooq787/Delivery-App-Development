"use client"

import { useEffect, useRef, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Platform = "chrome" | "ios" | "other"

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other"
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return "ios"
  if (/android|windows|macintosh|linux/i.test(ua)) return "chrome"
  return "other"
}

export function InstallButton() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [platform, setPlatform] = useState<Platform>("other")
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }
    setPlatform(detectPlatform())
    setIsReady(true)

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  // Close modal on outside click
  useEffect(() => {
    if (!showModal) return
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowModal(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showModal])

  if (isInstalled || !isReady) return null

  async function handleInstall() {
    if (deferredPrompt) {
      // Chrome / Android / Desktop — native one-tap install
      setInstalling(true)
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") setIsInstalled(true)
      setDeferredPrompt(null)
      setInstalling(false)
    } else {
      // iOS / Firefox / other — show inline instructions popup
      setShowModal(true)
    }
  }

  const iosSteps = [
    { icon: "ios_share", text: 'Tap the Share button at the bottom of Safari' },
    { icon: "add_box", text: 'Scroll down and tap "Add to Home Screen"' },
    { icon: "check_circle", text: 'Tap "Add" to confirm' },
  ]

  const desktopSteps = [
    { icon: "language", text: "Open this page in Chrome or Edge" },
    { icon: "install_desktop", text: "Click the install icon (⊕) in the address bar" },
    { icon: "check_circle", text: 'Click "Install" to confirm' },
  ]

  const steps = platform === "ios" ? iosSteps : desktopSteps
  const platformLabel = platform === "ios" ? "iPhone / iPad" : "Windows / Mac / Linux"

  return (
    <div className="relative">
      <button
        onClick={handleInstall}
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

      {/* Inline install instructions popup */}
      {showModal && (
        <div
          ref={modalRef}
          className="absolute right-0 top-10 z-50 w-72 rounded-2xl border border-[#a3a6ff]/20 bg-[#141414] shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#a3a6ff] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {platform === "ios" ? "phone_iphone" : "desktop_windows"}
              </span>
              <div>
                <p className="text-white text-sm font-bold leading-tight">Install App</p>
                <p className="text-[#adaaaa] text-[10px]">{platformLabel}</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="text-[#adaaaa] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-[#adaaaa] text-xs leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>

          {platform === "ios" && (
            <p className="text-[#494847] text-[10px] mt-4 leading-relaxed">
              ⚠️ Must be opened in Safari for install to work.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
