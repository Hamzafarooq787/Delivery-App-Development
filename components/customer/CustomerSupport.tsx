'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  CreditCard,
  MessageCircle,
  Truck,
  UserRound,
} from 'lucide-react'
import {
  createSupportTicket,
  getMyTickets,
  type SupportTicket,
} from '@/app/actions/driver'
import {
  CustomerDialog,
  CustomerEmpty,
  CustomerPage,
  CustomerPagination,
  shortDate,
  useCustomerPageSize,
} from './CustomerPage'
import s from './CustomerPages.module.css'
const topics = [
  {
    title: 'Track an order',
    detail: 'Get the latest updates',
    icon: Truck,
    href: '/dashboard/customer/active-deliveries',
  },
  {
    title: 'Payments & refunds',
    detail: 'Help with payments and charges',
    icon: CreditCard,
    href: '/dashboard/customer/payments',
  },
  {
    title: 'Account help',
    detail: 'Profile, settings and more',
    icon: UserRound,
    href: '/dashboard/customer/settings',
  },
]
export default function CustomerSupport({
  initialTickets,
  initialError,
}: {
  initialTickets: SupportTicket[]
  initialError?: string
}) {
  const [tickets, setTickets] = useState(initialTickets),
    [page, setPage] = useState(1),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<SupportTicket | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(initialError ?? ''),
    [message, setMessage] = useState('')
  const size = useCustomerPageSize(2, 1),
    current = Math.min(page, Math.max(1, Math.ceil(tickets.length / size))),
    visible = tickets.slice((current - 1) * size, current * size)
  function open() {
    setError('')
    setCreating(true)
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setError('')
    try {
      const result = await createSupportTicket(form)
      if (result.error) {
        setError(result.error)
        return
      }
      setCreating(false)
      setMessage('Your request has been sent to support.')
      const refreshed = await getMyTickets()
      if (refreshed.error)
        setError(
          'Your request was sent. Refresh the page to reload your requests.',
        )
      else {
        setTickets(refreshed.data)
        setPage(1)
      }
    } catch {
      setError(
        'We could not confirm the request. Please check your connection and try again.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <CustomerPage
      title="How can we help?"
      subtitle="Get support with your deliveries, payments or account."
    >
      <div className={s.supportTopics}>
        {topics.map(({ title, detail, icon: Icon, href }) => (
          <Link key={title} href={href} className={`${s.panel} ${s.topic}`}>
            <span className={s.iconTile}>
              <Icon size={26} aria-hidden />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        ))}
      </div>
      {message && (
        <p className={s.message} role="status">
          {message}
        </p>
      )}
      {error && !creating && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.supportBody}>
        <div className={s.content}>
          <div className={s.ticketList}>
            <h2>Your requests</h2>
            {!visible.length ? (
              <CustomerEmpty>You have no support requests yet.</CustomerEmpty>
            ) : (
              visible.map((t) => (
                <article className={`${s.panel} ${s.ticket}`} key={t.id}>
                  <div className={s.cardTop}>
                    <h3>#{t.id.slice(0, 8).toUpperCase()}</h3>
                    <span
                      className={`${s.badge} ${t.status === 'closed' ? s.success : ''}`}
                    >
                      {t.status === 'closed' ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                  <h3>{t.subject}</h3>
                  <p>{t.message}</p>
                  <p>{shortDate(t.created_at)}</p>
                  <button
                    className={s.textButton}
                    onClick={() => setSelected(t)}
                  >
                    <MessageCircle size={16} />
                    View request
                    <ChevronRight size={15} />
                  </button>
                </article>
              ))
            )}
          </div>
          <CustomerPagination
            page={current}
            count={tickets.length}
            size={size}
            onChange={setPage}
          />
          <button
            className={`${s.primary} ${s.supportMobileButton}`}
            onClick={open}
          >
            <MessageCircle size={19} />
            Start a conversation
          </button>
        </div>
        <aside className={`${s.panel} ${s.conversation}`}>
          <span className={s.iconTile}>
            <MessageCircle size={32} aria-hidden />
          </span>
          <h2>Let’s get it sorted.</h2>
          <p>
            Tell us what happened and include your order number, if you have
            one. Our support team will review your request.
          </p>
          <button className={s.primary} onClick={open}>
            <MessageCircle size={19} />
            Start a conversation
          </button>
          <small className={s.muted}>
            Your requests stay together on this page.
          </small>
        </aside>
      </div>
      {creating && (
        <CustomerDialog
          title="Contact support"
          onClose={() => {
            if (!saving) setCreating(false)
          }}
        >
          <form onSubmit={submit}>
            <label htmlFor="support-subject">
              Subject
              <input
                id="support-subject"
                className={s.input}
                name="subject"
                required
                maxLength={180}
                placeholder="Order number and a short description"
              />
            </label>
            <label htmlFor="support-message">
              How can we help?
              <textarea
                id="support-message"
                className={s.input}
                rows={4}
                name="message"
                maxLength={4000}
                required
                placeholder="Tell us about the problem"
              />
            </label>
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <div className={s.formActions}>
              <button
                type="button"
                className={s.secondary}
                disabled={saving}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button className={s.primary} type="submit" disabled={saving}>
                {saving ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </CustomerDialog>
      )}
      {selected && (
        <CustomerDialog
          title={selected.subject}
          onClose={() => setSelected(null)}
        >
          <span className={s.badge}>
            {selected.status === 'closed' ? 'Resolved' : 'Open'}
          </span>
          <p style={{ marginTop: 18, whiteSpace: 'pre-wrap' }}>
            {selected.message}
          </p>
          <p className={s.muted} style={{ marginTop: 18 }}>
            Submitted {shortDate(selected.created_at)}
          </p>
          <button
            className={s.primary}
            style={{ marginTop: 20 }}
            onClick={() => {
              setSelected(null)
              open()
            }}
          >
            Send another message
          </button>
        </CustomerDialog>
      )}
    </CustomerPage>
  )
}
