'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { createClient } from '@/lib/supabase/client'

// A unified row — built from the payments table, with delivery info joined
type TxRow = {
  id: string
  amount: number
  status: string
  created_at: string | null
  tracking_number: string | null
  source: 'payment' | 'delivery' // fallback rows come from delivery_requests
}

const STATUS_STYLE: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  pending:   { label: 'Pending',  color: 'text-[#c180ff]', dot: 'bg-[#c180ff]', bg: 'bg-[#c180ff]/10' },
  paid:      { label: 'Paid',     color: 'text-[#6ee7b7]', dot: 'bg-[#6ee7b7]', bg: 'bg-[#6ee7b7]/10' },
  released:  { label: 'Released', color: 'text-[#6ee7b7]', dot: 'bg-[#6ee7b7]', bg: 'bg-[#6ee7b7]/10' },
  failed:    { label: 'Failed',   color: 'text-[#ff6e84]', dot: 'bg-[#ff6e84]', bg: 'bg-[#ff6e84]/10' },
  requested: { label: 'Awaiting', color: 'text-[#adaaaa]', dot: 'bg-[#adaaaa]', bg: 'bg-[#adaaaa]/10' },
  accepted:  { label: 'Awaiting', color: 'text-[#adaaaa]', dot: 'bg-[#adaaaa]', bg: 'bg-[#adaaaa]/10' },
  delivered: { label: 'Paid',     color: 'text-[#6ee7b7]', dot: 'bg-[#6ee7b7]', bg: 'bg-[#6ee7b7]/10' },
}

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export default function PaymentsPage() {
  const [showModal, setShowModal] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Fetch customer's deliveries with price + status
      const { data: deliveries } = await supabase
        .from('delivery_requests')
        .select('id, tracking_number, price, status, created_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      const deliveryRows = deliveries ?? []
      const ids = deliveryRows.map((d: any) => d.id)

      // Try to fetch payment records for these deliveries
      let paymentRows: TxRow[] = []
      if (ids.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('id, amount, status, created_at, delivery_id, delivery_requests(tracking_number)')
          .in('delivery_id', ids)
          .order('created_at', { ascending: false })

        if (payments && payments.length > 0) {
          paymentRows = payments.map((p: any) => {
            const dr = Array.isArray(p.delivery_requests) ? p.delivery_requests[0] : p.delivery_requests
            return {
              id: p.id,
              amount: Number(p.amount ?? 0),
              status: (p.status ?? 'pending').toLowerCase(),
              created_at: p.created_at,
              tracking_number: dr?.tracking_number ?? null,
              source: 'payment' as const,
            }
          })
        }
      }

      if (cancelled) return

      // If we got payment records, use them; otherwise fall back to delivery_requests.price
      if (paymentRows.length > 0) {
        setTransactions(paymentRows)
      } else {
        // Fallback: build transaction rows from delivery_requests so the page never appears empty
        const fallback: TxRow[] = deliveryRows
          .filter((d: any) => d.price && Number(d.price) > 0)
          .map((d: any) => ({
            id: d.id,
            amount: Number(d.price),
            status: d.status ?? 'requested',
            created_at: d.created_at,
            tracking_number: d.tracking_number,
            source: 'delivery' as const,
          }))
        setTransactions(fallback)
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
    for (const tx of transactions) {
      const s = tx.status.toLowerCase()
      const isPaid = s === 'paid' || s === 'released' || s === 'delivered'
      const isPending = s === 'pending' || s === 'requested' || s === 'accepted'
      if (isPaid) {
        totalPaid += tx.amount
        if (tx.created_at) {
          const d = new Date(tx.created_at)
          if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            monthSpend += tx.amount
          }
        }
      } else if (isPending) {
        totalPending += tx.amount
      }
    }
    return { totalPaid, totalPending, monthSpend, count: transactions.length }
  }, [transactions])

  const visible = showAll ? transactions : transactions.slice(0, 5)

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-24 pb-12 md:ml-64 px-4 md:px-8 min-h-screen bg-[#0e0e0e]">
        <div className="max-w-5xl mx-auto">

          {/* Page header */}
          <header className="mb-10">
            <h2 className="text-3xl font-extrabold font-headline tracking-tight text-white">Payments</h2>
            <p className="text-[#adaaaa] mt-2 text-sm">Review your delivery charges and settlement history.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Transactions list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#a3a6ff]">receipt_long</span>
                  Transaction History
                </h3>
                {transactions.length > 0 && (
                  <span className="text-xs font-bold text-[#a3a6ff]">{transactions.length} total</span>
                )}
              </div>

              <div className="bg-[#1a1919] rounded-2xl overflow-hidden">
                {loading ? (
                  <div className="py-16 text-center">
                    <span className="material-symbols-outlined text-[#adaaaa] text-3xl animate-spin">progress_activity</span>
                    <p className="text-xs text-[#adaaaa] mt-3 uppercase tracking-widest">Loading transactions…</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-16 text-center px-8">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#262626] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#a3a6ff] text-2xl">receipt_long</span>
                    </div>
                    <p className="text-sm font-bold text-white mb-1">No payment transactions yet</p>
                    <p className="text-xs text-[#adaaaa]">
                      Once you request a delivery, charges will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#494847]/10">
                    {visible.map((tx) => {
                      const sKey = tx.status.toLowerCase()
                      const meta = STATUS_STYLE[sKey] ?? STATUS_STYLE.pending
                      const label = tx.tracking_number
                        ? `Delivery ${tx.tracking_number}`
                        : 'Delivery charge'
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between px-5 py-4 hover:bg-[#201f1f] transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#262626] group-hover:bg-[#a3a6ff]/10 flex items-center justify-center transition-colors shrink-0">
                              <span className="material-symbols-outlined text-[#a3a6ff]">local_shipping</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{label}</p>
                              <p className="text-xs text-[#adaaaa]">{fmtDate(tx.created_at)}</p>
                            </div>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-sm font-black text-white">{fmt(tx.amount)}</p>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${meta.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}

                    {transactions.length > 5 && (
                      <div className="px-5 py-3">
                        <button
                          onClick={() => setShowAll(v => !v)}
                          className="w-full py-2.5 rounded-lg border border-[#494847]/20 text-[#adaaaa] hover:text-white hover:bg-[#262626] text-xs font-bold uppercase tracking-widest transition-all"
                        >
                          {showAll ? 'Show fewer' : `Show all ${transactions.length} transactions`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Billing summary */}
            <div className="space-y-4">
              {/* Total paid card */}
              <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-2xl border border-[#a3a6ff]/20 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-[#a3a6ff]/10 rounded-full blur-2xl" />
                <p className="text-[10px] font-bold text-[#a3a6ff] uppercase tracking-[0.2em] mb-2">Total Paid</p>
                <h4 className="text-4xl font-headline font-black text-white mb-6">{fmt(summary.totalPaid)}</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#adaaaa]">This month</span>
                    <span className="text-white font-bold">{fmt(summary.monthSpend)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#adaaaa]">Pending</span>
                    <span className="text-[#c180ff] font-bold">{fmt(summary.totalPending)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-[#494847]/20 pt-3">
                    <span className="text-[#adaaaa]">Total transactions</span>
                    <span className="text-white font-bold">{summary.count}</span>
                  </div>
                </div>
              </div>

              {/* Security badge */}
              <div className="bg-[#1a1919] border border-[#494847]/10 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-11 h-11 bg-[#6ee7b7]/10 rounded-full flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-[#6ee7b7]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Secure payments</p>
                  <p className="text-[10px] text-[#adaaaa]">All charges processed through Stripe</p>
                </div>
              </div>

              {/* Payment method placeholder */}
              <div className="bg-[#1a1919] border border-[#494847]/10 p-5 rounded-2xl">
                <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest mb-3">Payment Method</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-[#262626] rounded flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#adaaaa] text-sm">credit_card</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Card on file</p>
                    <p className="text-[10px] text-[#adaaaa]">Managed via Stripe</p>
                  </div>
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
