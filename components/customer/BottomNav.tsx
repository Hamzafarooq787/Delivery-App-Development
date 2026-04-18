'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mobileNavItems = [
  { href: '/dashboard/customer', icon: 'grid_view', label: 'Home' },
  { href: '/dashboard/customer/active-deliveries', icon: 'package_2', label: 'Logistics' },
  { href: '/dashboard/customer/tracking', icon: 'explore', label: 'Map' },
  { href: '/dashboard/customer/settings', icon: 'person', label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 h-16 bg-[#0e0e0e]/95 backdrop-blur-md border-t border-outline-variant/20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex justify-around items-center px-4">
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center space-y-1 font-inter text-[10px] uppercase tracking-widest font-bold ${
              isActive
                ? 'text-primary drop-shadow-[0_0_8px_rgba(163,166,255,0.4)]'
                : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
