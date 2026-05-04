"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/actions/auth"

const navItems = [
  { label: "Overview", href: "/admin", icon: "dashboard" },
  { label: "Deliveries", href: "/admin/orders", icon: "local_shipping" },
  { label: "Drivers", href: "/admin/drivers", icon: "badge" },
  { label: "Customers", href: "/admin/customers", icon: "group" },
  { label: "Payments", href: "/admin/payments", icon: "payments" },
  { label: "Disputes", href: "/admin/disputes", icon: "gavel" },
  { label: "Reports", href: "/admin/reports", icon: "analytics" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
]

interface AdminSidebarProps {
  onClose?: () => void
  user?: { full_name?: string; email?: string }
}

export function AdminSidebar({ onClose, user }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col bg-[#0e0e0e] shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
      <div className="px-6 py-6 mb-4">
        <h1 className="text-xl font-bold text-white tracking-widest uppercase font-headline">Kinetic Void</h1>
        <p className="text-[10px] text-[#adaaaa] tracking-[0.2em] uppercase mt-1 font-headline">Command Center</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-0">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href))
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
