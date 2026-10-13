"use client"

import { BrandLogo } from '@/components/shared/brand-logo'
import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"
import { toggleDriverOnline } from "@/app/actions/driver"
import { toast } from "sonner"

// Earnings covers earnings + payouts (sub-tabs on the page)
const navItems = [
  { label: "Dashboard", href: "/dashboard/driver", icon: "dashboard" },
  { label: "Available Jobs", href: "/dashboard/driver/jobs/available", icon: "work" },
  { label: "Active Jobs", href: "/dashboard/driver/active-jobs", icon: "local_shipping" },
  { label: "Completed Jobs", href: "/dashboard/driver/jobs/completed", icon: "task_alt" },
  { label: "Earnings", href: "/dashboard/driver/earnings", icon: "payments", activePrefixes: ["/dashboard/driver/payouts"] },
  { label: "Verification", href: "/dashboard/driver/verification", icon: "verified_user" },
  { label: "Profile", href: "/dashboard/driver/profile", icon: "person" },
  { label: "Settings", href: "/dashboard/driver/settings", icon: "settings" },
  { label: "Support", href: "/dashboard/driver/support", icon: "headset_mic" },
]

const UNLOCKED_ROUTES = ["/dashboard/driver/verification", "/dashboard/driver/support"]

interface DriverSidebarProps {
  onClose?: () => void
  user?: { full_name?: string; email?: string }
  isOnline?: boolean
  isLocked?: boolean
}

export function DriverSidebar({ onClose, user, isOnline = false, isLocked = false }: DriverSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [online, setOnline] = useState(isOnline)
  const [isPending, startTransition] = useTransition()

  // Keep in sync if the server-rendered value changes (e.g. toggled from Settings)
  useEffect(() => setOnline(isOnline), [isOnline])

  function handleToggle() {
    if (isPending) return
    const next = !online
    setOnline(next)
    startTransition(async () => {
      const result = await toggleDriverOnline(next)
      if (result.error) {
        setOnline(!next)
        toast.error(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-[#0e0e0e] shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
      <div className="px-6 py-6 mb-4">
        <BrandLogo />
        <p className="text-[10px] text-[#adaaaa] tracking-[0.2em] uppercase mt-1 font-headline">Driver Portal</p>
      </div>

      {isLocked && (
        <div className="mx-4 mb-3 px-3 py-2.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">lock</span>
            <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">Account Pending</p>
          </div>
          <p className="text-[10px] text-[#adaaaa] mt-0.5 leading-relaxed">Complete verification to unlock all features</p>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-0 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard/driver" && pathname.startsWith(item.href)) ||
            (item.activePrefixes?.some((p) => pathname.startsWith(p)) ?? false)
          const itemLocked = isLocked && !UNLOCKED_ROUTES.some((r) => item.href.startsWith(r))

          if (itemLocked) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-6 py-3 text-sm font-headline tracking-tight opacity-30 cursor-not-allowed select-none border-l-4 border-transparent"
              >
                <span className="material-symbols-outlined text-lg text-[#adaaaa]">{item.icon}</span>
                <span className="text-[#adaaaa]">{item.label}</span>
                <span className="material-symbols-outlined text-xs text-[#494847] ml-auto">lock</span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm font-headline tracking-tight transition-all duration-200",
                isActive
                  ? "text-[var(--color-primary)] bg-[#131313] border-l-4 border-[var(--color-primary)]"
                  : "text-[#adaaaa] hover:text-white hover:bg-[#201f1f] border-l-4 border-transparent"
              )}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-6 pt-6 pb-6 mt-auto">
        {!isLocked && (
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={cn(
              "w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-60",
              online
                ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                : "bg-[#262626] border-[#494847]/20 text-[#adaaaa] hover:bg-[#2e2e2e]"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", online ? "bg-green-400 animate-pulse" : "bg-[#494847]")} />
            {isPending ? "Updating…" : online ? "On Duty" : "Off Duty"}
          </button>
        )}

        <LogoutButton className="mt-4 w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#adaaaa] hover:text-white hover:bg-[#201f1f] rounded-lg transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-base">logout</span>
          <span className="font-headline tracking-tight">Sign Out</span>
        </LogoutButton>
      </div>
    </aside>
  )
}

