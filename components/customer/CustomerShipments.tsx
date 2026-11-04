'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Box,
  Ellipsis,
  FileImage,
  MapPin,
  Plus,
  Search,
  Truck,
} from 'lucide-react'
import { shoppingFinancials, type RefundRecord } from '@/lib/shopping-summary'
import { getDriverNamesByIds } from '@/app/actions/driver'
import { CancelOrderButton } from './cancel-order-button'
import {
  CustomerDialog,
  CustomerEmpty,
  CustomerPage,
  CustomerPagination,
  money,
  openNewCustomerOrder,
  shortDate,
  useCustomerPageSize,
} from './CustomerPage'
import s from './CustomerPages.module.css'
import { shortRequest } from '@/lib/short-request'

type Shipment = {
  max_spend_approved?: number | null
  actual_items_total?: number | null
  shopping_hold_settled_at?: string | null
  payment_method?: string | null
  payments?: {amount:number;payment_method:string;refund_jobs:RefundRecord[]}[] | {amount:number;payment_method:string;refund_jobs:RefundRecord[]}
  id: string
  tracking_number: string | null
  driver_id: string | null
  pickup_address: string | null
  delivery_address: string | null
  item_description: string | null
  price: number | null
  status: string | null
  created_at: string | null
  service_type: string | null
  delivered_image_url: string | null
}
export default function CustomerShipments({
  history = false,
}: {
  history?: boolean
}) {
  const [rows, setRows] = useState<Shipment[]>([]),
    [count, setCount] = useState(0),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<string | null>(null),
    [proof, setProof] = useState<Shipment | null>(null),
    [orderDetails, setOrderDetails] = useState<Shipment | null>(null)
  const [detailsError,setDetailsError]=useState(''),[detailsLoading,setDetailsLoading]=useState(false)
  const size = useCustomerPageSize(5, 2)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.replace(/[(),]/g, ' ').trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])
  const current = page
  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(9000)])
    setLoading(true)
    setError('')
    const params = new URLSearchParams({history:history?'1':'0',page:String(current),size:String(size),search})
    void shortRequest(fetch(`/api/customer/shipments?${params}`, {signal, cache:'no-store'}).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load shipments. Please try again.')
      return result as {rows: Shipment[]; count:number}
    }), 9200).then(result => {
      if (!alive) return
      setRows(result.rows)
      setCount(result.count)
      setLoading(false)
      const ids = [...new Set(result.rows.map(r => r.driver_id).filter((id):id is string => !!id))]
      // Optional names never block the list or replace it with an error.
      setNames({})
      if (ids.length) void shortRequest(getDriverNamesByIds(ids), 2400).then(map => { if(alive) setNames(map ?? {}) }).catch(()=>{})
    }).catch(error => {
      if (!alive) return
      setError(signal.aborted || error?.message === 'Request timed out' ? 'Shipments are taking too long to load. Please retry.' : error?.message || 'Could not load shipments. Please try again.')
      setLoading(false)
    })
    return () => { alive = false; controller.abort() }
  }, [history, current, size, search, revision])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(r=>r+1) }
    const timer = setInterval(refresh, 30000)
    document.addEventListener('godrop-order-created',refresh)
    window.addEventListener('online',refresh)
    return () => { clearInterval(timer);document.removeEventListener('godrop-order-created',refresh);window.removeEventListener('online',refresh) }
  }, [])
  useEffect(()=>{
    const id=orderDetails?.id
    if(!id)return
    const controller=new AbortController()
    let alive=true;setDetailsLoading(true);setDetailsError('')
    void shortRequest(fetch('/api/customer/shipments?'+new URLSearchParams({id}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)])}).then(async response=>{
      const result=await response.json()
      if(!response.ok||!result.shipment)throw new Error()
      return result.shipment as Shipment
    }),2900).then(shipment=>{if(alive)setOrderDetails(shipment)}).catch(()=>{if(alive)setDetailsError('Could not refresh this order. Please retry.')}).finally(()=>{if(alive)setDetailsLoading(false)})
    return()=>{alive=false;controller.abort()}
  },[orderDetails?.id,revision])
  const focus = rows.find((r) => r.id === selected) ?? rows[0]
  const label = (row: Shipment) =>
    row.tracking_number ?? `GD-${row.id.slice(0, 6).toUpperCase()}`
  const service = (row: Shipment) =>
    row.service_type === 'buy_for_me' ? 'Buy for Me' : 'Collect & Deliver'
  const status = (row: Shipment) =>
    ({
      in_transit: 'Out for delivery',
      collected: 'Collected',
      accepted: 'Driver assigned',
      requested: 'Finding a driver',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    })[row.status ?? ''] ?? (row.status ?? 'Requested').replaceAll('_', ' ')
  const totalPaid = (row: Shipment) => row.service_type === 'buy_for_me' ? shoppingFinancials({...row,max_spend_approved:row.max_spend_approved??0},Array.isArray(row.payments) ? row.payments[0] : row.payments).charged : Number(row.price??0)
  const track = (row: Shipment) => `/dashboard/customer/tracking?id=${row.id}`
  const liveDetails = orderDetails
  return (
    <CustomerPage
      title="Your shipments"
      subtitle="Track your orders or create a new delivery."
      action={
        <button className={s.primary} onClick={openNewCustomerOrder}>
          <Plus size={17} aria-hidden />
          New order
        </button>
      }
    >
      <div className={s.toolbar}>
        <div className={s.tabs}>
          <Link
            href="/dashboard/customer/active-deliveries"
            aria-current={!history ? 'page' : undefined}
          >
            Active
          </Link>
          <Link
            href="/dashboard/customer/history"
            aria-current={history ? 'page' : undefined}
          >
            History
          </Link>
        </div>
        <label className={s.search}>
          <Search size={18} aria-hidden />
          <input
            aria-label="Search shipments"
            placeholder="Search shipments…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <div className={s.error} role="alert">
          {error}{' '}
          <button
            className={s.textButton}
            onClick={() => setRevision((r) => r + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <div className={s.workspace}>
        <div className={s.content}>
          {loading ? (
            <CustomerEmpty loading>Loading shipments</CustomerEmpty>
          ) : error && !rows.length ? null : !rows.length ? (
            <CustomerEmpty>
              {search
                ? 'No shipments match your search.'
                : history
                  ? 'Your completed and cancelled orders will appear here.'
                  : 'No active shipments. Book a delivery to get started.'}
            </CustomerEmpty>
          ) : (
            <>
              <div className={`${s.tableWrap} ${s.desktopOnly}`}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Service</th>
                      <th>Pickup</th>
                      <th>Delivery</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={row.id === focus?.id ? s.selectedRow : ''}
                      >
                        <td>
                          <button
                            className={s.textButton}
                            onClick={() => setSelected(row.id)}
                          >
                            {label(row)}
                          </button>
                          <small>{shortDate(row.created_at)}</small>
                        </td>
                        <td>{service(row)}</td>
                        <td>
                          {row.pickup_address
                            ?.split(',')
                            .slice(0, 2)
                            .join(',') || '—'}
                        </td>
                        <td>
                          {row.delivery_address
                            ?.split(',')
                            .slice(0, 2)
                            .join(',') || '—'}
                        </td>
                        <td>
                          <span
                            className={`${s.badge} ${row.status === 'delivered' ? s.success : row.status === 'cancelled' ? s.bad : ''}`}
                          >
                            {status(row)}
                          </span>
                        </td>
                        <td>
                          <Link className={s.primary} href={track(row)}>
                            {history ? 'View' : 'Track'}
                            <ArrowRight size={13} aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`${s.list} ${s.mobileOnly}`}>
                {rows.map((row) => (
                  <article
                    key={row.id}
                    className={`${s.panel} ${s.shipmentCard}`}
                  >
                    <div className={s.cardTop}>
                      <div>
                        <h2>{label(row)}</h2>
                        <p>{service(row)}</p>
                      </div>
                      <span
                        className={`${s.badge} ${row.status === 'delivered' ? s.success : row.status === 'cancelled' ? s.bad : ''}`}
                      >
                        {status(row)}
                      </span>
                    </div>
                    <div className={s.routeStops}>
                      <div>
                        <MapPin size={15} aria-hidden />
                        <span>
                          <small>From</small>
                          {row.pickup_address?.split(',')[0] ?? '—'}
                        </span>
                      </div>
                      <div>
                        <MapPin size={15} aria-hidden />
                        <span>
                          <small>To</small>
                          {row.delivery_address?.split(',')[0] ?? '—'}
                        </span>
                      </div>
                    </div>
                    <div className={s.cardActions}>
                      <Link className={s.primary} href={track(row)}>
                        {history ? 'View delivery' : 'Track order'}
                        <ArrowRight size={15} aria-hidden />
                      </Link>
                      <button
                        className={s.secondary}
                        aria-label={`Order details for ${label(row)}`}
                        onClick={() => setOrderDetails(row)}
                      >
                        <Ellipsis size={18} />
                      </button>
                      {history && row.delivered_image_url && (
                        <button
                          className={s.secondary}
                          aria-label="View delivery photo"
                          onClick={() => setProof(row)}
                        >
                          <FileImage size={18} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          <CustomerPagination
            page={current}
            count={count}
            size={size}
            onChange={setPage}
          />
        </div>
        {focus && !loading && (
          <aside className={`${s.panel} ${s.routePanel} ${s.desktopOnly}`}>
            <h2>{history ? 'Shipment details' : 'Current delivery route'}</h2>
            <p>{label(focus)}</p>
            <div
              className={s.routeVisual}
              aria-label="Collection and delivery route illustration"
            >
              {focus.pickup_address && focus.delivery_address ? (
                <iframe
                  title="Collection and delivery route map"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?saddr=${encodeURIComponent(focus.pickup_address)}&daddr=${encodeURIComponent(focus.delivery_address)}&output=embed`}
                />
              ) : (
                <svg viewBox="0 0 220 100" fill="none" aria-hidden>
                  <path
                    d="M20 75h70c30 0 12-50 42-50h65"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray="8 5"
                  />
                  <circle cx="20" cy="75" r="9" fill="currentColor" />
                  <circle cx="197" cy="25" r="9" fill="currentColor" />
                </svg>
              )}
            </div>
            <div className={s.routeStops}>
              <div>
                <Box size={17} />
                <span>
                  <small>Pickup</small>
                  {focus.pickup_address}
                </span>
              </div>
              <div>
                <MapPin size={17} />
                <span>
                  <small>Delivery</small>
                  {focus.delivery_address}
                </span>
              </div>
            </div>
            <div className={s.driver}>
              <span className={s.avatar}>
                <Truck size={21} />
              </span>
              <div>
                <h3>
                  {focus.driver_id
                    ? (names[focus.driver_id] ?? 'Your driver')
                    : 'Finding your driver'}
                </h3>
                <small>
                  {status(focus)} · {money(totalPaid(focus))}
                </small>
              </div>
            </div>
            <Link className={s.primary} href={track(focus)}>
              {history ? 'View delivery' : 'Live tracking'}
              <ArrowRight size={16} />
            </Link>
            <button
              className={s.textButton}
              onClick={() => setOrderDetails(focus)}
            >
              Order details
            </button>
            {history && focus.delivered_image_url && (
              <button className={s.secondary} onClick={() => setProof(focus)}>
                View delivery photo
              </button>
            )}
          </aside>
        )}
      </div>
      {liveDetails && (
        <CustomerDialog
          title="Order details"
          onClose={() => setOrderDetails(null)}
        >
          <p>
            <strong>{label(liveDetails)}</strong>
          </p>
          <p style={{ marginTop: 12 }}>{liveDetails.item_description}</p>
          <div className={s.routeStops}>
            <div>
              <MapPin size={17} />
              <span>
                <small>Pickup</small>
                {liveDetails.pickup_address}
              </span>
            </div>
            <div>
              <MapPin size={17} />
              <span>
                <small>Delivery</small>
                {liveDetails.delivery_address}
              </span>
            </div>
          </div>
          <p style={{ marginBottom: 16 }}>
            {money(totalPaid(liveDetails))} original booking charge · {status(liveDetails)}
          </p>
          {liveDetails.service_type === 'buy_for_me' && <Link className={s.primary} href={track(liveDetails)}>Shopping items, approvals and receipt</Link>}
          {detailsError&&<p role="alert" className={s.error}>{detailsError} <button className={s.textButton} onClick={()=>setRevision(v=>v+1)}>Retry order details</button></p>}
          {detailsLoading&&<p role="status">Refreshing order…</p>}
          {!history && !detailsLoading && !detailsError && (
            <CancelOrderButton
              deliveryId={liveDetails.id}
              currentStatus={liveDetails.status ?? 'requested'}
              onCancelled={() => {
                setOrderDetails(null)
                setRevision((r) => r + 1)
              }}
            />
          )}
        </CustomerDialog>
      )}
      {proof && (
        <CustomerDialog
          title="Delivery confirmation"
          onClose={() => setProof(null)}
        >
          <p>{label(proof)}</p>
          {/* Existing customer-owned proof URL; retain its natural image ratio. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/delivery-proof?id=${encodeURIComponent(proof.id)}&kind=delivery`}
            alt="Photo confirming delivery"
            style={{ width: '100%', borderRadius: 12, marginTop: 16 }}
          />
        </CustomerDialog>
      )}
    </CustomerPage>
  )
}
