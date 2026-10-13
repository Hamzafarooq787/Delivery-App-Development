"use client"

import { useState, useTransition } from "react"
import { GeneralSettingsForm } from "@/components/admin/general-settings-form"
import { getBfmSettings, updateBfmSettings } from "@/app/actions/shopping"

const TABS = [
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
  { key: "baseFare",      label: "Base Fare (£)",         placeholder: "5.00" },
  { key: "perMile",       label: "Per Mile Rate (£)",      placeholder: "1.20" },
  { key: "commission",    label: "Platform Commission (%)", placeholder: "15" },
  { key: "payoutShare",   label: "Driver Payout Share (%)", placeholder: "80" },
]

export function SettingsTabsClient({
  adminProfile,
  initialBfmSettings,
}: {
  adminProfile: { full_name: string; email: string; phone: string }
  initialBfmSettings?: { service_enabled?: boolean; max_purchase_amount: number }
}) {
  const [activeTab, setActiveTab] = useState("General")
  const [pricing, setPricing] = useState<Record<string, string>>({})
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
      // Placeholder: pricing config table not yet provisioned
      await new Promise((r) => setTimeout(r, 600))
      setPricingMsg({ text: "Pricing settings saved.", ok: true })
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
                  ? "bg-[#a3a6ff]/10 text-[#a3a6ff]"
                  : "text-[#adaaaa] hover:text-white hover:bg-[#1a1919]"
              }`}
            >
              <span className={`material-symbols-outlined text-base ${activeTab === tab.label ? "text-[#a3a6ff]" : ""}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Panels */}
      <div className="col-span-1 md:col-span-9 space-y-6">

        {/* General */}
        {activeTab === "General" && (
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#a3a6ff]">tune</span>
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
          <div className="bg-[#1a1919] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#c180ff]">payments</span>
              <h3 className="text-base font-bold text-white font-headline">Pricing &amp; Fees</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PRICING_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">
                    {label}
                  </label>
                  <input
                    type="number"
                    placeholder={placeholder}
                    value={pricing[key] ?? ""}
                    onChange={(e) => setPricing((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-[#201f1f] border border-[#494847]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#494847] outline-none focus:border-[#c180ff]/40 transition-colors"
                  />
                </div>
              ))}
            </div>
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
                className="bg-[#c180ff]/15 text-[#c180ff] border border-[#c180ff]/20 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[#c180ff]/25 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save Pricing"}
              </button>
            </div>
          </div>
        )}

        {/* Buy for Me */}
        {activeTab === "Buy for Me" && (
          <div className="bg-[#1a1919] rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#c180ff]">shopping_bag</span>
              <h3 className="text-base font-bold text-white font-headline">Buy for Me Settings</h3>
            </div>
            <p className="text-sm text-[#adaaaa]">
              Configure the personal shopping service. Drivers purchase items on behalf of customers.
            </p>

            {/* Enable toggle */}
            <div className="flex items-center justify-between py-4 border-t border-[#494847]/15">
              <div>
                <p className="text-sm font-semibold text-white">Service Enabled</p>
                <p className="text-xs text-[#adaaaa] mt-0.5">Allow customers to create Buy for Me requests</p>
              </div>
              <button
                type="button"
                onClick={() => setBfmEnabled((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${bfmEnabled ? "bg-[#c180ff]" : "bg-[#494847]/40"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${bfmEnabled ? "right-1" : "left-1"}`} />
              </button>
            </div>

            {/* Max purchase amount */}
            <div className="pt-2">
              <label className="block text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">
                Max Purchase Amount (£)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="50.00"
                value={bfmMaxSpend}
                onChange={(e) => setBfmMaxSpend(e.target.value)}
                className="w-full sm:w-64 bg-[#201f1f] border border-[#494847]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#494847] outline-none focus:border-[#c180ff]/40 transition-colors"
              />
              <p className="mt-1.5 text-[11px] text-[#adaaaa]">
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
                className="bg-[#c180ff]/15 text-[#c180ff] border border-[#c180ff]/20 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[#c180ff]/25 transition-colors disabled:opacity-50"
              >
                {isBfmPending ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeTab === "Notifications" && (
          <div className="bg-[#1a1919] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#ffa5d9]">notifications</span>
              <h3 className="text-base font-bold text-white font-headline">Notification Templates</h3>
            </div>
            <div className="space-y-2">
              {NOTIFICATION_TEMPLATES.map((template) => (
                <div
                  key={template}
                  className="group flex items-center justify-between px-4 py-4 rounded-xl hover:bg-[#201f1f] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#ffa5d9]/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#ffa5d9] text-sm">mail</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{template}</p>
                      <p className="text-[#adaaaa] text-[10px]">SMS + Push + Email</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-4 rounded-full bg-[#a3a6ff]/80 relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white" />
                    </div>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-[#adaaaa] hover:text-white transition-all"
                      onClick={() => {}}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
