"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateDeliveryStatus } from "@/app/actions/delivery"
import { ParcelAuthModal } from "./parcel-auth-modal"
import { SafetyCancelButton } from "./safety-cancel-button"
import { DeliveryOtpModal } from "./delivery-otp-modal"
import { RateCustomerCard } from "./rate-customer-card"
import { BfmShoppingWorkflow } from "./bfm-shopping-workflow"

const LiveTrackingPanel = dynamic(
  () => import("@/components/tracking/live-tracking-panel").then((m) => m.LiveTrackingPanel),
  { ssr: false }
)
const DriverLocationBroadcaster = dynamic(
  () => import("@/components/tracking/driver-location-broadcaster").then((m) => m.DriverLocationBroadcaster),
  { ssr: false }
)

const STATUS_STEPS = ["accepted", "collected", "in_transit", "delivered"]
const STATUS_LABELS: Record<string, string> = {
  accepted: "Heading to Pickup",
  collected: "Parcel Collected",
  in_transit: "En Route",
  delivered: "Delivered",
}
const STATUS_ICONS: Record<string, string> = {
  accepted: "local_shipping",
  collected: "inventory_2",
  in_transit: "directions_car",
  delivered: "check_circle",
}

type Job = {
  id: string
  status: string
  tracking_number: string | null
  pickup_address: string | null
  delivery_address: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_lat: number | null
  delivery_lng: number | null
  item_description: string | null
  item_photo_urls: string[] | null
  price: number | null
  parcel_image_url: string | null
  delivered_image_url: string | null
  customer_id: string | null
  service_type?: string | null
  bfm_stage?: string | null
  shop_name?: string | null
  shop_address?: string | null
  max_spend_approved?: number | null
  actual_items_total?: number | null
  estimated_items_total?: number | null
  receipt_url?: string | null
}

type Customer = { full_name: string | null; phone: string | null; email: string | null } | null

type TimelineStep = { label: string; status: "completed" | "active" | "upcoming"; time?: string }

type Props = {
  job: Job
  customer: Customer
  timelineSteps: TimelineStep[]
  userId: string
}

