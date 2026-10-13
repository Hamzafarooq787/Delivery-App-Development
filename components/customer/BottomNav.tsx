'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Left and right of FAB
const LEFT_ITEMS = [
  { href: '/dashboard/customer',                   icon: 'home',      label: 'Home'     },
  { href: '/dashboard/customer/active-deliveries', icon: 'package_2', label: 'Shipments'},
]
const RIGHT_ITEMS = [
  { href: '/dashboard/customer/payments', icon: 'payments', label: 'Payments' },
  { href: '/dashboard/customer/settings', icon: 'person',   label: 'Profile'},
]

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 flex-1 pt-2 pb-1 relative group">
      {/* Active top-bar indicator */}
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary"
          style={{ boxShadow: '0 0 8px rgba(var(--brand-rgb),0.7)' }}
        />
      )}
      {/* Icon pill */}
      <div className={`w-11 h-7 rounded-2xl flex items-center justify-center transition-all duration-200 ${
        active ? 'bg-primary/15' : 'group-active:bg-surface-container-highest'
      }`}>
        <span
          className={`material-symbols-outlined text-xl transition-all duration-200 ${
            active ? 'text-primary' : 'text-on-surface-variant'
          }`}
          style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {icon}
        </span>
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${
        active ? 'text-primary' : 'text-on-surface-variant'
      }`}>
        {label}
      </span>
    </Link>
  )
}

export default function BottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard/customer') return pathname === href
    // Wallet is a sub-tab of the merged Payments tab
    if (href === '/dashboard/customer/payments') {
      return pathname.startsWith(href) || pathname.startsWith('/dashboard/customer/wallet')
    }
    return pathname.startsWith(href)
  }

  function handleNewDelivery() {
    document.dispatchEvent(new CustomEvent('open-new-delivery'))
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50">
      <div className="bg-[#0a0a0a]/97 backdrop-blur-2xl border-t border-outline-variant/20 shadow-[0_-12px_40px_rgba(0,0,0,0.7)]">
        <div className="flex items-end justify-around h-16 px-1">

          {/* Left items */}
          {LEFT_ITEMS.map(item => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

          {/* Centre FAB — New Delivery */}
          <div className="flex flex-col items-center flex-1 -mt-4">
            <button
              onClick={handleNewDelivery}
              aria-label="New Delivery"
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform duration-150"
              style={{ boxShadow: '0 0 24px rgba(var(--brand-rgb),0.5), 0 4px 16px rgba(0,0,0,0.4)' }}
            >
              <span className="material-symbols-outlined text-on-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                add
              </span>
            </button>
            <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant mt-1 mb-1">
              New
            </span>
          </div>

          {/* Right items */}
          {RIGHT_ITEMS.map(item => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

        </div>

        {/* iOS safe-area spacer */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </nav>
  )
}

