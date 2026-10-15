'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  Plus,
  Settings,
  Truck,
  UserRound,
  Wallet,
  CircleHelp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BrandLogo } from '@/components/shared/brand-logo'
import { ProfileDropdown } from '@/components/shared/profile-dropdown'
import { RealtimeNotifications } from '@/components/shared/realtime-notifications'
import { useVisibleViewport } from '@/hooks/use-visible-viewport'
import s from './CustomerPages.module.css'

const nav = [
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
export function openNewCustomerOrder() {
  document.dispatchEvent(new CustomEvent('open-new-delivery'))
}

export function CustomerPage({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  const ref = useVisibleViewport()
  const path = usePathname()
  const client = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState({ id: '', name: '', email: '' })
  useEffect(() => {
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
        setProfile({
          id: user.id,
          name: data?.full_name ?? '',
          email: user.email ?? '',
        })
    }
    void load().catch(() => {})
    return () => {
      alive = false
    }
  }, [client])
  function active(href: string) {
    if (href.endsWith('active-deliveries'))
      return path.includes('active-deliveries') || path.includes('/history')
    return path === href
  }
  const accountActive = ['/settings', '/addresses', '/support'].some((x) =>
    path.endsWith(x),
  )
  return (
    <div ref={ref} className={s.screen}>
      <header className={s.header}>
        <Link href="/dashboard/customer" aria-label="GoDrop customer home">
          <BrandLogo />
        </Link>
        <nav className={s.desktopNav} aria-label="Customer navigation">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={s.profile}>
          {profile.id ? (
            <RealtimeNotifications
              role="customer"
              userId={profile.id}
              icon={<Bell size={21} aria-hidden />}
            />
          ) : (
            <button disabled aria-label="Notifications">
              <Bell size={21} aria-hidden />
            </button>
          )}
          <ProfileDropdown
            name={profile.name}
            email={profile.email}
            activeRole="customer"
            userId={profile.id}
            profileHref="/dashboard/customer/settings"
            supportHref="/dashboard/customer/support"
          />
        </div>
      </header>
      <main className={s.main}>
        <div className={s.pageHeading}>
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action && <div className={s.headingAction}>{action}</div>}
        </div>
        {children}
      </main>
      <nav className={s.bottomNav} aria-label="Customer mobile navigation">
        {nav.slice(0, 2).map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? 'page' : undefined}
          >
            <Icon size={22} aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
        <button
          onClick={openNewCustomerOrder}
          className={s.newOrder}
          aria-label="New delivery"
        >
          <span>
            <Plus size={26} aria-hidden />
          </span>
          <small>New</small>
        </button>
        <Link
          href="/dashboard/customer/payments"
          aria-current={
            active('/dashboard/customer/payments') ? 'page' : undefined
          }
        >
          <Wallet size={22} aria-hidden />
          <span>Payments</span>
        </Link>
        <Link
          href="/dashboard/customer/settings"
          aria-current={accountActive ? 'page' : undefined}
        >
          <UserRound size={22} aria-hidden />
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  )
}

/** Keep lists within the visible page, including short phones and landscape. */
export function useCustomerPageSize(desktop = 5, mobile = 2) {
  const [size, setSize] = useState(mobile)
  useEffect(() => {
    const measure = () => {
      const height = Math.min(
        window.innerHeight,
        window.visualViewport?.height ?? window.innerHeight,
      )
      setSize(
        window.innerWidth >= 900
          ? height < 650
            ? Math.min(desktop, 3)
            : height < 800
              ? Math.min(desktop, 4)
              : desktop
          : height < 680
            ? 1
            : mobile,
      )
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [desktop, mobile])
  return size
}

export function CustomerPagination({
  page,
  count,
  size,
  onChange,
}: {
  page: number
  count: number
  size: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / size))
  const current = Math.min(page, pages)
  return (
    <div className={s.pagination} aria-label="Pagination">
      <span>
        {count
          ? `${(current - 1) * size + 1}–${Math.min(current * size, count)} of ${count}`
          : '0 results'}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          <ChevronLeft size={16} aria-hidden />
          <span>Previous</span>
        </button>
        <span className={s.pageNumber}>
          {current} / {pages}
        </span>
        <button
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          <span>Next</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function CustomerDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    return () => node?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="customer-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose()
        }
      }}
    >
      <div className={s.dialogHeading}>
        <h2 id="customer-dialog-title">{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function CustomerEmpty({
  children,
  loading = false,
}: {
  children: ReactNode
  loading?: boolean
}) {
  return (
    <div className={s.empty} role="status">
      <Truck size={32} aria-hidden />
      <p>{loading ? 'Loading…' : children}</p>
    </div>
  )
}
export const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(value)
export const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'
