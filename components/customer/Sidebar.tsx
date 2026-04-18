'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard/customer', icon: 'dashboard', label: 'Command Center' },
  { href: '/dashboard/customer/active-deliveries', icon: 'local_shipping', label: 'Shipments' },
  { href: '/dashboard/customer/tracking', icon: 'map', label: 'Live Tracking' },
  { href: '/dashboard/customer/history', icon: 'history', label: 'History' },
  { href: '/dashboard/customer/payments', icon: 'payments', label: 'Payments' },
  { href: '/dashboard/customer/addresses', icon: 'location_on', label: 'Addresses' },
  { href: '/dashboard/customer/settings', icon: 'settings', label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-[#0e0e0e] flex flex-col py-6 hidden md:flex z-50">
      <div className="px-6 mb-10">
        <h1 className="text-xl font-black text-white tracking-tighter font-headline">Kinetic Void</h1>
        <p className="text-xs text-on-surface-variant font-label uppercase tracking-[0.2em] mt-1">Logistics HQ</p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center px-6 py-3 transition-colors duration-200 ${
                isActive
                  ? 'border-l-4 border-primary bg-surface-container-low text-white'
                  : 'text-on-surface-variant hover:text-white hover:bg-surface-container'
              }`}
            >
              <span
                className="material-symbols-outlined mr-4"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-headline text-sm font-medium tracking-wide">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-6 mt-auto">
        <div className="flex items-center p-3 rounded-xl bg-surface-container">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary font-bold font-headline">
            AV
          </div>
          <div className="ml-3">
            <p className="text-sm font-bold text-on-surface">Alex Void</p>
            <p className="text-[10px] text-on-surface-variant font-label">ADMIN PANEL</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
