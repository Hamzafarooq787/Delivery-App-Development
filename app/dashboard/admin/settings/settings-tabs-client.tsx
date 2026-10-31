"use client"

import { getBookingPricing, saveBookingPricing, getBookingPricingHistory } from "@/app/actions/booking-settings"
import type { BookingPricing } from "@/lib/booking-pricing"
import { useEffect } from "react"
import { BrandThemePanel } from "@/components/admin/brand-theme-panel"
import { useState, useTransition } from "react"
import {NotificationSettingsForm} from "@/components/admin/notification-settings-form"
import { GeneralSettingsForm } from "@/components/admin/general-settings-form"
import { getBfmSettings, updateBfmSettings } from "@/app/actions/shopping"

const TABS = [
  { label: "Theme", icon: "palette" },
  { label: "General",       icon: "tune" },
  { label: "Pricing & Fees", icon: "payments" },
  { label: "Notifications", icon: "notifications" },
  { label: "Buy for Me",    icon: "shopping_bag" },
]

const NOTIFICATION_TEMPLATES = [
  "Order Confirmed",
  "Driver Assigned",
  "Out for Delivery",
  "Order Delivered",
  "Order Cancelled",
]

const PRICING_FIELDS = [
  {key:"waitingPerMinute",label:"Collection waiting request per minute (£, 0 = disabled; first 5 minutes free, requires customer approval and support review)",placeholder:"0"},
  {key:"maxShoppingProducts",label:"Maximum different shopping products (15–50)",placeholder:"15"},
  {key:"maxQuantityPerProduct",label:"Maximum quantity per product",placeholder:"10"},
  {key:"maxShoppingWeightKg",label:"Maximum shopping weight (kg)",placeholder:"15"},
  {key:"maxShoppingDimensionCm",label:"Maximum package dimension (cm)",placeholder:"60"},
  { key: "commissionPercent", label: "GoDrop commission on service fees (%)", placeholder: "20" },
  { key: "minimumDriverEarnings", label: "Minimum driver earnings per job (£)", placeholder: "4.49" },
  { key: "baseFare", label: "First miles price (£)", placeholder: "4.49" },
  { key: "includedMiles", label: "Included driving miles", placeholder: "2" },
  { key: "perMile", label: "Each additional mile (£)", placeholder: "1.20" },
  { key: "shoppingFee", label: "Fixed shopping service fee (£)", placeholder: "3.99" },
  { key: "largeFee", label: "Large item surcharge (£)", placeholder: "0" },
  { key: "vanFee", label: "Van surcharge (£)", placeholder: "0" },
  { key: "weatherFee", label: "Current weather surcharge (£)", placeholder: "0" },
  { key: "serviceRadiusMiles", label: "Miles from Manchester (0 = unrestricted)", placeholder: "0" },
]

