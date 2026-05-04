"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/actions/auth"

const navItems = [
  { label: "Overview", href: "/dashboard/admin", icon: "dashboard" },
  { label: "Deliveries", href: "/dashboard/admin/orders", icon: "local_shipping" },
  { label: "Drivers", href: "/dashboard/admin/drivers", icon: "badge" },
  { label: "Customers", href: "/dashboard/admin/customers", icon: "group" },
  { label: "Payments", href: "/dashboard/admin/payments", icon: "payments" },
  { label: "Disputes", href: "/dashboard/admin/disputes", icon: "gavel" },
  { label: "Reports", href: "/dashboard/admin/reports", icon: "analytics" },
  { label: "Settings", href: "/dashboard/admin/settings", icon: "settings" },
]

interface AdminSidebarProps {
  onClose?: () => void
  user?: { full_name?: string; email?: string }
}

export function AdminSidebar({ onClose, user }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col bg-[#0e0e0e] shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
      <div className="px-6 py-6 mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase font-headline">Kinetic Void</h1>
          <p className="text-[10px] text-[#adaaaa] tracking-[0.2em] uppercase mt-1 font-headline">Command Center</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[#adaaaa] hover:text-white mt-1" aria-label="Close menu">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-0">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard/admin" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm font-headline tracking-tight transition-all duration-200",
                isActive
                  ? "text-[#a3a6ff] bg-[#131313] border-l-4 border-[#a3a6ff]"
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
        <button className="w-full bg-[#a3a6ff] hover:bg-[#8387ff] text-[#0f00a4] font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0px_0px_15px_rgba(163,166,255,0.2)]">
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span className="text-xs uppercase tracking-widest">New Shipment</span>
        </button>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#adaaaa] hover:text-white hover:bg-[#201f1f] rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span className="font-headline tracking-tight">Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
