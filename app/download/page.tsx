"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Platform = "android" | "ios" | "desktop" | "other" | "installed" | "loading"

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "loading"
  if (window.matchMedia("(display-mode: standalone)").matches) return "installed"
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return "android"
  if (/iphone|ipad|ipod/i.test(ua)) return "ios"
  if (/windows|macintosh|linux/i.test(ua)) return "desktop"
  return "other"
}

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>("loading")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") setInstalled(true)
    setDeferredPrompt(null)
    setInstalling(false)
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex flex-col items-center justify-start px-4 py-12">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#a3a6ff]/5 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#6ee7b7]/4 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-[#adaaaa] hover:text-white text-sm mb-10 transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </Link>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-2xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-[#a3a6ff] text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Get Go Drop
          </h1>
          <p className="text-[#adaaaa] text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Install the app on any device — no App Store required.
            Works on Android, iPhone, iPad, and desktop.
          </p>
        </div>

        {/* Already installed */}
        {(installed || platform === "installed") && (
          <div className="glass-card rounded-2xl border border-[#6ee7b7]/20 bg-[#6ee7b7]/5 p-8 text-center mb-8">
            <span className="material-symbols-outlined text-[#6ee7b7] text-5xl mb-4 block" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <h2 className="text-white font-bold text-xl mb-2">Already Installed!</h2>
            <p className="text-[#adaaaa] text-sm mb-6">Go Drop is running as an app on your device.</p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 milled-gradient text-white font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-all glow-primary">
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              Open Dashboard
            </Link>
          </div>
        )}

        {/* Platform cards */}
        {platform !== "installed" && !installed && (
          <div className="space-y-4 mb-10">

            {/* Android */}
            <div className={`glass-card rounded-2xl border p-6 transition-all ${platform === "android" ? "border-[#a3a6ff]/40 bg-[#a3a6ff]/5" : "border-[#262626]"}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>android</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-base">Android</h3>
                    {platform === "android" && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff]">Your device</span>
                    )}
                  </div>
                  <p className="text-[#adaaaa] text-xs leading-relaxed mb-4">Open in Chrome and tap the Install button below.</p>
                  <div className="space-y-2 text-xs text-[#adaaaa] mb-4">
                    {["Open this page in Chrome", "Tap the Install button", "Tap Install on the popup"].map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff] text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        {s}
                      </div>
                    ))}
                  </div>
                  {platform === "android" && deferredPrompt && (
                    <button
                      onClick={handleInstall}
                      disabled={installing}
                      className="flex items-center gap-2 milled-gradient text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 glow-primary"
                    >
                      {installing ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                      )}
                      {installing ? "Installing…" : "Install Now"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* iOS */}
            <div className={`glass-card rounded-2xl border p-6 transition-all ${platform === "ios" ? "border-[#a3a6ff]/40 bg-[#a3a6ff]/5" : "border-[#262626]"}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>phone_iphone</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-base">iPhone / iPad</h3>
                    {platform === "ios" && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff]">Your device</span>
                    )}
                  </div>
                  <p className="text-[#adaaaa] text-xs leading-relaxed mb-4">Open in Safari and follow these steps:</p>
                  <div className="space-y-2 text-xs text-[#adaaaa]">
                    {[
                      "Open this page in Safari",
                      'Tap the Share button (⎙) at the bottom',
                      'Scroll and tap "Add to Home Screen"',
                      'Tap "Add" to confirm',
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff] text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop */}
            <div className={`glass-card rounded-2xl border p-6 transition-all ${platform === "desktop" ? "border-[#a3a6ff]/40 bg-[#a3a6ff]/5" : "border-[#262626]"}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>desktop_windows</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-base">Windows / Mac / Linux</h3>
                    {platform === "desktop" && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff]">Your device</span>
                    )}
                  </div>
                  <p className="text-[#adaaaa] text-xs leading-relaxed mb-4">Open in Chrome or Edge for the best experience:</p>
                  <div className="space-y-2 text-xs text-[#adaaaa] mb-4">
                    {[
                      "Open this page in Chrome or Edge",
                      'Click the install icon (⊕) in the address bar',
                      'Or open menu (⋮) → "Install Go Drop"',
                      "Click Install to confirm",
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#a3a6ff]/15 text-[#a3a6ff] text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        {s}
                      </div>
                    ))}
                  </div>
                  {platform === "desktop" && deferredPrompt && (
                    <button
                      onClick={handleInstall}
                      disabled={installing}
                      className="flex items-center gap-2 milled-gradient text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 glow-primary"
                    >
                      {installing ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                      )}
                      {installing ? "Installing…" : "Install Now"}
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Shareable link */}
        <div className="glass-card rounded-2xl border border-[#262626] p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#adaaaa] uppercase tracking-widest mb-1">Share this link</p>
            <p className="text-white text-sm font-mono truncate">v0-supabase-integration-tau-one.vercel.app</p>
          </div>
          <CopyButton text="https://v0-supabase-integration-tau-one.vercel.app/download" />
        </div>

        <p className="text-center text-xs text-[#494847] mt-8">
          &copy; {new Date().getFullYear()} Go Drop. All rights reserved.
        </p>
      </div>
    </main>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 flex items-center gap-1.5 bg-[#a3a6ff]/10 hover:bg-[#a3a6ff]/20 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold px-3 py-2 rounded-lg transition-all"
    >
      <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}
