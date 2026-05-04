'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { createClient } from '@/lib/supabase/client'

type PaymentRow = {
  id: string
  amount: number | null
  status: string | null
  created_at: string | null
  delivery_id: string | null
  delivery_requests: { tracking_number: string | null } | { tracking_number: string | null }[] | null
}

const PAYMENT_STATUS_STYLE: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: 'Pending', color: 'text-secondary', dot: 'bg-secondary' },
  paid: { label: 'Paid', color: 'text-primary', dot: 'bg-primary' },
  released: { label: 'Released', color: 'text-primary', dot: 'bg-primary' },
  failed: { label: 'Failed', color: 'text-error', dot: 'bg-error' },
}

function formatTxDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function trackingFor(row: PaymentRow): string | null {
  const ref = row.delivery_requests
  if (!ref) return null
  if (Array.isArray(ref)) return ref[0]?.tracking_number ?? null
  return ref.tracking_number ?? null
}

export default function PaymentsPage() {
  const [showModal, setShowModal] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const [transactions, setTransactions] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: deliveries, error: dErr } = await supabase
        .from('delivery_requests')
        .select('id')
        .eq('customer_id', user.id)

      if (dErr) {
        console.error('[v0] payments deliveries fetch error', dErr)
        if (!cancelled) { setTransactions([]); setLoading(false) }
        return
      }

      const ids = (deliveries ?? []).map((d: any) => d.id)
      if (ids.length === 0) {
        if (!cancelled) { setTransactions([]); setLoading(false) }
        return
      }

      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, status, created_at, delivery_id, delivery_requests(tracking_number)')
        .in('delivery_id', ids)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        console.error('[v0] payments fetch error', error)
        setTransactions([])
      } else {
        setTransactions((data ?? []) as unknown as PaymentRow[])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const summary = useMemo(() => {
    let totalPaid = 0
    let totalPending = 0
    let monthSpend = 0
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    for (const tx of transactions) {
      const amt = Number(tx.amount ?? 0)
      const status = (tx.status || 'pending').toLowerCase()
      if (status === 'paid' || status === 'released') {
        totalPaid += amt
        if (tx.created_at) {
          const d = new Date(tx.created_at)
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            monthSpend += amt
          }
        }
      } else if (status === 'pending') {
        totalPending += amt
      }
    }
    return { totalPaid, totalPending, monthSpend, count: transactions.length }
  }, [transactions])

  const visibleTransactions = showAll ? transactions : transactions.slice(0, 5)

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-24 pb-12 md:ml-64 px-8 min-h-screen bg-surface-container-low">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-10">
            <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">
              Payments
            </h2>
            <p className="text-on-surface-variant mt-2 text-sm">
              Review your delivery charges and settlement history.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Transactions */}
            <div className="lg:col-span-2 space-y-8">
              <section>
                <h3 className="text-lg font-bold font-headline text-on-surface mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-secondary">history</span>
                  Transaction History
                </h3>
                <div className="bg-surface-container rounded-xl overflow-hidden">
                  <div className="p-6 space-y-4">
                    {loading ? (
                      <p className="p-6 text-center text-xs text-on-surface-variant uppercase tracking-widest">Loading transactions...</p>
                    ) : transactions.length === 0 ? (
                      <div className="p-10 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined">receipt_long</span>
                        </div>
                        <p className="text-sm text-on-surface font-medium">No payment transactions yet.</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          Charges will show up here as soon as a delivery is paid.
                        </p>
                      </div>
                    ) : (
                      <>
                        {visibleTransactions.map((tx) => {
                          const statusKey = (tx.status || 'pending').toLowerCase()
                          const meta = PAYMENT_STATUS_STYLE[statusKey] ?? { label: statusKey, color: 'text-on-surface-variant', dot: 'bg-on-surface-variant' }
                          const tracking = trackingFor(tx)
                          const trackingLabel = tracking
                            ? `Delivery #${tracking}`
                            : 'Delivery payment'
                          return (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg hover:bg-surface-container-high transition-colors group"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
                                  <span className="material-symbols-outlined">local_shipping</span>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-on-surface">{trackingLabel}</p>
                                  <p className="text-xs text-on-surface-variant">{formatTxDate(tx.created_at)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-on-surface">
                                  {tx.amount == null ? '—' : formatCurrency(Number(tx.amount))}
                                </p>
                                <p className={`text-[10px] ${meta.color} flex items-center justify-end`}>
                                  <span className={`w-1 h-1 rounded-full mr-1 ${meta.dot}`} />
                                  {meta.label}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                        {transactions.length > 5 && (
                          <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="w-full mt-2 py-3 border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all text-xs font-bold tracking-widest uppercase rounded-lg"
                          >
                            {showAll ? 'Show fewer' : `Show all (${transactions.length})`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Right: Billing Summary */}
            <div className="space-y-6">
              <div className="bg-surface-container-high p-8 rounded-2xl relative overflow-hidden border border-outline-variant/10">
                <div className="relative z-10">
                  <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2">
                    Total Paid
                  </p>
                  <h4 className="text-4xl font-headline font-black text-on-surface mb-6">
                    {formatCurrency(summary.totalPaid)}
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">This month</span>
                      <span className="text-on-surface font-bold">
                        {formatCurrency(summary.monthSpend)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Pending</span>
                      <span className="text-secondary font-bold">
                        {formatCurrency(summary.totalPending)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Transactions</span>
                      <span className="text-on-surface font-bold">{summary.count}</span>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/5 blur-3xl rounded-full" />
              </div>

              <div className="bg-[#0e0e0e] border border-outline-variant/10 p-6 rounded-2xl flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Secure payments</p>
                  <p className="text-[10px] text-on-surface-variant">All charges processed through Stripe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
