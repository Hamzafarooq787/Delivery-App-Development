"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LEFT_ITEMS = [
  { href: "/dashboard/admin", icon: "dashboard", label: "Overview" },
  { href: "/dashboard/admin/orders", icon: "local_shipping", label: "Orders" },
]

const RIGHT_ITEMS = [
  { href: "/dashboard/admin/drivers", icon: "badge", label: "Drivers" },
  { href: "/dashboard/admin/disputes", icon: "gavel", label: "Disputes" },
]

const FAB_HREF = "/dashboard/admin/verification"

interface NavItemProps {
  href: string
  icon: string
  label: string
  active: boolean
}

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 flex-1 pt-2 pb-1 relative group">
      {/* Active indicator bar */}
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#a3a6ff]"
          style={{ boxShadow: "0 0 8px rgba(163,166,255,0.7)" }}
        />
      )}
      {/* Icon pill */}
      <div className={`w-11 h-7 rounded-2xl flex items-center justify-center transition-all duration-200 ${
        active ? "bg-[#a3a6ff]/15" : "group-active:bg-[#262626]"
      }`}>
        <span
          className={`material-symbols-outlined text-xl transition-all duration-200 ${
            active ? "text-[#a3a6ff]" : "text-[#adaaaa]"
          }`}
          style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {icon}
        </span>
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${
        active ? "text-[#a3a6ff]" : "text-[#adaaaa]"
      }`}>
        {label}
      </span>
    </Link>
  )
}

interface AdminBottomNavProps {
  pendingVerifications?: number
}

export function AdminBottomNav({ pendingVerifications = 0 }: AdminBottomNavProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard/admin") return pathname === href
    return pathname.startsWith(href)
  }

  const fabActive = isActive(FAB_HREF)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50">
      <div className="bg-[#0a0a0a]/97 backdrop-blur-2xl border-t border-[#494847]/20 shadow-[0_-12px_40px_rgba(0,0,0,0.7)]">
        <div className="flex items-end justify-around h-16 px-1">

          {/* Left items */}
          {LEFT_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

          {/* Centre FAB — Verification */}
          <div className="flex flex-col items-center flex-1 -mt-4">
            <Link
              href={FAB_HREF}
              aria-label="Verification Requests"
              className={`relative w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-150 ${
                fabActive ? "bg-[#c180ff]" : "bg-[#a3a6ff]"
              }`}
              style={{ boxShadow: "0 0 24px rgba(163,166,255,0.5), 0 4px 16px rgba(0,0,0,0.4)" }}
            >
              <span
                className="material-symbols-outlined text-[#0f00a4] text-2xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}
              >
                verified_user
              </span>
              {/* Pending badge */}
              {pendingVerifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff6e84] text-white text-[9px] font-black flex items-center justify-center shadow-lg">
                  {pendingVerifications > 99 ? "99+" : pendingVerifications}
                </span>
              )}
            </Link>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#adaaaa] mt-1 mb-1">
              Verify
            </span>
          </div>

          {/* Right items */}
          {RIGHT_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

        </div>

        {/* iOS safe-area spacer */}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </nav>
  )
}
