"use client"
import { orderMediaUrl } from '@/lib/order-media'

import { reportShoppingProblem, enableApprovedPurchase } from "@/app/actions/shopping-operations"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  updateBfmStage,
  markItemFound,
  markItemUnavailable,
  requestSubstitution,
  submitPurchaseReceipt,
  getShoppingWorkflowSnapshot,
  type BfmStage,
  type ShoppingItemRow,
} from "@/app/actions/shopping"
import { DeliveryOtpModal } from "./delivery-otp-modal"

type BfmJob = {
  shop_instructions?:string|null
  delivery_instructions?:string|null
  id: string
  status: string
  bfm_stage: string | null
  shop_name: string | null
  shop_address: string | null
  delivery_address: string | null
  max_spend_approved: number | null
  actual_items_total: number | null
  estimated_items_total: number | null
  receipt_url: string | null
  customer_id: string | null
  tracking_number: string | null
  price: number | null
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v)
}

const BFM_STAGES: { stage: string; label: string; icon: string }[] = [
  { stage: "accepted",           label: "Accepted",              icon: "check_circle" },
  { stage: "heading_to_shop",    label: "Heading to Shop",       icon: "directions_car" },
  { stage: "arrived_at_shop",    label: "Arrived at Shop",       icon: "storefront" },
  { stage: "shopping",           label: "Shopping",              icon: "shopping_cart" },
  { stage: "purchase_completed", label: "Purchase Completed",    icon: "receipt_long" },
  { stage: "heading_to_customer",label: "Heading to Customer",   icon: "local_shipping" },
  { stage: "delivered",          label: "Delivered",             icon: "verified" },
]

const NEXT_STAGE: Record<string, BfmStage | null> = {
  accepted: "heading_to_shop",
  heading_to_shop: "arrived_at_shop",
  arrived_at_shop: "shopping",
  shopping: "purchase_completed",
  purchase_completed: "heading_to_customer",
  heading_to_customer: null,
}

const NEXT_STAGE_LABEL: Record<string, string> = {
  accepted: "Start Journey to Shop",
  heading_to_shop: "Mark Arrived at Shop",
  arrived_at_shop: "Start Shopping",
  shopping: "Submit Receipt & Complete Purchase",
  purchase_completed: "Start Delivery",
  heading_to_customer: "Deliver to Customer",
}

