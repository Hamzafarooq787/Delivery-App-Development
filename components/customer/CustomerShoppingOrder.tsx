'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCustomerShoppingDetails, type CustomerShoppingDetails } from '@/app/actions/customer-shopping'
import { respondToSubstitution } from '@/app/actions/shopping'
import { orderMediaUrl } from '@/lib/order-media'
import { shoppingFinancials } from '@/lib/shopping-summary'
import styles from './CustomerShoppingOrder.module.css'
const money = (v: number) => `£${v.toFixed(2)}`
export function CustomerShoppingOrder({ orderId }: { orderId: string }) {
  const [details,setDetails] = useState<CustomerShoppingDetails | null>(null)
  const [error,setError] = useState(''), [notice,setNotice] = useState(''), [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState<string | null>(null)
  const loadSequence = useRef(0)
  const generation = useRef(0), mounted = useRef(false), pending = useRef(false), decisionLock = useRef(false)
  const refresh = useCallback(async (force = false) => {
    if (pending.current && !force) return
    pending.current = true
    const current = generation.current, sequence = ++loadSequence.current
    try {
      const result = await getCustomerShoppingDetails(orderId)
      if (!mounted.current || current !== generation.current || sequence !== loadSequence.current) return
      if ('error' in result) setError(result.error)
      else { setDetails(result.data); setError('') }
    } catch { if (mounted.current && current === generation.current && sequence === loadSequence.current) setError('Shopping details could not load. Retry below.') }
    finally { if (sequence === loadSequence.current) { pending.current = false; if (mounted.current && current === generation.current) setLoading(false) } }
  },[orderId])
  useEffect(() => {
    mounted.current = true; generation.current++; pending.current = false; setDetails(null); setLoading(true); setError(''); setNotice('')
    void refresh()
    const visible = () => { if (!document.hidden) void refresh() }
    const timer = setInterval(visible,10000)
    window.addEventListener('focus',visible); document.addEventListener('visibilitychange',visible)
    return () => { mounted.current = false; generation.current++; clearInterval(timer); window.removeEventListener('focus',visible); document.removeEventListener('visibilitychange',visible) }
  },[refresh])
  async function decide(id: string, approved: boolean) {
    if (decisionLock.current) return
    decisionLock.current = true; setBusy(id); setError(''); setNotice('')
    const current = generation.current
    try {
      const result = await respondToSubstitution(id,approved)
      if (!mounted.current || current !== generation.current) return
      if (result.error) setError(result.error)
      else { setNotice(approved ? 'Approved. Your driver can see the update.' : 'Rejected. Your driver can see the update.'); await refresh(true) }
    } catch { if (mounted.current && current === generation.current) setError('We could not confirm your decision. Refresh before retrying.') }
    finally { decisionLock.current = false; if (mounted.current && current === generation.current) setBusy(null) }
  }
  const order = details?.order
  const totals = order ? shoppingFinancials(order,details?.payment) : null
  const decisionsOpen = order?.status === 'collected' && order.bfm_stage === 'shopping'
  return <section className={styles.panel} aria-label="Your shopping order">
    <h2>Your shopping order</h2>
    {order && <p>{order.shop_name} · {(order.bfm_stage ?? order.status ?? 'pending').replaceAll('_',' ')}</p>}
    {loading && <p role="status">Loading shopping details…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={()=>void refresh()}>Refresh shopping details</button></div>}
    {notice && <p role="status">{notice}</p>}
    {details && <>
      <div className={styles.items} tabIndex={0} aria-label="Shopping products and approvals">
        {details.items.map(item=><article key={item.id} className={styles.item}>
          <h3>{item.quantity} × {item.name}</h3>
          <p>{item.status.replaceAll('_',' ')}{item.brand_size_variant ? ` · ${item.brand_size_variant}` : ''}</p>
          {item.notes && <p>{item.notes}</p>}
          {item.photo_url && <a href={orderMediaUrl(item.photo_url)} target="_blank" rel="noreferrer"><img src={orderMediaUrl(item.photo_url)} alt={`Requested ${item.name}`} />View item photo</a>}
          <p>Estimated unit price: {item.estimated_price == null ? 'Not entered' : money(Number(item.estimated_price))}</p>
          {item.confirmed_unit_price != null && <p>Confirmed shelf price per unit: {money(Number(item.confirmed_unit_price))}</p>}
          {details.decisions.filter(d=>d.shopping_item_id===item.id).map(d=><div key={d.id} className={styles.decision}>
            <h4>{d.customer_approved === null ? 'Your approval is needed' : d.customer_approved ? 'Approved' : 'Rejected'}</h4>
            <p>Suggested product: {d.suggested_name}</p>{d.suggested_price == null ? <p>Your driver must provide a price before you can approve.</p> : <p>{money(Number(d.suggested_price))} per unit · {money(Number(d.suggested_price)*item.quantity)} for {item.quantity}</p>}
            {item.estimated_price != null && d.suggested_price != null && <p>Change from your estimate: {money((Number(d.suggested_price)-Number(item.estimated_price))*item.quantity)}</p>}
            {Number(d.suggested_price)*item.quantity > Number(order?.max_spend_approved??0) && <p>This exceeds your prepaid shopping funds. Reject it and ask your driver for an option within your budget.</p>}{d.driver_notes && <p>{d.driver_notes}</p>}
            {d.photo_url && <a href={orderMediaUrl(d.photo_url)} target="_blank" rel="noreferrer">View suggested product photo</a>}
            {d.customer_approved === null && (decisionsOpen ? <div className={styles.actions}>
              <button type="button" disabled={!!busy || !!error || d.suggested_price == null || Number(d.suggested_price)*item.quantity > Number(order?.max_spend_approved??0)} onClick={()=>void decide(d.id,true)} aria-label={`Approve ${d.suggested_name}`}>{busy===d.id ? 'Saving…' : 'Approve'}</button>
              <button type="button" disabled={!!busy || !!error} onClick={()=>void decide(d.id,false)} aria-label={`Reject ${d.suggested_name}`}>Reject</button>
            </div> : <p>This order is no longer accepting shopping decisions.</p>)}
          </div>)}
        </article>)}
        {!details.items.length && <p>No shopping products were found. Contact support if this looks wrong.</p>}
      </div>
      {totals && <dl className={styles.totals}>
        <div><dt>Delivery and shopping service fees</dt><dd>{money(totals.fees)}</dd></div>
        <div><dt>Prepaid shopping funds</dt><dd>{money(totals.prepaid)}</dd></div>
        <div><dt>Original booking charge</dt><dd>{money(totals.charged)}</dd></div>
        <div><dt>Actual receipt total</dt><dd>{totals.actual == null ? 'Not settled yet' : money(totals.actual)}</dd></div>
        {totals.unused != null && <div><dt>Unused shopping funds</dt><dd>{money(totals.unused)}</dd></div>}
        {totals.refunds.map((r,i)=><div key={r.key??i}><dt>{r.key==='unused-shopping' ? 'Unused-funds refund' : 'Refund'} · {r.state.replaceAll('_',' ')}</dt><dd>{money(Number(r.amount))}</dd></div>)}
        <div><dt>{order?.payment_method === 'stripe' ? 'Completed refunds to card' : 'Returned to wallet'}</dt><dd>{money(totals.returned)}</dd></div>
        <div><dt>Charged less completed refunds</dt><dd>{money(totals.retained)}</dd></div>
      </dl>}
      {order?.receipt_url && <a className={styles.receipt} href={orderMediaUrl(order.receipt_url)} target="_blank" rel="noreferrer"><img src={orderMediaUrl(order.receipt_url)} alt="Shopping receipt" />Open full receipt</a>}
      <p>Approving a price does not increase your prepaid shopping budget.</p>
      <p>Unused shopping funds return to your original payment method. A pending refund is not yet completed.</p>
    </>}
  </section>
}
