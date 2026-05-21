"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { LogoutButton } from "@/components/auth/logout-button"
import { useTheme, type Theme } from "@/components/shared/theme-provider"

const THEMES: { value: Theme; icon: string; label: string }[] = [
  { value: "dark",  icon: "dark_mode",  label: "Dark"  },
  { value: "mix",   icon: "auto_awesome", label: "Mix"   },
  { value: "light", icon: "light_mode", label: "Light" },
]

interface ProfileDropdownProps {
  name: string
  email: string
  role?: string
  profileHref: string
  supportHref?: string
}

function initials(name: string, email: string) {
  const src = name?.trim() || email?.split("@")[0] || "U"
  const parts = src.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean)
  if (parts.length === 0) return src.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ProfileDropdown({ name, email, role, profileHref, supportHref }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const abbr = initials(name, email)
  const displayName = name || email?.split("@")[0] || "Account"

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-expanded={open}
        className={`h-8 w-8 rounded-full flex items-center justify-center border text-xs font-bold font-headline transition-all select-none ${
          open
            ? "bg-[#a3a6ff]/20 border-[#a3a6ff]/60 text-[#a3a6ff]"
            : "bg-[#262626] border-[#494847]/30 text-white hover:border-[#a3a6ff]/40 hover:bg-[#a3a6ff]/10 hover:text-[#a3a6ff]"
        }`}
      >
        {abbr}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#1a1919] border border-[#494847]/20 shadow-[0_8px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-4 border-b border-[#494847]/15 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-[#a3a6ff]/15 flex items-center justify-center text-[#a3a6ff] font-bold font-headline text-sm shrink-0 border border-[#a3a6ff]/20">
              {abbr}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-[#adaaaa] truncate">{email}</p>
              {role && (
                <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full bg-[#a3a6ff]/10 text-[#a3a6ff]">
                  {role}
                </span>
              )}
            </div>
          </div>

          {/* Menu links */}
          <div className="py-1.5">
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors group"
            >
              <span className="material-symbols-outlined text-[18px] text-[#a3a6ff] group-hover:text-[#a3a6ff]">manage_accounts</span>
              <span className="font-medium">Profile &amp; Settings</span>
            </Link>

            {supportHref && (
              <Link
                href={supportHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors group"
              >
                <span className="material-symbols-outlined text-[18px] text-[#a3a6ff]">help_outline</span>
                <span className="font-medium">Help &amp; Support</span>
              </Link>
            )}
          </div>

          {/* Theme switcher */}
          <div className="border-t border-[#494847]/15 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#adaaaa] mb-2">Appearance</p>
            <div className="flex gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                    theme === t.value
                      ? "bg-[#a3a6ff]/15 text-[#a3a6ff] border border-[#a3a6ff]/30"
                      : "bg-[#262626]/60 text-[#adaaaa] border border-transparent hover:text-white hover:bg-[#262626]"
                  }`}
                >
                  <span className="material-symbols-outlined text-base"
                    style={theme === t.value ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logout */}
          <div className="border-t border-[#494847]/15 py-1.5">
            <LogoutButton className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ff6e84] hover:bg-[#ff6e84]/10 transition-colors disabled:opacity-50">
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span className="font-medium">Sign Out</span>
            </LogoutButton>
          </div>
        </div>
      )}
    </div>
  )
}
