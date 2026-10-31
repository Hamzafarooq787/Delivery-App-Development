/**
 * components/admin/promotions-panel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin management for discounts/promotions and surge pricing. Four internal
 * tabs (not separate routes — this is all one cohesive settings surface):
 *   Promo Codes         — manual codes for seasonal/general promotions
 *   Automatic Discounts — first-delivery + loyalty rewards (no code needed)
 *   Surge Pricing        — master toggle + demand/traffic factor config
 *   Busy Periods         — time-based surge rules
 */
"use client"

import { useState, useTransition } from "react"
import {
  adminCreatePromoCode, adminUpdatePromoCode, adminDeletePromoCode,
  adminUpdateAutomaticDiscount,
  type PromoCode, type PromoCodeInput, type AutomaticDiscount,
} from "@/app/actions/promotions"
import {
  adminUpdateSurgeSettings, adminCreateBusyPeriodRule, adminUpdateBusyPeriodRule, adminDeleteBusyPeriodRule,
  type SurgeSettings, type BusyPeriodRuleRow, type BusyPeriodRuleInput,
} from "@/app/actions/pricing"

const INPUT = "w-full bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/40 focus:ring-1 focus:ring-[var(--brand-strong)]/20 transition-all"
const LABEL = "text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        {description && <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? "bg-[#6ee7b7]" : "bg-[var(--color-outline-variant)]/40"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}

function SaveButton({ isPending, label = "Save Changes" }: { isPending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="px-5 py-2.5 rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60 flex items-center gap-2 transition-all"
    >
      {isPending ? "Saving…" : label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Promo Codes
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_PROMO: PromoCodeInput = {
  code: "", description: "", discount_type: "percentage", discount_value: 10,
  max_discount_amount: null, min_order_value: null, usage_limit_total: null,
  usage_limit_per_user: 1, valid_from: new Date().toISOString().slice(0, 10), valid_until: null, active: true,
}

function PromoCodeModal({ initial, editingId, onClose, onSaved }: {
  initial: PromoCodeInput; editingId?: string; onClose: () => void; onSaved: (code: PromoCode) => void
}) {
  const [form, setForm] = useState<PromoCodeInput>(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof PromoCodeInput>(key: K, value: PromoCodeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = editingId ? await adminUpdatePromoCode(editingId, form) : await adminCreatePromoCode(form)
      if (result.error) { setError(result.error); return }
      onSaved({
        id: editingId ?? crypto.randomUUID(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_discount_amount: form.max_discount_amount,
        min_order_value: form.min_order_value,
        usage_limit_total: form.usage_limit_total,
        usage_limit_per_user: form.usage_limit_per_user,
        valid_from: form.valid_from,
        valid_until: form.valid_until,
        active: form.active,
        created_at: new Date().toISOString(),
      })
    })
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!isPending) onClose() }} />
      <div className="relative w-full max-w-lg bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-outline-variant)]/15 shrink-0">
          <h2 className="text-base font-bold text-white">{editingId ? "Edit Promo Code" : "New Promo Code"}</h2>
          <button onClick={onClose} className="text-[var(--color-on-surface-variant)] hover:text-white">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Code</label>
              <input className={`${INPUT} uppercase`} placeholder="SUMMER10" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Description</label>
              <input className={INPUT} placeholder="Summer promotion" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Discount Type</label>
              <div className="flex rounded-xl bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 p-1">
                {(["percentage", "fixed"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set("discount_type", t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.discount_type === t ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]" : "text-[var(--color-on-surface-variant)]"}`}>
                    {t === "percentage" ? "% Off" : "£ Off"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>{form.discount_type === "percentage" ? "Percentage" : "Amount (£)"}</label>
              <input type="number" min={0} step={0.01} className={INPUT} value={form.discount_value}
                onChange={(e) => set("discount_value", parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Max Discount (£, optional)</label>
              <input type="number" min={0} step={0.01} className={INPUT} placeholder="No cap"
                value={form.max_discount_amount ?? ""} onChange={(e) => set("max_discount_amount", e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Min Order Value (£, optional)</label>
              <input type="number" min={0} step={0.01} className={INPUT} placeholder="No minimum"
                value={form.min_order_value ?? ""} onChange={(e) => set("min_order_value", e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Total Uses (optional)</label>
              <input type="number" min={1} className={INPUT} placeholder="Unlimited"
                value={form.usage_limit_total ?? ""} onChange={(e) => set("usage_limit_total", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Uses Per Customer</label>
              <input type="number" min={1} className={INPUT} value={form.usage_limit_per_user}
                onChange={(e) => set("usage_limit_per_user", parseInt(e.target.value) || 1)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Valid From</label>
              <input type="date" className={INPUT} value={form.valid_from.slice(0, 10)} onChange={(e) => set("valid_from", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Valid Until (optional)</label>
              <input type="date" className={INPUT} value={form.valid_until?.slice(0, 10) ?? ""} onChange={(e) => set("valid_until", e.target.value || null)} />
            </div>
          </div>

          <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Active" description="Inactive codes can't be redeemed" />

          {error && <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[var(--color-outline-variant)]/15 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={isPending} className="px-5 py-2.5 rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm hover:bg-[var(--color-primary-fixed-dim)] transition-all disabled:opacity-60">
            {isPending ? "Saving…" : "Save Code"}
          </button>
        </div>
      </div>
    </div>
  )
}

function PromoCodesSection({ initial }: { initial: PromoCode[] }) {
  const [codes, setCodes] = useState(initial)
  const [modalState, setModalState] = useState<{ input: PromoCodeInput; id?: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const result = await adminDeletePromoCode(id)
      setDeletingId(null)
      if (!result.error) setCodes((prev) => prev.filter((c) => c.id !== id))
    })
  }

  function codeToInput(c: PromoCode): PromoCodeInput {
    return {
      code: c.code, description: c.description ?? "", discount_type: c.discount_type, discount_value: c.discount_value,
      max_discount_amount: c.max_discount_amount, min_order_value: c.min_order_value,
      usage_limit_total: c.usage_limit_total, usage_limit_per_user: c.usage_limit_per_user,
      valid_from: c.valid_from, valid_until: c.valid_until, active: c.active,
    }
  }

  return (
    <div>
      {modalState && (
        <PromoCodeModal
          initial={modalState.input}
          editingId={modalState.id}
          onClose={() => setModalState(null)}
          onSaved={(code) => {
            setCodes((prev) => (modalState.id ? prev.map((c) => (c.id === modalState.id ? code : c)) : [code, ...prev]))
            setModalState(null)
          }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-on-surface-variant)]">{codes.length} promo code{codes.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setModalState({ input: EMPTY_PROMO })} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-xs rounded-xl hover:bg-[var(--color-primary-fixed-dim)] transition-all">
          <span className="material-symbols-outlined text-sm">add</span>New Code
        </button>
      </div>

      {codes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--color-outline-variant)] mb-3 block">local_offer</span>
          <p className="text-sm font-semibold text-white">No promo codes yet</p>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">Create one for seasonal or general promotions.</p>
        </div>
      ) : (
        <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-[var(--brand-bg)] text-[10px] uppercase tracking-widest font-bold text-[var(--color-on-surface-variant)]">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]/10">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--color-surface-container-high)]/40">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-white font-mono">{c.code}</p>
                    {c.description && <p className="text-[10px] text-[var(--color-on-surface-variant)]">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {c.discount_type === "percentage" ? `${c.discount_value}%` : `£${c.discount_value.toFixed(2)}`}
                    {c.max_discount_amount && <span className="text-[var(--color-on-surface-variant)]"> (max £{c.max_discount_amount.toFixed(2)})</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-on-surface-variant)]">
                    {c.usage_limit_per_user}/customer{c.usage_limit_total ? ` · ${c.usage_limit_total} total` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-on-surface-variant)]">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-GB") : "No expiry"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.active ? "bg-green-500/10 text-green-400" : "bg-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)]"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setModalState({ input: codeToInput(c), id: c.id })} className="p-1.5 rounded-lg text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)]">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button onClick={() => handleDelete(c.id)} disabled={isPending && deletingId === c.id} className="p-1.5 rounded-lg text-[#ff6e84]/70 hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 disabled:opacity-40">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Automatic Discounts
// ═══════════════════════════════════════════════════════════════════════════

function AutomaticDiscountCard({ discount, title, description, icon }: {
  discount: AutomaticDiscount; title: string; description: string; icon: string
}) {
  const [form, setForm] = useState(discount)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof AutomaticDiscount>(key: K, value: AutomaticDiscount[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await adminUpdateAutomaticDiscount(form)
      if (result.error) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--brand-strong)]/10 flex items-center justify-center text-[var(--brand-soft)] shrink-0">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">{description}</p>
        </div>
      </div>

      <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Enabled" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={LABEL}>Discount Type</label>
          <div className="flex rounded-xl bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 p-1">
            {(["percentage", "fixed"] as const).map((t) => (
              <button key={t} type="button" onClick={() => set("discount_type", t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.discount_type === t ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]" : "text-[var(--color-on-surface-variant)]"}`}>
                {t === "percentage" ? "% Off" : "£ Off"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>{form.discount_type === "percentage" ? "Percentage" : "Amount (£)"}</label>
          <input type="number" min={0} step={0.01} className={INPUT} value={form.discount_value}
            onChange={(e) => set("discount_value", parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={LABEL}>Max Discount (£, optional)</label>
          <input type="number" min={0} step={0.01} className={INPUT} placeholder="No cap"
            value={form.max_discount_amount ?? ""} onChange={(e) => set("max_discount_amount", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        {form.type === "loyalty" && (
          <div className="space-y-1.5">
            <label className={LABEL}>Reward Every Nth Order</label>
            <input type="number" min={1} className={INPUT} placeholder="e.g. 5" value={form.loyalty_order_threshold ?? ""}
              onChange={(e) => set("loyalty_order_threshold", e.target.value ? parseInt(e.target.value) : null)} />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <SaveButton isPending={isPending} />
        {saved && <span className="text-xs text-green-400 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Saved</span>}
      </div>
    </div>
  )
}

function AutomaticDiscountsSection({ initial }: { initial: AutomaticDiscount[] }) {
  const firstOrder = initial.find((d) => d.type === "first_order") ?? {
    type: "first_order" as const, active: false, discount_type: "percentage" as const, discount_value: 15, max_discount_amount: 10, loyalty_order_threshold: null,
  }
  const loyalty = initial.find((d) => d.type === "loyalty") ?? {
    type: "loyalty" as const, active: false, discount_type: "percentage" as const, discount_value: 10, max_discount_amount: 10, loyalty_order_threshold: 5,
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AutomaticDiscountCard discount={firstOrder} title="First Delivery Discount" description="Applied automatically on a customer's first-ever order — no code needed." icon="celebration" />
      <AutomaticDiscountCard discount={loyalty} title="Loyalty Reward" description="Applied automatically every Nth completed delivery — no code needed." icon="loyalty" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Surge Pricing
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SURGE: SurgeSettings = {
  master_enabled: false, demand_enabled: true, demand_threshold_ratio: 1.5, demand_multiplier: 1.3,
  traffic_enabled: true, traffic_threshold_ratio: 1.4, traffic_multiplier: 1.25, max_total_multiplier: 2.0,
}

function SurgePricingSection({ initial }: { initial: SurgeSettings | null }) {
  const [form, setForm] = useState<SurgeSettings>(initial ?? DEFAULT_SURGE)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof SurgeSettings>(key: K, value: SurgeSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await adminUpdateSurgeSettings(form)
      if (result.error) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
        <Toggle
          checked={form.master_enabled}
          onChange={(v) => set("master_enabled", v)}
          label="Surge Pricing"
          description="Master switch — when off, no surge multiplier is ever applied regardless of the settings below."
        />
      </div>

      <div className={`bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5 space-y-4 transition-opacity ${!form.master_enabled ? "opacity-50" : ""}`}>
        <p className="text-sm font-bold text-white flex items-center gap-2"><span className="material-symbols-outlined text-[var(--brand-soft)] text-base">groups</span>High Demand</p>
        <Toggle checked={form.demand_enabled} onChange={(v) => set("demand_enabled", v)} label="Enabled" description="Triggers when pending orders significantly outnumber online drivers" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={LABEL}>Trigger Ratio (orders : drivers)</label>
            <input type="number" min={1} step={0.1} className={INPUT} value={form.demand_threshold_ratio} onChange={(e) => set("demand_threshold_ratio", parseFloat(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Multiplier</label>
            <input type="number" min={1} step={0.05} className={INPUT} value={form.demand_multiplier} onChange={(e) => set("demand_multiplier", parseFloat(e.target.value) || 1)} />
          </div>
        </div>
      </div>

      <div className={`bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5 space-y-4 transition-opacity ${!form.master_enabled ? "opacity-50" : ""}`}>
        <p className="text-sm font-bold text-white flex items-center gap-2"><span className="material-symbols-outlined text-[var(--brand-soft)] text-base">traffic</span>Heavy Traffic</p>
        <Toggle checked={form.traffic_enabled} onChange={(v) => set("traffic_enabled", v)} label="Enabled" description="Triggers when live traffic significantly slows the route, via Google Maps" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={LABEL}>Trigger Ratio (traffic ÷ normal)</label>
            <input type="number" min={1} step={0.1} className={INPUT} value={form.traffic_threshold_ratio} onChange={(e) => set("traffic_threshold_ratio", parseFloat(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Multiplier</label>
            <input type="number" min={1} step={0.05} className={INPUT} value={form.traffic_multiplier} onChange={(e) => set("traffic_multiplier", parseFloat(e.target.value) || 1)} />
          </div>
        </div>
      </div>

      <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5 space-y-2">
        <label className={LABEL}>Maximum Total Multiplier</label>
        <input type="number" min={1} step={0.1} className={`${INPUT} max-w-[160px]`} value={form.max_total_multiplier} onChange={(e) => set("max_total_multiplier", parseFloat(e.target.value) || 1)} />
        <p className="text-[11px] text-[var(--color-on-surface-variant)]">
          Busy-period, demand, and traffic factors never stack — the single strongest applicable factor applies, capped at this multiplier.
        </p>
      </div>

      {error && <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex items-center gap-3">
        <SaveButton isPending={isPending} />
        {saved && <span className="text-xs text-green-400 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Saved</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Busy Periods
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_RULE: BusyPeriodRuleInput = { label: "", day_of_week: null, start_time: "17:00", end_time: "19:00", multiplier: 1.3, active: true }

function BusyPeriodRuleModal({ initial, editingId, onClose, onSaved }: {
  initial: BusyPeriodRuleInput; editingId?: string; onClose: () => void; onSaved: (rule: BusyPeriodRuleRow) => void
}) {
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof BusyPeriodRuleInput>(key: K, value: BusyPeriodRuleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = editingId ? await adminUpdateBusyPeriodRule(editingId, form) : await adminCreateBusyPeriodRule(form)
      if (result.error) { setError(result.error); return }
      if (!result.data) { setError("The saved rule could not be loaded. Please retry."); return }
      onSaved(result.data)
    })
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!isPending) onClose() }} />
      <div className="relative w-full max-w-md bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-outline-variant)]/15">
          <h2 className="text-base font-bold text-white">{editingId ? "Edit Busy Period" : "New Busy Period"}</h2>
          <button onClick={onClose} className="text-[var(--color-on-surface-variant)] hover:text-white"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Label</label>
            <input className={INPUT} placeholder="Weekday rush hour" value={form.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Day</label>
            <select className={INPUT} value={form.day_of_week ?? "all"} onChange={(e) => set("day_of_week", e.target.value === "all" ? null : parseInt(e.target.value))}>
              <option value="all">Every day</option>
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Start Time</label>
              <input type="time" className={INPUT} value={form.start_time.slice(0, 5)} onChange={(e) => set("start_time", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>End Time</label>
              <input type="time" className={INPUT} value={form.end_time.slice(0, 5)} onChange={(e) => set("end_time", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Multiplier</label>
            <input type="number" min={1} step={0.05} className={INPUT} value={form.multiplier} onChange={(e) => set("multiplier", parseFloat(e.target.value) || 1)} />
          </div>
          <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Active" />
          {error && <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-[var(--color-outline-variant)]/15 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)]">Cancel</button>
          <button onClick={handleSave} disabled={isPending} className="px-5 py-2.5 rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm hover:bg-[var(--color-primary-fixed-dim)] disabled:opacity-60">
            {isPending ? "Saving…" : "Save Rule"}
          </button>
        </div>
      </div>
    </div>
  )
}

function BusyPeriodsSection({ initial }: { initial: BusyPeriodRuleRow[] }) {
  const [rules, setRules] = useState(initial)
  const [modalState, setModalState] = useState<{ input: BusyPeriodRuleInput; id?: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const result = await adminDeleteBusyPeriodRule(id)
      setDeletingId(null)
      if (!result.error) setRules((prev) => prev.filter((r) => r.id !== id))
    })
  }

  return (
    <div>
      {modalState && (
        <BusyPeriodRuleModal
          initial={modalState.input}
          editingId={modalState.id}
          onClose={() => setModalState(null)}
          onSaved={(rule) => {
            setRules((prev) => (modalState.id ? prev.map((r) => (r.id === modalState.id ? rule : r)) : [rule, ...prev]))
            setModalState(null)
          }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-on-surface-variant)]">{rules.length} rule{rules.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setModalState({ input: EMPTY_RULE })} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-xs rounded-xl hover:bg-[var(--color-primary-fixed-dim)] transition-all">
          <span className="material-symbols-outlined text-sm">add</span>New Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--color-outline-variant)] mb-3 block">schedule</span>
          <p className="text-sm font-semibold text-white">No busy period rules yet</p>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">Add time-based rules like weekday rush hour.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{r.label}</p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  {r.day_of_week === null ? "Every day" : DAY_NAMES[r.day_of_week]} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)} · {r.multiplier}× multiplier
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${r.active ? "bg-green-500/10 text-green-400" : "bg-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)]"}`}>
                {r.active ? "Active" : "Inactive"}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setModalState({ input: { label: r.label, day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time, multiplier: r.multiplier, active: r.active }, id: r.id })} className="p-1.5 rounded-lg text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)]">
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button onClick={() => handleDelete(r.id)} disabled={isPending && deletingId === r.id} className="p-1.5 rounded-lg text-[#ff6e84]/70 hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 disabled:opacity-40">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main panel
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { key: "codes", label: "Promo Codes", icon: "local_offer" },
  { key: "automatic", label: "Automatic Discounts", icon: "celebration" },
  { key: "surge", label: "Surge Pricing", icon: "trending_up" },
  { key: "busy", label: "Busy Periods", icon: "schedule" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function PromotionsPanel({
  initialPromoCodes, initialAutomaticDiscounts, initialSurgeSettings, initialBusyPeriodRules,
}: {
  initialPromoCodes: PromoCode[]
  initialAutomaticDiscounts: AutomaticDiscount[]
  initialSurgeSettings: SurgeSettings | null
  initialBusyPeriodRules: BusyPeriodRuleRow[]
}) {
  const [tab, setTab] = useState<TabKey>("codes")

  return (
    <div className="px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">Promotions & Pricing</h1>
        <p className="text-[var(--color-on-surface-variant)] mt-1">Discount codes, automatic rewards, and surge pricing rules.</p>
      </div>

      <div className="flex rounded-xl bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 p-1 w-fit mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.key ? "bg-[var(--brand-strong)] text-[var(--brand-ink)]" : "text-[var(--color-on-surface-variant)] hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "codes" && <PromoCodesSection initial={initialPromoCodes} />}
      {tab === "automatic" && <AutomaticDiscountsSection initial={initialAutomaticDiscounts} />}
      {tab === "surge" && <SurgePricingSection initial={initialSurgeSettings} />}
      {tab === "busy" && <BusyPeriodsSection initial={initialBusyPeriodRules} />}
    </div>
  )
}

