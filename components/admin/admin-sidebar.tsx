"use client"

import { BrandLogo } from '@/components/shared/brand-logo'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"

const navItems = [
  { label: "Overview", href: "/dashboard/admin", icon: "dashboard" },
  { label: "Orders", href: "/dashboard/admin/orders", icon: "local_shipping" },
  { label: "Live Tracking", href: "/dashboard/admin/tracking", icon: "my_location" },
  { label: "Drivers", href: "/dashboard/admin/drivers", icon: "badge" },
  { label: "Customers", href: "/dashboard/admin/customers", icon: "group" },
  { label: "Verification Requests", href: "/dashboard/admin/verification", icon: "verified_user", badgeKey: "pendingVerifications" },
  { label: "Payments", href: "/dashboard/admin/payments", icon: "payments" },
  { label: "Payouts",  href: "/dashboard/admin/payouts",  icon: "account_balance_wallet" },
  { label: "Promotions & Pricing", href: "/dashboard/admin/promotions", icon: "sell" },
  { label: "Marketing", href: "/dashboard/admin/marketing", icon: "campaign" },
  { label: "Reviews", href: "/dashboard/admin/reviews", icon: "rate_review", badgeKey: "pendingReviews" },
  { label: "Disputes", href: "/dashboard/admin/disputes", icon: "gavel" },
  { label: "Support Tickets", href: "/dashboard/admin/support", icon: "support_agent" },
  { label: "Reports", href: "/dashboard/admin/reports", icon: "analytics" },
  { label: "Theme", href: "/dashboard/admin/theme", icon: "palette" },
  { label: "Settings", href: "/dashboard/admin/settings", icon: "settings" },
]

interface AdminSidebarProps {
  onClose?: () => void
  user?: { full_name?: string; email?: string }
  pendingVerifications?: number
  pendingReviews?: number
}

export function AdminSidebar({ onClose, user, pendingVerifications = 0, pendingReviews = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  const badges: Record<string, number> = {
    pendingVerifications,
    pendingReviews,
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-[#0e0e0e] shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
      <div className="px-6 py-6 mb-4 flex items-start justify-between">
        <div>
          <BrandLogo />
          <p className="text-[10px] text-[#adaaaa] tracking-[0.2em] uppercase mt-1 font-headline">Command Center</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[#adaaaa] hover:text-white mt-1" aria-label="Close menu">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-0 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard/admin" && pathname.startsWith(item.href))
          const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0

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
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[10px] font-black">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 pt-6 pb-6 mt-auto">
        <button className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-fixed-dim)] text-[var(--color-on-primary)] font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0px_0px_15px_rgba(var(--brand-rgb),0.2)]">
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span className="text-xs uppercase tracking-widest">New Shipment</span>
        </button>
        <LogoutButton className="mt-4 w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#adaaaa] hover:text-white hover:bg-[#201f1f] rounded-lg transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-base">logout</span>
          <span className="font-headline tracking-tight">Sign Out</span>
        </LogoutButton>
      </div>
    </aside>
  )
}

