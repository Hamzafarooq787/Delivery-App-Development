"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Briefcase,
  DollarSign,
  CreditCard,
  User,
  Settings,
  HeadphonesIcon,
  ShieldCheck,
  X,
  Package,
  LogOut,
} from "lucide-react"
import { signOut } from "@/app/actions/auth"

const navItems = [
  { label: "Dashboard", href: "/driver", icon: LayoutDashboard },
  { label: "Available Jobs", href: "/driver/jobs/available", icon: Briefcase },
  { label: "Active Jobs", href: "/driver/jobs/active", icon: Package },
  { label: "Completed Jobs", href: "/driver/jobs/completed", icon: ShieldCheck },
  { label: "Earnings", href: "/driver/earnings", icon: DollarSign },
  { label: "Payouts", href: "/driver/payouts", icon: CreditCard },
  { label: "Verification", href: "/driver/verification", icon: ShieldCheck },
  { label: "Profile", href: "/driver/profile", icon: User },
  { label: "Settings", href: "/driver/settings", icon: Settings },
  { label: "Support", href: "/driver/support", icon: HeadphonesIcon },
]

interface DriverSidebarProps {
  onClose?: () => void
  user?: { full_name?: string; email?: string }
}

export function DriverSidebar({ onClose, user }: DriverSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Package className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-sidebar-primary">SwiftDeliver</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Driver
        </p>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/driver" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="border-t border-sidebar-border px-4 py-4 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-primary truncate">{user?.full_name ?? "Driver Account"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email ?? ""}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
