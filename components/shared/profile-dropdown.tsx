"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { LogoutButton } from "@/components/auth/logout-button"
import { useTheme, type Theme } from "@/components/shared/theme-provider"
import { createClient } from "@/lib/supabase/client"
import { switchActiveRole, addSecondaryRole } from "@/app/actions/auth"

const THEMES: { value: Theme; icon: string; label: string }[] = [
  { value: "dark",  icon: "dark_mode",  label: "Dark"  },
  { value: "mix",   icon: "auto_awesome", label: "Mix"   },
  { value: "light", icon: "light_mode", label: "Light" },
]

interface ProfileDropdownProps {
  name: string
  email: string
  role?: string
  activeRole?: "customer" | "driver" | "admin"
  userId?: string
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

type RoleState = { hasDriver: boolean; hasCustomer: boolean; loaded: boolean }

export function ProfileDropdown({
  name, email, role, activeRole, userId, profileHref, supportHref,
}: ProfileDropdownProps) {
  const [open, setOpen] = useState(false)
  const [roleState, setRoleState] = useState<RoleState>({ hasDriver: false, hasCustomer: false, loaded: false })
  const [roleMsg, setRoleMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const abbr = initials(name, email)
  const displayName = name || email?.split("@")[0] || "Account"

  // Lazy-load role profiles when dropdown opens
  useEffect(() => {
    if (!open || !userId || roleState.loaded || activeRole === "admin") return
    async function loadRoles() {
      const supabase = createClient()
      const [{ data: driverRow }, { data: customerRow }] = await Promise.all([
        supabase.from("driver_profiles").select("id").eq("id", userId!).maybeSingle(),
        supabase.from("customer_profiles").select("id").eq("id", userId!).maybeSingle(),
      ])
      setRoleState({ hasDriver: !!driverRow, hasCustomer: !!customerRow, loaded: true })
    }
    loadRoles()
  }, [open, userId, roleState.loaded, activeRole])

  // Clear message when dropdown closes
  useEffect(() => {
    if (!open) setRoleMsg(null)
  }, [open])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  function handleSwitch(newRole: "customer" | "driver") {
    startTransition(async () => {
      setRoleMsg(null)
      const result = await switchActiveRole(newRole)
      if (result?.error) setRoleMsg(result.error)
    })
  }

  function handleAddRole(newRole: "customer" | "driver") {
    startTransition(async () => {
      const result = await addSecondaryRole(newRole)
      if (result?.error) {
        setRoleMsg(`Error: ${result.error}`)
      } else {
        setRoleState((prev) => ({
          ...prev,
          hasDriver: newRole === "driver" ? true : prev.hasDriver,
          hasCustomer: newRole === "customer" ? true : prev.hasCustomer,
        }))
        setRoleMsg(
          newRole === "driver"
            ? "Driver access added! You can now switch to Driver mode."
            : "Customer access added! You can now switch to Customer mode."
        )
      }
    })
  }

  const showRoleSection = activeRole && activeRole !== "admin" && userId
  const otherRole = activeRole === "customer" ? "driver" : "customer"
  const hasOtherRole = otherRole === "driver" ? roleState.hasDriver : roleState.hasCustomer
  const otherRoleLabel = otherRole === "driver" ? "Driver" : "Customer"
  const otherRoleIcon = otherRole === "driver" ? "local_shipping" : "person"

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-expanded={open}
        className={`h-8 w-8 rounded-full flex items-center justify-center border text-xs font-bold font-headline transition-all select-none ${
          open
            ? "bg-[var(--color-primary)]/20 border-[var(--color-primary)]/60 text-[var(--color-primary)]"
            : "bg-[#262626] border-[#494847]/30 text-white hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
        }`}
      >
        {abbr}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#1a1919] border border-[#494847]/20 shadow-[0_8px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-4 border-b border-[#494847]/15 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-[var(--color-primary)] font-bold font-headline text-sm shrink-0 border border-[var(--color-primary)]/20">
              {abbr}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-[#adaaaa] truncate">{email}</p>
              {role && (
                <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
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
              <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)] group-hover:text-[var(--color-primary)]">manage_accounts</span>
              <span className="font-medium">Profile &amp; Settings</span>
            </Link>

            {activeRole === 'customer' && <Link href="/dashboard/customer/addresses" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-lg">location_on</span>Saved addresses
            </Link>}
            {supportHref && (
              <Link
                href={supportHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors group"
              >
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">help_outline</span>
                <span className="font-medium">Help &amp; Support</span>
              </Link>
            )}
          </div>

          {/* ── Role Switcher ─────────────────────────────────────────── */}
          {showRoleSection && (
            <div className="border-t border-[#494847]/15 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#adaaaa] mb-2.5">Account Mode</p>

              {roleMsg && (
                <div className={`text-[11px] rounded-lg px-3 py-2 mb-2.5 leading-relaxed ${
                  roleMsg.startsWith("Error")
                    ? "bg-[#ff6e84]/10 text-[#ff6e84] border border-[#ff6e84]/20"
                    : "bg-[#6ee7b7]/10 text-[#6ee7b7] border border-[#6ee7b7]/20"
                }`}>
                  {roleMsg}
                </div>
              )}

              {!roleState.loaded && !roleMsg ? (
                <div className="flex items-center gap-2 text-[11px] text-[#494847]">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading…
                </div>
              ) : hasOtherRole ? (
                <button
                  onClick={() => handleSwitch(otherRole as "customer" | "driver")}
                  disabled={isPending}
                  className="w-full flex items-center gap-2.5 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 rounded-xl px-3 py-2.5 text-sm text-[var(--color-primary)] font-semibold transition-all disabled:opacity-50"
                >
                  {isPending ? (
                    <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <span className="material-symbols-outlined text-[18px] shrink-0">swap_horiz</span>
                  )}
                  <span>Switch to {otherRoleLabel}</span>
                  <span className="material-symbols-outlined text-[14px] shrink-0 ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {otherRoleIcon}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => handleAddRole(otherRole as "customer" | "driver")}
                  disabled={isPending}
                  className="w-full flex items-center gap-2.5 bg-[#262626] hover:bg-[#2e2e2e] border border-[#494847]/20 rounded-xl px-3 py-2.5 text-sm text-[#adaaaa] hover:text-white font-semibold transition-all disabled:opacity-50"
                >
                  {isPending ? (
                    <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <span className="material-symbols-outlined text-[18px] shrink-0">add_circle</span>
                  )}
                  <span>Add {otherRoleLabel} Access</span>
                  <span className="material-symbols-outlined text-[14px] shrink-0 ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {otherRoleIcon}
                  </span>
                </button>
              )}

              <p className="text-[9px] text-[#494847] mt-2 leading-relaxed">
                Your {activeRole} data stays safe when switching.
              </p>
            </div>
          )}

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
                      ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
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

