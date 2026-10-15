'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  CircleHelp,
  Home,
  MapPin,
  Plus,
  Settings,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BrandLogo } from '@/components/shared/brand-logo'
import { ProfileDropdown } from '@/components/shared/profile-dropdown'
import { RealtimeNotifications } from '@/components/shared/realtime-notifications'
import s from './CustomerNavigation.module.css'

export type CustomerNavigationProfile = {
  id: string
  name: string
  email: string
}
export const CUSTOMER_LINKS = [
  { href: '/dashboard/customer', label: 'Home', icon: Home },
  {
    href: '/dashboard/customer/active-deliveries',
    label: 'Shipments',
    icon: Truck,
  },
  { href: '/dashboard/customer/payments', label: 'Payments', icon: Wallet },
  { href: '/dashboard/customer/addresses', label: 'Addresses', icon: MapPin },
  { href: '/dashboard/customer/support', label: 'Support', icon: CircleHelp },
  { href: '/dashboard/customer/settings', label: 'Settings', icon: Settings },
]

export function isCustomerLinkActive(path: string, href: string) {
  if (href.endsWith('/active-deliveries'))
    return ['/active-deliveries', '/history', '/tracking'].some((part) =>
      path.startsWith('/dashboard/customer' + part),
    )
  if (href.endsWith('/payments'))
    return (
      path.startsWith(href) || path.startsWith('/dashboard/customer/wallet')
    )
  return path === href
}

export function openNewCustomerOrder() {
  document.dispatchEvent(new CustomEvent('open-new-delivery'))
}

/** One dashboard-style header for every customer route. */
export function CustomerHeader({
  profile,
  fixed = false,
  initialUserId,
}: {
  profile?: CustomerNavigationProfile
  fixed?: boolean
  initialUserId?: string
}) {
  const path = usePathname()
  const client = useMemo(() => createClient(), [])
  const [loaded, setLoaded] = useState<CustomerNavigationProfile>({
    id: initialUserId ?? '',
    name: '',
    email: '',
  })
  useEffect(() => {
    if (profile) return
    let alive = true
    async function load() {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) return
      const { data } = await client
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (alive)
        setLoaded({
          id: user.id,
          name: data?.full_name ?? '',
          email: user.email ?? '',
        })
    }
    void load().catch(() => {})
    return () => {
      alive = false
    }
  }, [client, profile])
  const person = profile ?? loaded
  return (
    <header className={`${s.header} ${fixed ? s.fixedHeader : ''}`}>
      <Link href="/dashboard/customer" aria-label="GoDrop customer home">
        <BrandLogo />
      </Link>
      <nav className={s.desktopNav} aria-label="Customer navigation">
        {CUSTOMER_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isCustomerLinkActive(path, href) ? 'page' : undefined}
          >
            <Icon size={18} aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className={s.profile}>
        {person.id ? (
          <RealtimeNotifications
            role="customer"
            userId={person.id}
            icon={<Bell size={22} aria-hidden />}
          />
        ) : (
          <button
            className={s.notificationPlaceholder}
            disabled
            aria-label="Notifications"
          >
            <Bell size={22} aria-hidden />
          </button>
        )}
        <ProfileDropdown
          name={person.name}
          email={person.email}
          activeRole="customer"
          userId={person.id}
          profileHref="/dashboard/customer/settings"
          supportHref="/dashboard/customer/support"
        />
      </div>
    </header>
  )
}

/** All customer pages share the same five mobile actions and safe-area spacing. */
export function CustomerBottomNavigation({
  fixed = false,
}: {
  fixed?: boolean
}) {
  const path = usePathname()
  const profileActive = ['/settings', '/addresses', '/support'].some((part) =>
    path.startsWith('/dashboard/customer' + part),
  )
  return (
    <nav
      className={`${s.bottomNav} ${fixed ? s.fixedBottom : ''}`}
      aria-label="Customer mobile navigation"
    >
      {CUSTOMER_LINKS.slice(0, 2).map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isCustomerLinkActive(path, href) ? 'page' : undefined}
        >
          <Icon size={22} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
      <button
        type="button"
        className={s.newOrder}
        aria-label="New delivery"
        onClick={openNewCustomerOrder}
      >
        <span>
          <Plus size={26} aria-hidden />
        </span>
        <small>New</small>
      </button>
      <Link
        href="/dashboard/customer/payments"
        aria-current={
          isCustomerLinkActive(path, '/dashboard/customer/payments')
            ? 'page'
            : undefined
        }
      >
        <Wallet size={22} aria-hidden />
        <span>Payments</span>
      </Link>
      <Link
        href="/dashboard/customer/settings"
        aria-current={profileActive ? 'page' : undefined}
      >
        <UserRound size={22} aria-hidden />
        <span>Profile</span>
      </Link>
    </nav>
  )
}
