'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  ArrowRight,
  CreditCard,
  FileText,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react'
import { paymentDisplayStatus } from '@/lib/payment-display'
import { useCustomerLiveRefresh } from '@/hooks/use-customer-live-refresh'
import { getCustomerPayments } from '@/app/actions/customer-repairs'
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
  actualShopping?:number|null
  unusedShopping?:number|null
  retainedTotal?:number
  payment_method?: string
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
        {row.shoppingFunds ? <><div><dt>Actual receipt total</dt><dd>{row.actualShopping == null ? 'Not settled yet' : money(row.actualShopping)}</dd></div>{row.unusedShopping != null && <div><dt>Unused shopping funds</dt><dd>{money(row.unusedShopping)}</dd></div>}<div><dt>Charged less completed refunds</dt><dd>{money(row.retainedTotal??row.amount)}</dd></div></> : null}
        {row.refund_jobs?.map((refund,i)=><div key={i}><dt>{row.payment_method==='wallet'?'Wallet refund':'Card refund'} · {refund.state.replaceAll('_',' ')}</dt><dd>{money(Number(refund.amount))}</dd></div>)}
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
  const [rows, setRows] = useState<Payment[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState<'charges' | 'refunds'>('charges'),
    [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null),
    [details, setDetails] = useState<Payment | null>(null),
    [revision, setRevision] = useState(0)
  const size = useCustomerPageSize(5, 2)
  const [summary, setSummary] = useState({totalCount:0, paidMonth:0, refunds:0})
  useEffect(() => {
    let alive = true, busy = false
    setLoading(true)
    async function load() {
      if (busy) return; busy = true
      try {
        const r = await getCustomerPayments(page, size, tab === 'refunds')
        if (!alive) return
        if (r.error) setError(r.error)
        else { const normalized=r.data.rows.map((p:Payment)=>({...p,status:paymentDisplayStatus(p.status,Number(p.amount),p.refund_jobs??[])})); setRows(normalized); setDetails(prev=>prev?normalized.find((p:Payment)=>p.id===prev.id)??prev:null); setSummary(r.data); setError(''); const last = Math.max(1, Math.ceil(r.data.totalCount / size)); if (page > last) setPage(last) }
      } catch { if (alive) setError('Could not load payments. Please try again.') }
      finally { busy = false; if (alive) setLoading(false) }
    }
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    void load(); const timer = setInterval(refresh,15000); window.addEventListener('focus',refresh)
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus',refresh) }
  }, [page, size, tab, revision])
  const current = page, visible = rows
  const focus = rows.find(r => r.id === selected) ?? visible[0]
  const {paidMonth, refunds} = summary
  useCustomerLiveRefresh(async()=>{setRevision(v=>v+1)},'payments',0)
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
              <small>Paid this month · before refunds</small>
              <strong>{loading ? '—' : money(paidMonth)}</strong>
            </div>
          </div>
          <div className={`${s.panel} ${s.summary}`}>
            <span className={s.iconTile}>
              <RotateCcw size={22} />
            </span>
            <div>
              <small>Completed refunds · all time</small>
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
            count={summary.totalCount}
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