export function DriverJobView({ job, customer, timelineSteps, userId }: Props) {
  const [showParcelAuth, setShowParcelAuth] = useState(false)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const ACTIVE_STATUSES = ["accepted", "collected", "in_transit", "picked_up"]
  const isActive = ACTIVE_STATUSES.includes(job.status)
  const isDone = job.status === "delivered" || job.status === "cancelled"

  const pickup = job.pickup_lat != null && job.pickup_lng != null
    ? { lat: Number(job.pickup_lat), lng: Number(job.pickup_lng) }
    : null
  const destination = job.delivery_lat != null && job.delivery_lng != null
    ? { lat: Number(job.delivery_lat), lng: Number(job.delivery_lng) }
    : null

  const stepIndex = STATUS_STEPS.indexOf(job.status)

  function advanceStatus(nextStatus: string) {
    startTransition(async () => {
      const result = await updateDeliveryStatus(job.id, nextStatus)
      if (result?.error) { toast.error(result.error); return }
      toast.success("Status updated.")
      router.refresh()
    })
  }

  function handleDeliveryConfirmed() {
    setShowOtpModal(false)
    toast.success("Delivery complete! Great work.")
    router.push("/dashboard/driver/jobs/completed")
  }

  function customerInitials() {
    const n = customer?.full_name?.trim()
    if (!n) return "?"
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  if (job.service_type === "buy_for_me") {
    return (
      <BfmShoppingWorkflow
        job={{
          id: job.id,
          status: job.status,
          tracking_number: job.tracking_number,
          delivery_address: job.delivery_address,
          price: job.price,
          customer_id: job.customer_id,
          bfm_stage: job.bfm_stage ?? null,
          shop_name: job.shop_name ?? null,
          shop_address: job.shop_address ?? null,
          max_spend_approved: job.max_spend_approved ?? null,
          actual_items_total: job.actual_items_total ?? null,
          estimated_items_total: job.estimated_items_total ?? null,
          receipt_url: job.receipt_url ?? null,
        }}
        userId={userId}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[var(--brand-bg)] pb-[12rem] lg:pb-28">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-[var(--brand-bg)]/95 backdrop-blur-sm border-b border-[var(--color-outline-variant)]/15 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard/driver/active-jobs" className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)] hover:text-white transition-colors text-sm font-bold">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{job.tracking_number ?? `Job #${job.id.slice(0, 8).toUpperCase()}`}</p>
          <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase tracking-wider">{STATUS_LABELS[job.status] ?? job.status}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          job.status === "delivered" ? "bg-[#6ee7b7]/10 text-[#6ee7b7] border-[#6ee7b7]/20" :
          job.status === "in_transit" ? "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border-[var(--brand-strong)]/20" :
          job.status === "collected" ? "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/20" :
          "bg-amber-400/10 text-amber-400 border-amber-400/20"
        }`}>
          {STATUS_LABELS[job.status] ?? job.status}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Progress Steps */}
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((s, i) => {
              const done = i < stepIndex
              const active = i === stepIndex
              return (
                <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative">
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`absolute top-4 left-1/2 w-full h-px ${done ? "bg-[var(--brand-strong)]" : "bg-[var(--color-outline-variant)]/30"}`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 transition-all ${
                    done ? "bg-[var(--brand-strong)] border-[var(--brand-strong)]" :
                    active ? "bg-[var(--brand-panel)] border-[var(--brand-strong)] shadow-[0_0_12px_rgba(var(--brand-rgb),0.4)]" :
                    "bg-[var(--brand-panel)] border-[var(--color-outline-variant)]/30"
                  }`}>
                    {done ? (
                      <span className="material-symbols-outlined text-white text-sm">check</span>
                    ) : (
                      <span className={`material-symbols-outlined text-sm ${active ? "text-[var(--brand-soft)]" : "text-[var(--color-outline-variant)]"}`}>
                        {STATUS_ICONS[s]}
                      </span>
                    )}
                  </div>
                  <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${active ? "text-[var(--brand-soft)]" : done ? "text-[var(--color-on-surface-variant)]" : "text-[var(--color-outline-variant)]"}`}>
                    {STATUS_LABELS[s]}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Map */}
        {isActive && (
          <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-outline-variant)]/15">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[11px] font-bold text-white uppercase tracking-wider">Live Navigation</p>
              </div>
              <DriverLocationBroadcaster deliveryId={job.id} />
            </div>
            <LiveTrackingPanel
              driverId={userId}
              pickup={pickup}
              destination={destination}
              customerId={job.customer_id ?? null}
              deliveryId={job.id}
              driverLabel="You"
              followDriver
              isDriverView
              height={300}
            />
          </div>
        )}

        {/* Route Card */}
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
          <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Delivery Route</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1 shrink-0">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--brand-strong)] bg-[var(--brand-bg)]" />
              <div className="w-px flex-1 min-h-[32px] border-l border-dashed border-[var(--color-outline-variant)] my-1" />
              <div className="w-3 h-3 rounded-full bg-[var(--color-secondary)]" />
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <div>
                <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold mb-1">Pickup</p>
                <p className="text-sm font-semibold text-white leading-snug">{job.pickup_address || "—"}</p>
                {pickup && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${pickup.lat},${pickup.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-[var(--brand-soft)] hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">navigation</span>
                    Navigate
                  </a>
                )}
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold mb-1">Destination</p>
                <p className="text-sm font-semibold text-white leading-snug">{job.delivery_address || "—"}</p>
                {destination && job.status !== "accepted" && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-[var(--color-secondary)] hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">navigation</span>
                    Navigate
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Parcel photo (if already taken) */}
        {job.parcel_image_url && (
          <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[#6ee7b7]/15 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#6ee7b7]/10">
              <span className="material-symbols-outlined text-[#6ee7b7] text-base">verified</span>
              <p className="text-[11px] font-bold text-[#6ee7b7] uppercase tracking-wider">Parcel Authenticated</p>
            </div>
            <img src={`/api/delivery-proof?id=${encodeURIComponent(job.id)}&kind=pickup`} alt="Parcel" className="w-full object-cover" style={{ maxHeight: 200 }} />
          </div>
        )}

        {/* Delivered photo (if already taken) */}
        {job.delivered_image_url && (
          <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[#6ee7b7]/15 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#6ee7b7]/10">
              <span className="material-symbols-outlined text-[#6ee7b7] text-base">verified</span>
              <p className="text-[11px] font-bold text-[#6ee7b7] uppercase tracking-wider">Proof of Delivery</p>
            </div>
            <img src={`/api/delivery-proof?id=${encodeURIComponent(job.id)}&kind=delivery`} alt="Delivered package" className="w-full object-cover" style={{ maxHeight: 200 }} />
          </div>
        )}

        {/* Package Info */}
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
          <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-3">Package Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className="text-[10px] text-[var(--color-outline-variant)] uppercase mb-0.5">Description</p>
              <p className="text-sm font-semibold text-white whitespace-pre-wrap">{job.item_description || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-outline-variant)] uppercase mb-0.5">Payout</p>
              <p className="text-sm font-black text-[#6ee7b7]">
                {job.price != null ? `£${Number(job.price).toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
          {job.item_photo_urls && job.item_photo_urls.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-outline-variant)]/10">
              <p className="text-[10px] text-[var(--color-outline-variant)] uppercase mb-2">Customer's Photos</p>
              <div className="flex flex-wrap gap-2">
                {job.item_photo_urls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/20 shrink-0">
                    <img src={url} alt="Item" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
          <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-3">Customer</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[var(--brand-soft)]">{customerInitials()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{customer?.full_name || "Customer"}</p>
              <p className="text-[11px] text-[var(--color-on-surface-variant)] truncate">{customer?.email || "—"}</p>
            </div>
            {customer?.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 text-[var(--brand-soft)] text-xs font-bold hover:bg-[var(--brand-strong)]/20 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">call</span>
                Call
              </a>
            )}
          </div>
        </div>

        {/* Rate the customer — only once delivered */}
        {job.status === "delivered" && <RateCustomerCard deliveryId={job.id} />}

        {/* Delivery Timeline */}
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
          <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Progress Timeline</p>
          <div className="relative space-y-6">
            <div className="absolute left-3 top-1 bottom-1 w-px border-l border-dashed border-[var(--color-outline-variant)]/40" />
            {timelineSteps.map((step, i) => (
              <div key={i} className={`relative flex items-start gap-4 ${step.status === "upcoming" ? "opacity-35" : ""}`}>
                <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${
                  step.status === "completed" ? "bg-[var(--brand-strong)] border-[var(--brand-strong)]" :
                  step.status === "active" ? "bg-[var(--brand-panel)] border-[var(--brand-strong)] shadow-[0_0_10px_rgba(var(--brand-rgb),0.5)]" :
                  "bg-[var(--brand-panel)] border-[var(--color-outline-variant)]/40"
                }`}>
                  {step.status === "completed" && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                  {step.status === "active" && <div className="w-2 h-2 rounded-full bg-[var(--brand-strong)]" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold ${step.status === "active" ? "text-[var(--brand-soft)]" : "text-white"}`}>{step.label}</p>
                    {step.time && <p className="text-[10px] text-[var(--color-outline-variant)]">{step.time}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Fixed action bar */}
      {!isDone && (
        <div
          className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-40 bg-[var(--brand-bg)]/95 backdrop-blur-sm border-t border-[var(--color-outline-variant)]/15 px-4 pt-3 lg:pl-[272px]"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-2xl mx-auto space-y-2">

            {/* Primary CTA — full width */}
            {job.status === "accepted" && (
              <button
                onClick={() => setShowParcelAuth(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-black text-sm hover:brightness-110 transition-all active:scale-[0.98]"
                style={{ boxShadow: "0 0 20px rgba(var(--brand-rgb),0.25)" }}
              >
                <span className="material-symbols-outlined text-base">verified_user</span>
                Authenticate Parcel
              </button>
            )}
            {job.status === "collected" && (
              <button
                onClick={() => advanceStatus("in_transit")}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[var(--color-secondary)] text-[var(--brand-bg)] font-black text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ boxShadow: "0 0 20px rgba(var(--brand-rgb),0.25)" }}
              >
                <span className="material-symbols-outlined text-base">directions_car</span>
                {isPending ? "Updating…" : "Start Delivery"}
              </button>
            )}
            {job.status === "in_transit" && (
              <button
                onClick={() => setShowOtpModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#6ee7b7] text-[var(--brand-bg)] font-black text-sm hover:brightness-110 transition-all active:scale-[0.98]"
                style={{ boxShadow: "0 0 20px rgba(110,231,183,0.25)" }}
              >
                <span className="material-symbols-outlined text-base">password</span>
                Mark as Delivered
              </button>
            )}

            {/* Safety cancel — slim secondary row */}
            <SafetyCancelButton jobId={job.id} />

          </div>
        </div>
      )}

      {showParcelAuth && (
        <ParcelAuthModal deliveryId={job.id} onClose={() => setShowParcelAuth(false)} />
      )}
      {showOtpModal && (
        <DeliveryOtpModal
          deliveryId={job.id}
          onClose={() => setShowOtpModal(false)}
          onSuccess={handleDeliveryConfirmed}
        />
      )}
    </div>
  )
}

