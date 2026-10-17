'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BriefcaseBusiness, Truck, Wallet, Ellipsis } from 'lucide-react'
import styles from './MapFirstDashboard.module.css'

const tabs = [
  { href: '/dashboard/driver', label: 'Home', Icon: Home },
  {
    href: '/dashboard/driver/jobs/available',
    label: 'Jobs',
    Icon: BriefcaseBusiness,
  },
  { href: '/dashboard/driver/active-jobs', label: 'Active', Icon: Truck },
  { href: '/dashboard/driver/earnings', label: 'Earnings', Icon: Wallet },
]

export function DriverBottomNav({
  isLocked = false,
  onMore,
}: {
  isLocked?: boolean
  onMore?: () => void
}) {
  const pathname = usePathname()
  if (isLocked) return null
  return (
    <nav className={styles.bottomNav} aria-label="Driver navigation">
      {tabs.map(({ href, label, Icon }) => {
        const active =
          href === '/dashboard/driver'
            ? pathname === href
            : pathname.startsWith(href) ||
              (label === 'Earnings' &&
                pathname.startsWith('/dashboard/driver/payouts')) ||
              (label === 'Active' &&
                pathname.startsWith('/dashboard/driver/jobs/') &&
                !pathname.endsWith('/available') &&
                !pathname.endsWith('/completed'))
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={styles.bottomItem}
            data-active={active}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        className={styles.bottomItem}
        data-active={[
          '/profile',
          '/settings',
          '/support',
          '/verification',
          '/jobs/completed',
        ].some((s) => pathname.startsWith('/dashboard/driver' + s))}
        onClick={onMore}
        aria-label="More driver pages"
      >
        <Ellipsis aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  )
}