export function BfmShoppingWorkflow({ job, userId }: { job: BfmJob; userId: string }) {
  const [shelfPrices,setShelfPrices]=useState<Record<string,string>>({})
  const [problem, setProblem] = useState("")
  const [items, setItems] = useState<ShoppingItemRow[]>([])
  const [decisions,setDecisions] = useState<{id:string;shopping_item_id:string;suggested_name:string;suggested_price:number;customer_approved:boolean|null}[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [showSubForm, setShowSubForm] = useState<string | null>(null) // item id
  const [subSuggested, setSubSuggested] = useState("")
  const [subPrice, setSubPrice] = useState("")
  const [subNotes, setSubNotes] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")
  const [actualTotal, setActualTotal] = useState("")
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const router = useRouter()

  const currentStage = job.bfm_stage ?? job.status

  useEffect(() => {
    let active = true, pending = false
    const refresh = async () => {
      if (pending || document.hidden) return
      pending = true
      try { const result = await getShoppingWorkflowSnapshot(job.id); if (active && !result.error) { setItems(result.items); setDecisions(result.decisions) } }
      finally { pending = false; if (active) setLoadingItems(false) }
    }
    void refresh().catch(()=>{})
    const visible = () => { void refresh().catch(()=>{}) }
    const timer = setInterval(visible,10000)
    window.addEventListener('focus',visible)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus',visible) }
  }, [job.id])

  const stageIndex = BFM_STAGES.findIndex((s) => s.stage === currentStage)

  function handleStageAdvance() {
    if (isPending) return
    if (currentStage === "heading_to_customer") {
      setShowOtpModal(true)
      return
    }
    const next = NEXT_STAGE[currentStage]
    if (!next) return

    if (next === "purchase_completed") {
      // Need receipt first
      setShowReceiptForm(true)
      return
    }

    startTransition(async () => {
      const result = await updateBfmStage(job.id, next)
      if (result.error) { toast.error(result.error); return }
      toast.success(`Status updated: ${NEXT_STAGE_LABEL[next] ?? next}`)
      router.refresh()
    })
  }

  async function handleReceiptSubmit() {
    if (!receiptUrl) { toast.error("Please upload the receipt first."); return }
    const actual = parseFloat(actualTotal)
    if (isNaN(actual) || actual < 0) { toast.error("Enter a valid total amount."); return }

    startTransition(async () => {
      const result = await submitPurchaseReceipt({
        deliveryId: job.id,
        receipt_url: receiptUrl,
        actual_items_total: actual,
      })
      if (result.error) { toast.error(result.error); return }
      toast.success("Receipt submitted.")
      setShowReceiptForm(false)
      router.refresh()
    })
  }

  async function handleReceiptUpload(file: File) {
    setUploadingReceipt(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error("Please sign in again."); setUploadingReceipt(false); return }
    const path = `${user.id}/receipts/${job.id}/${Date.now()}-receipt.jpg`
    const { error } = await supabase.storage.from("delivery-item-photos").upload(path, file, { upsert: true })
    if (error) { toast.error("Upload failed. Try again."); setUploadingReceipt(false); return }
    const { data: { publicUrl } } = supabase.storage.from("delivery-item-photos").getPublicUrl(path)
    setReceiptUrl(publicUrl)
    setUploadingReceipt(false)
    toast.success("Receipt uploaded.")
  }

  function handleMarkFound(itemId: string) {
    startTransition(async () => {
      const result = await markItemFound(itemId, Number(shelfPrices[itemId] ?? items.find(i=>i.id===itemId)?.estimated_price ?? NaN))
      if (result.error) { toast.error(result.error); return }
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: "purchased" } : i))
      toast.success("Item marked as found.")
    })
  }

  function handleMarkUnavailable(itemId: string) {
    startTransition(async () => {
      const result = await markItemUnavailable(itemId)
      if (result.error) { toast.error(result.error); return }
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: "unavailable" } : i))
      toast.success("Item marked unavailable.")
    })
  }

  async function handleSubstitution(itemId: string) {
    if (!subSuggested.trim()) { toast.error("Enter a suggested item name."); return }
    startTransition(async () => {
      const result = await requestSubstitution({
        shopping_item_id: itemId,
        delivery_id: job.id,
        suggested_name: subSuggested.trim(),
        suggested_price: Number.isFinite(parseFloat(subPrice)) ? parseFloat(subPrice) : undefined,
        driver_notes: subNotes.trim() || undefined,
      })
      if (result.error) { toast.error(result.error); return }
      toast.success("Substitution request sent to customer.")
      setShowSubForm(null)
      setSubSuggested("")
      setSubPrice("")
      setSubNotes("")
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: "substituted" } : i))
    })
  }

  const canAdvance = !["delivered", "cancelled"].includes(job.status) &&
    (currentStage === "heading_to_customer" || !!NEXT_STAGE[currentStage])
  const nextStageLabel = NEXT_STAGE_LABEL[currentStage]
  const isClosed = currentStage === "delivered" || ["delivered", "cancelled"].includes(job.status)
  const isShopping = currentStage === "shopping"

  const inputCls = "w-full bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 text-white text-sm placeholder-[var(--color-outline-variant)] outline-none focus:border-[var(--brand-strong)]/40 transition-all"

  return (
    <div className="space-y-4">
      {job.shop_instructions&&<p className="rounded bg-[var(--brand-panel)] p-3 text-sm text-white">Shop instructions: {job.shop_instructions}</p>}{job.delivery_instructions&&<p className="rounded bg-[var(--brand-panel)] p-3 text-sm text-white">Delivery access: {job.delivery_instructions}</p>}
      <div className="rounded-xl border border-amber-400/30 p-3 mb-4 text-white">
        <p className="text-sm">Use only the verified company purchase card. Never pay with personal money.</p>
        <input aria-label="Shopping problem" value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Busy shop, unavailable products, or card problem" className="my-2 w-full rounded bg-black/20 p-2" />
        <button disabled={!problem.trim()||isPending} onClick={()=>startTransition(async()=>{const r=await reportShoppingProblem(job.id,problem);if(r.error)toast.error(r.error);else{toast.success('Problem reported to admin.');setProblem('')}})}>Report to admin</button>
      </div>
      {/* BFM Badge */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 rounded-xl">
        <span className="text-xl">🛍️</span>
        <div>
          <p className="text-sm font-bold text-[var(--color-secondary)]">Buy for Me Order</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            Max spend: {fmt(job.max_spend_approved ?? 50)}
            {job.actual_items_total != null && ` · Spent: ${fmt(job.actual_items_total)}`}
          </p>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-start gap-1 min-w-max">
          {BFM_STAGES.map(({ stage, label, icon }, i) => {
            const done = i < stageIndex
            const active = i === stageIndex
            return (
              <div key={stage} className="flex flex-col items-center gap-1.5 relative w-[72px]">
                {i < BFM_STAGES.length - 1 && (
                  <div className={`absolute top-4 left-1/2 w-full h-px z-0 ${done ? "bg-[var(--brand-strong)]" : "bg-[var(--color-outline-variant)]/30"}`} />
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 transition-all ${
                  done ? "bg-[var(--brand-strong)] border-[var(--brand-strong)]" :
                  active ? "bg-[var(--brand-panel)] border-[var(--color-secondary)] shadow-[0_0_12px_rgba(var(--brand-rgb),0.4)]" :
                  "bg-[var(--brand-panel)] border-[var(--color-outline-variant)]/30"
                }`}>
                  {done ? (
                    <span className="material-symbols-outlined text-white text-sm">check</span>
                  ) : (
                    <span className={`material-symbols-outlined text-sm ${active ? "text-[var(--color-secondary)]" : "text-[var(--color-outline-variant)]"}`}>
                      {icon}
                    </span>
                  )}
                </div>
                <p className={`text-[8px] font-bold text-center leading-tight ${active ? "text-[var(--color-secondary)]" : done ? "text-[var(--color-on-surface-variant)]" : "text-[var(--color-outline-variant)]"}`}>
                  {label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Shop & Delivery Info */}
      <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4 space-y-3">
        <div className="flex gap-3 items-start">
          <span className="material-symbols-outlined text-[var(--color-secondary)] text-base mt-0.5">storefront</span>
          <div>
            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">Shop</p>
            <p className="text-sm font-semibold text-white">{job.shop_name ?? "—"}</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">{job.shop_address ?? "—"}</p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <span className="material-symbols-outlined text-[var(--brand-soft)] text-base mt-0.5">location_on</span>
          <div>
            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">Deliver to</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">{job.delivery_address ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Shopping List */}
      <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">Shopping List</p>
          <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">
            {items.filter((i) => i.status === "purchased" || i.status === "substituted").length}/{items.length} found
          </span>
        </div>
        {loadingItems ? (
          <p className="text-xs text-[var(--color-on-surface-variant)]">Loading items…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-[var(--color-on-surface-variant)]">No items on this order.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const statusColor =
                item.status === "purchased" ? "text-emerald-400" :
                item.status === "substituted" ? "text-[var(--color-secondary)]" :
                item.status === "unavailable" ? "text-red-400" :
                item.status === "skipped" ? "text-[var(--color-outline-variant)]" :
                "text-amber-400"

              return (
                <div key={item.id} className="bg-[var(--brand-panel)] rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {item.quantity}× {item.name}
                      </p>
                      {item.brand_size_variant && (
                        <p className="text-xs text-[var(--color-on-surface-variant)]">{item.brand_size_variant}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-[var(--color-on-surface-variant)] italic">"{item.notes}"</p>
                      )}
                      {item.estimated_price && (
                        <p className="text-xs text-[var(--color-on-surface-variant)]">Est. {fmt(item.estimated_price)}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${statusColor}`}>
                      {item.status}
                    </span>
                  </div>

                  {decisions.filter(d=>d.shopping_item_id===item.id).map(d=><p key={d.id} className="text-sm text-white">{d.suggested_name} · {fmt(Number(d.suggested_price))} per unit · {d.customer_approved===null ? 'Awaiting customer approval' : d.customer_approved ? 'Customer approved' : 'Customer rejected'}</p>)}
                  {item.photo_url && (
                    <img src={orderMediaUrl(item.photo_url)} alt={item.name} className="w-full h-24 object-cover rounded-lg" />
                  )}

                  {isShopping && ["pending","substituted","purchased"].includes(item.status) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <label className="w-full text-xs text-white">Shelf price per unit (£)<input type="number" min="0" step="0.01" value={shelfPrices[item.id]??String(item.estimated_price??"")} onChange={e=>setShelfPrices(prev=>({...prev,[item.id]:e.target.value}))} className="ml-2 w-24 rounded bg-black/30 p-2" /></label>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMarkFound(item.id)}
                        className="flex-1 py-2 bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-lg text-xs font-bold hover:bg-emerald-400/20 transition-all disabled:opacity-50"
                      >
                        Found ✓
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMarkUnavailable(item.id)}
                        className="flex-1 py-2 bg-red-400/10 text-red-400 border border-red-400/20 rounded-lg text-xs font-bold hover:bg-red-400/20 transition-all disabled:opacity-50"
                      >
                        Unavailable
                      </button>
                      {item.substitution_preference !== "skip_if_unavailable" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {setShowSubForm(item.id);setSubSuggested(item.name);setSubPrice(shelfPrices[item.id]??String(item.estimated_price??""))}}
                          className="flex-1 py-2 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20 rounded-lg text-xs font-bold hover:bg-[var(--color-secondary)]/20 transition-all disabled:opacity-50"
                        >
                          Request price / replacement approval
                        </button>
                      )}
                    </div>
                  )}

                  {/* Substitution form */}
                  {showSubForm === item.id && (
                    <div className="bg-[var(--brand-bg)] rounded-xl p-3 space-y-2 border border-[var(--color-secondary)]/20">
                      <p className="text-[10px] font-bold text-[var(--color-secondary)] uppercase tracking-widest">Request price / replacement approval</p>
                      <input
                        type="text"
                        placeholder="Replacement item name"
                        value={subSuggested}
                        onChange={(e) => setSubSuggested(e.target.value)}
                        className={inputCls}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Unit price (£)"
                          value={subPrice}
                          onChange={(e) => setSubPrice(e.target.value)}
                          className={inputCls}
                        />
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={subNotes}
                          onChange={(e) => setSubNotes(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSubForm(null)}
                          className="flex-1 py-2 text-xs font-bold text-[var(--color-on-surface-variant)] bg-[var(--brand-panel)] rounded-lg border border-[var(--color-outline-variant)]/20"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSubstitution(item.id)}
                          className="flex-1 py-2 text-xs font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 rounded-lg border border-[var(--color-secondary)]/20 disabled:opacity-50"
                        >
                          Send Request
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Receipt section */}
      {(job.receipt_url || currentStage === "purchase_completed" || currentStage === "heading_to_customer") && (
        <div className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-4">
          <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-3">Purchase Receipt</p>
          {job.receipt_url ? (
            <div className="space-y-2">
              <img src={orderMediaUrl(job.receipt_url)} alt="Receipt" className="w-full rounded-xl object-cover max-h-48" />
              {job.actual_items_total != null && (
                <p className="text-sm text-white font-bold">Total spent: {fmt(job.actual_items_total)}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-on-surface-variant)]">No receipt uploaded yet.</p>
          )}
        </div>
      )}

      {/* Receipt upload form */}
      {showReceiptForm && (
        <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-xl p-4 space-y-4">
          <button disabled={isPending} onClick={()=>startTransition(async()=>{const r=await enableApprovedPurchase(job.id);if(r.error)toast.error(r.error);else toast.success(r.total===0?"No purchase needed. Upload evidence of unavailable items to settle the order.":`Company card enabled for £${r.total?.toFixed(2)}. You can now pay at the shop.`)})} className="w-full rounded-xl bg-[var(--brand-strong)] p-3 font-bold text-white">Enable company card for approved basket</button>
          <p className="text-xs text-white">Confirm shelf prices and customer approvals before enabling the card. Then pay using the company card and upload the receipt.</p>
          <p className="text-sm font-bold text-white">Submit Purchase Receipt</p>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1.5">Actual Total Spent (£)</label>
            <input
              type="number"
              step={0.01}
              min={0}
              max={job.max_spend_approved ?? 50}
              value={actualTotal}
              onChange={(e) => setActualTotal(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
            {job.max_spend_approved && (
              <p className="text-[10px] text-[var(--color-on-surface-variant)] mt-1">Max approved: {fmt(job.max_spend_approved)}</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-1.5">Receipt Photo</label>
            <label className={`${inputCls} flex items-center gap-2 cursor-pointer`}>
              <span className="material-symbols-outlined text-[var(--color-on-surface-variant)] text-base">add_photo_alternate</span>
              <span className="text-[var(--color-on-surface-variant)]">
                {uploadingReceipt ? "Uploading…" : receiptUrl ? "Receipt uploaded ✓" : "Upload receipt photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingReceipt}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f) }}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowReceiptForm(false)} className="flex-1 py-3 text-sm font-bold text-[var(--color-on-surface-variant)] bg-[var(--brand-bg)] rounded-xl border border-[var(--color-outline-variant)]/20">
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || uploadingReceipt || !receiptUrl || !actualTotal}
              onClick={handleReceiptSubmit}
              className="flex-1 py-3 text-sm font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 rounded-xl border border-[var(--color-secondary)]/20 disabled:opacity-50"
            >
              {isPending ? "Submitting…" : "Submit Receipt"}
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isClosed && !showReceiptForm && (
        <button
          type="button"
          disabled={isPending || !canAdvance}
          onClick={handleStageAdvance}
          className="w-full py-4 bg-[var(--color-secondary)] text-[var(--color-on-secondary)] font-black rounded-xl text-sm hover:brightness-110 transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {isPending ? "Updating…" : nextStageLabel ?? "Next Step"}
        </button>
      )}

      {/* OTP Modal for final delivery */}
      {showOtpModal && (
        <DeliveryOtpModal
          deliveryId={job.id}
          onSuccess={() => {
            setShowOtpModal(false)
            toast.success("Delivery complete! Great work.")
            router.push("/dashboard/driver/jobs/completed")
          }}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </div>
  )
}

