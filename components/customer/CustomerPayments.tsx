'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  ArrowRight,
  CreditCard,
  FileText,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CustomerDialog,
  CustomerEmpty,
  CustomerPage,
  CustomerPagination,
  money,
  shortDate,
  useCustomerPageSize,
} from './CustomerPage'
import s from './CustomerPages.module.css'
type Payment = {
  refund_jobs?: {amount:number;state:string}[]
  shoppingFunds?:number
  serviceFees?:number
  id: string
  delivery_id: string | null
  amount: number
  status: string
  created_at: string | null
  tracking: string
  service: string
}
function PaymentReceipt({
  row,
  download,
}: {
  row: Payment
  download: (row: Payment) => void
}) {
  return (
    <>
      <h2>Payment details</h2>
      <p>
        {row.tracking} · {shortDate(row.created_at)}
      </p>
      <dl>
        <div>
          <dt>Service</dt>
          <dd>{row.service}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{row.status.replaceAll('_', ' ')}</dd>
        </div>
        {!!row.shoppingFunds&&<><div><dt>Service fees</dt><dd>{money(row.serviceFees??0)}</dd></div><div><dt>Prepaid shopping funds</dt><dd>{money(row.shoppingFunds)}</dd></div></>}
        {row.refund_jobs?.map((refund,i)=><div key={i}><dt>Card refund · {refund.state.replaceAll('_',' ')}</dt><dd>{money(Number(refund.amount))}</dd></div>)}
        <div className={s.total}>
          <dt>Recorded total</dt>
          <dd>{money(row.amount)}</dd>
        </div>
      </dl>
      <p>
        Refunds are returned to the original payment method. Pending refunds remain visible until processing completes.
      </p>
      <button className={s.secondary} onClick={() => download(row)}>
        <ArrowDownToLine size={16} />
        Download summary
      </button>
      {row.delivery_id && (
        <Link
          className={s.textButton}
          href={`/dashboard/customer/tracking?id=${row.delivery_id}`}
        >
          View order
          <ArrowRight size={15} />
        </Link>
      )}
    </>
  )
}
export default function CustomerPayments() {
  const client = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Payment[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState<'charges' | 'refunds'>('charges'),
    [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null),
    [details, setDetails] = useState<Payment | null>(null),
    [revision, setRevision] = useState(0)
  const size = useCustomerPageSize(5, 2)
  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const {
          data: { user },
        } = await client.auth.getUser()
        if (!user) throw new Error('Please sign in to view payments.')
        // Existing schema only. Do not assume the separate launch migration exists.
        const { data: deliveries, error: orderError } = await client
          .from('delivery_requests')
          .select('id,tracking_number,service_type,price,max_spend_approved')
          .eq('customer_id', user.id)
        if (orderError) throw orderError
        const orders = new Map((deliveries ?? []).map((d) => [d.id, d]))
        if (!orders.size) {
          if (alive) setRows([])
          return
        }
        const { data, error: paymentError } = await client
          .from('payments')
          .select('id,amount,status,created_at,delivery_id,refund_jobs,payment_method')
          .in('delivery_id', [...orders.keys()])
          .order('created_at', { ascending: false })
        if (paymentError) throw paymentError
        if (alive)
          setRows(
            (data ?? []).map((p) => ({
              ...p,
              shoppingFunds:Number(orders.get(p.delivery_id)?.max_spend_approved??0),
              serviceFees:Number(orders.get(p.delivery_id)?.price??0),
              amount: Number(p.amount ?? 0),
              status: (p.status ?? 'pending').toLowerCase(),
              tracking:
                orders.get(p.delivery_id)?.tracking_number ??
                `GD-${p.id.slice(0, 6).toUpperCase()}`,
              service:
                orders.get(p.delivery_id)?.service_type === 'buy_for_me'
                  ? 'Buy for Me'
                  : 'Collect & Deliver',
            })),
          )
      } catch {
        if (alive) setError('Could not load payments. Please try again.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [client, revision])
  const filtered = rows.filter((r) =>
    tab === 'refunds'
      ? (r.refund_jobs?.length??0)>0 || ['refunded', 'partially_refunded'].includes(r.status)
      : true,
  )
  const current = Math.min(
      page,
      Math.max(1, Math.ceil(filtered.length / size)),
    ),
    visible = filtered.slice((current - 1) * size, current * size)
  const focus = filtered.find((r) => r.id === selected) ?? visible[0]
  const now = new Date()
  const paidMonth = rows
    .filter(
      (r) =>
        ['paid', 'released'].includes(r.status) &&
        r.created_at &&
        new Date(r.created_at).getMonth() === now.getMonth() &&
        new Date(r.created_at).getFullYear() === now.getFullYear(),
    )
    .reduce((sum, r) => sum + r.amount, 0)
  const refunds = rows.reduce((sum,r)=>sum+(r.refund_jobs?.filter(j=>j.state==='succeeded').reduce((total,j)=>total+Number(j.amount),0)??(r.status==='refunded'?r.amount:0)),0)
  function download(row: Payment) {
    const text = `GoDrop payment summary\nOrder: ${row.tracking}\nService: ${row.service}\nDate: ${shortDate(row.created_at)}\nStatus: ${row.status}\nRecorded total: ${money(row.amount)}\nPayment reference: ${row.id}\n\nThis is a payment summary, not a VAT invoice.`
    const url = URL.createObjectURL(
        new Blob([text], { type: 'text/plain;charset=utf-8' }),
      ),
      a = document.createElement('a')
    a.href = url
    a.download = `godrop-payment-${row.id}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <CustomerPage
      title="Payments"
      subtitle="View your charges, refunds and payment records."
    >
      <div className={s.paymentHeading}>
        <div className={s.summaries}>
          <div className={`${s.panel} ${s.summary}`}>
            <span className={s.iconTile}>
              <CreditCard size={23} />
            </span>
            <div>
              <small>Paid this month</small>
              <strong>{loading ? '—' : money(paidMonth)}</strong>
            </div>
          </div>
          <div className={`${s.panel} ${s.summary}`}>
            <span className={s.iconTile}>
              <RotateCcw size={22} />
            </span>
            <div>
              <small>Recorded refunds</small>
              <strong>{loading ? '—' : money(refunds)}</strong>
            </div>
          </div>
        </div>
        <Link
          className={`${s.secondary} ${s.desktopOnly}`}
          href="/dashboard/customer/wallet"
        >
          Wallet
        </Link>
      </div>
      <div className={s.toolbar}>
        <div className={s.tabs} role="tablist" aria-label="Payment records">
          <button
            role="tab"
            aria-selected={tab === 'charges'}
            onClick={() => {
              setTab('charges')
              setPage(1)
            }}
          >
            Charges
          </button>
          <button
            role="tab"
            aria-selected={tab === 'refunds'}
            onClick={() => {
              setTab('refunds')
              setPage(1)
            }}
          >
            Refunds
          </button>
          <Link className={s.mobileOnly} href="/dashboard/customer/wallet">
            Wallet
          </Link>
        </div>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}{' '}
          <button
            className={s.textButton}
            onClick={() => setRevision((r) => r + 1)}
          >
            Retry
          </button>
        </p>
      )}
      <div className={s.workspace}>
        <div className={s.content}>
          {loading ? (
            <CustomerEmpty loading>Loading payments</CustomerEmpty>
          ) : !visible.length ? (
            <CustomerEmpty>
              {tab === 'refunds'
                ? 'No refunds recorded yet. Contact support for help with a refund.'
                : 'Your payment records will appear here after your first booking.'}
            </CustomerEmpty>
          ) : (
            <>
              <div className={`${s.tableWrap} ${s.desktopOnly}`}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr
                        key={row.id}
                        className={focus?.id === row.id ? s.selectedRow : ''}
                      >
                        <td>
                          <strong>{row.tracking}</strong>
                        </td>
                        <td>{shortDate(row.created_at)}</td>
                        <td>{row.service}</td>
                        <td>
                          <span
                            className={`${s.badge} ${['paid', 'released', 'refunded'].includes(row.status) ? s.success : ''}`}
                          >
                            {row.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <strong>{money(row.amount)}</strong>
                        </td>
                        <td>
                          <button
                            className={s.secondary}
                            aria-label={`View payment ${row.tracking}`}
                            onClick={() => setSelected(row.id)}
                          >
                            <FileText size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`${s.list} ${s.mobileOnly}`}>
                {visible.map((row) => (
                  <article
                    className={`${s.panel} ${s.paymentCard}`}
                    key={row.id}
                  >
                    <div className={s.cardTop}>
                      <span className={s.iconTile}>
                        {row.service === 'Buy for Me' ? (
                          <ShoppingBag size={23} />
                        ) : (
                          <CreditCard size={23} />
                        )}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong>{money(row.amount)}</strong>
                        <p>{row.service}</p>
                      </div>
                      <span
                        className={`${s.badge} ${['paid', 'released'].includes(row.status) ? s.success : ''}`}
                      >
                        {row.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div className={s.receiptLine}>
                      <span>{row.tracking}</span>
                      <span>{shortDate(row.created_at)}</span>
                    </div>
                    <button
                      className={s.receiptLink}
                      style={{
                        background: 'none',
                        borderLeft: 0,
                        borderRight: 0,
                        borderBottom: 0,
                      }}
                      onClick={() => setDetails(row)}
                    >
                      <span>
                        <FileText
                          size={15}
                          style={{ display: 'inline', marginRight: 8 }}
                        />
                        View payment details
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          <CustomerPagination
            page={current}
            count={filtered.length}
            size={size}
            onChange={setPage}
          />
        </div>
        {focus && !loading && (
          <aside className={`${s.panel} ${s.receipt} ${s.desktopOnly}`}>
            <PaymentReceipt row={focus} download={download} />
          </aside>
        )}
      </div>
      {details && (
        <CustomerDialog
          title="Payment summary"
          onClose={() => setDetails(null)}
        >
          <div className={s.receipt}>
            <PaymentReceipt row={details} download={download} />
          </div>
        </CustomerDialog>
      )}
    </CustomerPage>
  )
}
