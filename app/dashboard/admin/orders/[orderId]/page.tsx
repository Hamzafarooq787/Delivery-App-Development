import { orderMediaUrl } from '@/lib/order-media'
import {ShoppingItemsHistory} from "@/components/admin/shopping-items-history"
import { OrderPaymentPanel } from "@/components/admin/order-payment-panel"
import { ShoppingFundingPanel } from "@/components/admin/shopping-funding-panel"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { ResetDeliveryOtpButton } from "@/components/admin/reset-delivery-otp-button"
import { getDeliveryRatings } from "@/app/actions/ratings"
import { LiveTrackingPanel } from "@/components/tracking/live-tracking-panel"
import { OrderActionsPanel } from "@/components/admin/order-actions-panel"

const OTP_RESETTABLE_STATUSES = ["accepted", "collected", "in_transit"]
const LIVE_TRACKING_STATUSES = ["accepted", "collected", "in_transit", "picked_up"]
const STATUS_ORDER = ["requested", "accepted", "collected", "in_transit", "delivered"]

const STATUS_COLORS: Record<string, string> = {
  requested:  "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)]",
  accepted:   "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]",
  collected:  "bg-blue-500/10 text-blue-400",
  in_transit: "bg-amber-500/10 text-amber-400",
  delivered:  "bg-emerald-500/10 text-emerald-400",
  cancelled:  "bg-red-500/10 text-red-400",
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const admin = createAdminClient()

  const { data: order, error } = await admin
    .from("delivery_requests")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error || !order) notFound()

  const [customerRes, driverRes, logsRes, ratingsRes, driversRes] = await Promise.all([
    order.customer_id
      ? admin.from("users").select("full_name, email, phone").eq("id", order.customer_id).single()
      : Promise.resolve({ data: null }),
    order.driver_id
      ? admin.from("users").select("full_name, email").eq("id", order.driver_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from("delivery_status_logs")
      .select("status, created_at")
      .eq("delivery_id", orderId)
      .order("created_at", { ascending: true }),
    getDeliveryRatings(orderId),
    admin
      .from("users")
      .select("id, full_name")
      .eq("role", "driver")
      .order("full_name", { ascending: true }),
  ])

  const customer = customerRes.data
  const driver = driverRes.data
  const logs: { status: string; created_at: string }[] = logsRes.data ?? []
  const ratings = ratingsRes.data
  const drivers = (driversRes.data ?? []) as { id: string; full_name: string }[]
  const customerRating = ratings.find((r) => r.rater_role === "customer")
  const driverRating   = ratings.find((r) => r.rater_role === "driver")

  const {data:cardPayment}=await admin.from('payments').select('amount,status,refund_jobs').eq('delivery_id',orderId).eq('payment_method','stripe').maybeSingle()
  const currentIdx = STATUS_ORDER.indexOf(order.status)

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link
          href="/dashboard/admin/orders"
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 hover:bg-[var(--color-surface-container-highest)] transition-colors"
        >
          <span className="material-symbols-outlined text-[var(--color-on-surface-variant)] text-sm">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-white">
            {order.tracking_number ?? `Order #${orderId.slice(0, 8)}`}
          </h2>
          <p className="text-[var(--color-on-surface-variant)] mt-0.5 text-sm">Full order details and status history.</p>
        </div>
        <div className="ml-auto">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize ${STATUS_COLORS[order.status] ?? "bg-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)]"}`}>
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        {/* Main column */}
        <div className="lg:col-span-8 space-y-5">

          {/* Package Details */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">inventory_2</span>
              <h3 className="text-base font-bold text-white font-headline">Package Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Item Description</p>
                <p className="text-white font-medium">{order.item_description ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Declared Value</p>
                <p className="text-white font-medium">
                  {order.item_value != null ? `£${Number(order.item_value).toFixed(2)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Price</p>
                <p className="text-white font-medium">
                  {order.price != null ? `£${Number(order.price).toFixed(2)}` : "—"}
                </p>
                {(order.surge_multiplier > 1 || order.discount_amount > 0) && (
                  <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">
                    Base £{Number(order.base_price ?? order.price).toFixed(2)}
                    {order.surge_multiplier > 1 && ` × ${order.surge_multiplier} surge`}
                    {order.discount_amount > 0 && ` − £${Number(order.discount_amount).toFixed(2)} discount`}
                    {order.promo_code && ` (${order.promo_code})`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Tracking Number</p>
                <p className="text-white font-mono text-xs">{order.tracking_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Safe Item Confirmed</p>
                <p className="text-white font-medium">{order.is_safe_confirmed ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Created At</p>
                <p className="text-white font-medium">
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              {order.item_photo_urls && order.item_photo_urls.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">Item Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {order.item_photo_urls.map((url: string) => (
                      <a key={url} href={orderMediaUrl(url)} target="_blank" rel="noreferrer"
                        className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/20 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={orderMediaUrl(url)} alt="Item" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(order.parcel_image_url || order.delivered_image_url) && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">Proof Photos</p>
                  <div className="flex flex-wrap gap-3">
                    {order.parcel_image_url && (
                      <a href={`/api/delivery-proof?id=${encodeURIComponent(order.id)}&kind=pickup`} target="_blank" rel="noreferrer">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/delivery-proof?id=${encodeURIComponent(order.id)}&kind=pickup`} alt="Parcel at pickup" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)] mt-1 text-center">Pickup</p>
                      </a>
                    )}
                    {order.delivered_image_url && (
                      <a href={`/api/delivery-proof?id=${encodeURIComponent(order.id)}&kind=delivery`} target="_blank" rel="noreferrer">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/delivery-proof?id=${encodeURIComponent(order.id)}&kind=delivery`} alt="Delivered package" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)] mt-1 text-center">Delivery</p>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {order.service_type === "buy_for_me" && <ShoppingItemsHistory orderId={orderId} />}
          {order.collection_wait&&<section className="rounded-xl border border-white/15 bg-[var(--brand-panel)] p-4 text-white"><h3 className="font-bold">Collection waiting request</h3><p>Status: {order.collection_wait.status}</p>{order.collection_wait.amount!=null&&<p>Requested £{Number(order.collection_wait.amount).toFixed(2)} at £{Number(order.collection_wait.rate).toFixed(2)} per minute after 5 free minutes.</p>}<p className="text-sm">Customer approval records consent for review. This feature has not taken a payment or changed driver earnings.</p></section>}
          {cardPayment && <OrderPaymentPanel id={orderId} amount={cardPayment.amount} status={cardPayment.status} refunds={cardPayment.refund_jobs??[]} />}
      {order.service_type === "buy_for_me" && <ShoppingFundingPanel id={order.id} reference={order.company_card_reference} verified={!!order.company_card_verified_at} problem={order.shopping_problem} started={order.shopping_started_at} completed={order.purchase_confirmed_at} />}
          {/* Buy for Me Details */}
          {order.service_type === "buy_for_me" && (
            <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-secondary)]/15 rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-lg">shopping_bag</span>
                <h3 className="text-base font-bold text-white font-headline">Buy for Me Details</h3>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20">
                  BUY FOR ME
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {order.shop_name && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Shop</p>
                    <p className="text-white font-medium">{order.shop_name}</p>
                  </div>
                )}
                {order.shop_address && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Shop Address</p>
                    <p className="text-white font-medium">{order.shop_address}</p>
                  </div>
                )}
                {order.bfm_stage && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Shopping Stage</p>
                    <p className="text-white font-medium capitalize">{String(order.bfm_stage).replace(/_/g, " ")}</p>
                  </div>
                )}
                {order.max_spend_approved != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Max Spend Approved</p>
                    <p className="text-white font-medium">£{Number(order.max_spend_approved).toFixed(2)}</p>
                  </div>
                )}
                {order.estimated_items_total != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Estimated Items Total</p>
                    <p className="text-white font-medium">£{Number(order.estimated_items_total).toFixed(2)}</p>
                  </div>
                )}
                {order.actual_items_total != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Actual Items Total</p>
                    <p className="text-[#6ee7b7] font-bold">£{Number(order.actual_items_total).toFixed(2)}</p>
                  </div>
                )}
                {order.receipt_url && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">Purchase Receipt</p>
                    <a href={orderMediaUrl(order.receipt_url)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-secondary)] hover:underline">
                      <span className="material-symbols-outlined text-sm">receipt_long</span>
                      View Receipt
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Route */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">route</span>
              <h3 className="text-base font-bold text-white font-headline">Route</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">my_location</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Pickup</p>
                  <p className="text-white text-sm">{order.pickup_address ?? "—"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-full bg-[var(--brand-strong)]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[var(--brand-soft)] text-sm">location_on</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1">Dropoff</p>
                  <p className="text-white text-sm">{order.delivery_address ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Tracking */}
          {(order.driver_id || (order.pickup_lat != null && order.delivery_lat != null)) && (
            <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-5 md:p-6 pb-4">
                <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">location_on</span>
                <h3 className="text-base font-bold text-white font-headline">Live Tracking</h3>
              </div>
              <LiveTrackingPanel
                driverId={LIVE_TRACKING_STATUSES.includes(order.status) ? (order.driver_id ?? null) : null}
                pickup={
                  order.pickup_lat != null && order.pickup_lng != null
                    ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) }
                    : null
                }
                destination={
                  order.delivery_lat != null && order.delivery_lng != null
                    ? { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) }
                    : null
                }
                customerId={null}
                deliveryId={order.id}
                driverLabel={driver?.full_name ?? "Driver"}
                height={380}
                followDriver={false}
                matchDeliveryId
                showViewerLocation={false}
              />
            </div>
          )}

          {/* Order Timeline */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">timeline</span>
              <h3 className="text-base font-bold text-white font-headline">Order Timeline</h3>
            </div>
            <div className="relative pl-6">
              {STATUS_ORDER.map((s, idx) => {
                const log = logs.find((l) => l.status === s)
                const isDone    = idx < currentIdx
                const isActive  = idx === currentIdx
                const isUpcoming = idx > currentIdx
                return (
                  <div key={s} className="relative mb-6 last:mb-0">
                    {idx < STATUS_ORDER.length - 1 && (
                      <div className={`absolute left-[-17px] top-6 w-0.5 h-full ${isDone ? "bg-[var(--brand-strong)]/40" : "bg-[var(--color-outline-variant)]/20"}`} />
                    )}
                    <div className={`absolute left-[-22px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center
                      ${isDone    ? "border-[var(--brand-strong)] bg-[var(--brand-strong)]" :
                        isActive  ? "border-[var(--brand-strong)] bg-[var(--brand-bg)]" :
                                    "border-[var(--color-outline-variant)]/30 bg-[var(--brand-bg)]"}`}>
                      {isDone && <span className="material-symbols-outlined text-white" style={{ fontSize: 9 }}>check</span>}
                      {isActive && <div className="w-2 h-2 rounded-full bg-[var(--brand-strong)]" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold capitalize ${isUpcoming ? "text-[var(--color-outline-variant)]" : "text-white"}`}>
                        {s.replace(/_/g, " ")}
                      </p>
                      {log && (
                        <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-0.5">
                          {new Date(log.created_at).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">

          {/* Customer */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">person</span>
              <h3 className="text-sm font-bold text-white font-headline">Customer</h3>
            </div>
            {customer ? (
              <div className="space-y-1">
                <p className="text-white font-semibold text-sm">{customer.full_name}</p>
                <p className="text-[var(--color-on-surface-variant)] text-xs">{customer.email}</p>
                {customer.phone && <p className="text-[var(--color-on-surface-variant)] text-xs">{customer.phone}</p>}
                <Link
                  href={`/dashboard/admin/customers/${order.customer_id}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--brand-soft)] hover:underline mt-2"
                >
                  View profile
                  <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <p className="text-[var(--color-on-surface-variant)] text-sm">—</p>
            )}
          </div>

          {/* Assigned Driver */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">directions_car</span>
              <h3 className="text-sm font-bold text-white font-headline">Assigned Driver</h3>
            </div>
            {driver ? (
              <div className="space-y-1">
                <p className="text-white font-semibold text-sm">{driver.full_name}</p>
                <p className="text-[var(--color-on-surface-variant)] text-xs">{driver.email}</p>
                <Link
                  href={`/dashboard/admin/drivers/${order.driver_id}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--brand-soft)] hover:underline mt-2"
                >
                  View driver
                  <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <p className="text-[var(--color-on-surface-variant)] text-sm">No driver assigned</p>
            )}
          </div>

          {/* Ratings */}
          {(customerRating || driverRating) && (
            <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">star</span>
                <h3 className="text-sm font-bold text-white font-headline">Ratings</h3>
              </div>
              <div className="space-y-4">
                {customerRating && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">Customer → Driver</p>
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className="material-symbols-outlined text-sm"
                          style={{ color: n <= customerRating.score ? "#facc15" : "var(--color-outline-variant)" }}>
                          star
                        </span>
                      ))}
                    </div>
                    {customerRating.comment && (
                      <p className="text-xs text-[var(--color-on-surface-variant)]">"{customerRating.comment}"</p>
                    )}
                  </div>
                )}
                {driverRating && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">Driver → Customer</p>
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className="material-symbols-outlined text-sm"
                          style={{ color: n <= driverRating.score ? "#facc15" : "var(--color-outline-variant)" }}>
                          star
                        </span>
                      ))}
                    </div>
                    {driverRating.comment && (
                      <p className="text-xs text-[var(--color-on-surface-variant)]">"{driverRating.comment}"</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Actions */}
          <div className="bg-[var(--brand-panel)]/60 backdrop-blur-xl border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-lg">admin_panel_settings</span>
              <h3 className="text-sm font-bold text-white font-headline">Admin Actions</h3>
            </div>
            <OrderActionsPanel
              orderId={order.id}
              orderStatus={order.status}
              currentDriverId={order.driver_id ?? null}
              drivers={drivers}
            />
            {OTP_RESETTABLE_STATUSES.includes(order.status) && (
              <div className="mt-2">
                <ResetDeliveryOtpButton deliveryId={order.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