export function SettingsTabsClient({
  adminProfile,
  initialBfmSettings,
}: {
  adminProfile: { full_name: string; email: string; phone: string }
  initialBfmSettings?: { service_enabled?: boolean; max_purchase_amount: number }
}) {
  const [activeTab, setActiveTab] = useState("General")
  const [history,setHistory]=useState<Awaited<ReturnType<typeof getBookingPricingHistory>>>([])
  useEffect(()=>{void getBookingPricingHistory().then(setHistory)},[])
  const [pricing, setPricing] = useState<Record<string, string>>({})
  useEffect(() => { getBookingPricing().then(config => setPricing(Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(value)])))).catch(() => setPricingMsg({ text: "Could not load pricing. Retry by refreshing.", ok: false })) }, [])
  const [pricingMsg, setPricingMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const [bfmEnabled, setBfmEnabled] = useState(initialBfmSettings?.service_enabled !== false)
  const [bfmMaxSpend, setBfmMaxSpend] = useState(String(initialBfmSettings?.max_purchase_amount ?? 50))
  const [bfmMsg, setBfmMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isBfmPending, startBfmTransition] = useTransition()

  function handleSaveBfm() {
    startBfmTransition(async () => {
      const v = parseFloat(bfmMaxSpend)
      if (isNaN(v) || v <= 0) {
        setBfmMsg({ text: "Max purchase amount must be a positive number.", ok: false })
        setTimeout(() => setBfmMsg(null), 3000)
        return
      }
      const result = await updateBfmSettings({ enabled: bfmEnabled, max_purchase_amount: v })
      if (result.error) {
        setBfmMsg({ text: result.error, ok: false })
      } else {
        setBfmMsg({ text: "Buy for Me settings saved.", ok: true })
      }
      setTimeout(() => setBfmMsg(null), 3000)
    })
  }

  function handleSavePricing() {
    startTransition(async () => {
      // Validate all fields are positive numbers
      for (const f of PRICING_FIELDS) {
        const v = parseFloat(pricing[f.key] ?? "")
        if (pricing[f.key] !== undefined && pricing[f.key] !== "" && (isNaN(v) || v < 0)) {
          setPricingMsg({ text: `Invalid value for ${f.label}`, ok: false })
          setTimeout(() => setPricingMsg(null), 3000)
          return
        }
      }
      const config = Object.fromEntries(PRICING_FIELDS.map(f => [f.key, Number(pricing[f.key]??(f.key==='waitingPerMinute'?'0':undefined))])) as BookingPricing
      const result = await saveBookingPricing(config)
      if(!result.error)setHistory(await getBookingPricingHistory())
      setPricingMsg({ text: result.error ?? "Pricing settings saved. New quotes use these rates.", ok: !result.error })
      setTimeout(() => setPricingMsg(null), 3000)
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-5xl">
      {/* Left Nav */}
      <div className="col-span-1 md:col-span-3">
        <nav className="flex md:flex-col flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(tab.label)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.label
                  ? "bg-[var(--brand-strong)]/10 text-[var(--brand-soft)]"
                  : "text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--brand-panel)]"
              }`}
            >
              <span className={`material-symbols-outlined text-base ${activeTab === tab.label ? "text-[var(--brand-soft)]" : ""}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Panels */}
      <div className="col-span-1 md:col-span-9 space-y-6">

        {activeTab === "Theme" && <BrandThemePanel />}
        {/* General */}
        {activeTab === "General" && (
          <div className="bg-[var(--brand-panel)] rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[var(--brand-soft)]">tune</span>
              <h3 className="text-base font-bold text-white font-headline">General Settings</h3>
            </div>
            <GeneralSettingsForm
              fullName={adminProfile.full_name}
              email={adminProfile.email}
              phone={adminProfile.phone}
            />
          </div>
        )}

        {/* Pricing */}
        {activeTab === "Pricing & Fees" && (
          <div className="bg-[var(--brand-panel)] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[var(--color-secondary)]">payments</span>
              <h3 className="text-base font-bold text-white font-headline">Pricing &amp; Fees</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PRICING_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">
                    {label}
                  </label>
                  <input
                    type="number"
                    placeholder={placeholder}
                    value={pricing[key] ?? ""}
                    onChange={(e) => setPricing((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[var(--color-outline-variant)] outline-none focus:border-[var(--color-secondary)]/40 transition-colors"
                  />
                </div>
              ))}
            </div>
            {history.length>0&&<details className="mt-4 text-sm text-white"><summary>Recent pricing changes</summary>{history.map((row,i)=><div key={i} className="my-3 border-t border-white/10 pt-2"><p>{new Date(row.at).toLocaleString("en-GB")}</p>{PRICING_FIELDS.filter(f=>row.before[f.key]!==row.after[f.key]).map(f=><p key={f.key}>{f.label}: {row.before[f.key]??"—"} → {row.after[f.key]}</p>)}</div>)}</details>}
            {pricingMsg && (
              <p className={`mt-4 text-xs font-medium ${pricingMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                {pricingMsg.text}
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSavePricing}
                className="bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[var(--color-secondary)]/25 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save Pricing"}
              </button>
            </div>
          </div>
        )}

        {/* Buy for Me */}
        {activeTab === "Buy for Me" && (
          <div className="bg-[var(--brand-panel)] rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[var(--color-secondary)]">shopping_bag</span>
              <h3 className="text-base font-bold text-white font-headline">Buy for Me Settings</h3>
            </div>
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Configure the personal shopping service. Drivers purchase items on behalf of customers.
            </p>

            {/* Enable toggle */}
            <div className="flex items-center justify-between py-4 border-t border-[var(--color-outline-variant)]/15">
              <div>
                <p className="text-sm font-semibold text-white">Service Enabled</p>
                <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Allow customers to create Buy for Me requests</p>
              </div>
              <button
                type="button"
                onClick={() => setBfmEnabled((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${bfmEnabled ? "bg-[var(--color-secondary)]" : "bg-[var(--color-outline-variant)]/40"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${bfmEnabled ? "right-1" : "left-1"}`} />
              </button>
            </div>

            {/* Max purchase amount */}
            <div className="pt-2">
              <label className="block text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">
                Max Purchase Amount (£)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="50.00"
                value={bfmMaxSpend}
                onChange={(e) => setBfmMaxSpend(e.target.value)}
                className="w-full sm:w-64 bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[var(--color-outline-variant)] outline-none focus:border-[var(--color-secondary)]/40 transition-colors"
              />
              <p className="mt-1.5 text-[11px] text-[var(--color-on-surface-variant)]">
                The maximum amount a driver can spend on a single shopping trip. Customers approve this limit at booking.
              </p>
            </div>

            {bfmMsg && (
              <p className={`text-xs font-medium ${bfmMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                {bfmMsg.text}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isBfmPending}
                onClick={handleSaveBfm}
                className="bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[var(--color-secondary)]/25 transition-colors disabled:opacity-50"
              >
                {isBfmPending ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "Notifications" && <NotificationSettingsForm/>}

      </div>
    </div>
  )
}

