'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import { CustomerHeader, CustomerBottomNavigation } from './CustomerNavigation'
import navStyles from './CustomerNavigation.module.css'
import { useVisibleViewport } from '@/hooks/use-visible-viewport'
import s from './CustomerPages.module.css'
export { openNewCustomerOrder } from './CustomerNavigation'

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
  return (
    <div ref={ref} className={`${s.screen} ${navStyles.scope}`}>
      <CustomerHeader />
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
      <CustomerBottomNavigation />
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
