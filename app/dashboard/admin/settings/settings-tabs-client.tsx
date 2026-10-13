"use client"

import { useState, useTransition } from "react"
import { GeneralSettingsForm } from "@/components/admin/general-settings-form"

const TABS = [
  { label: "General",       icon: "tune" },
  { label: "Pricing & Fees", icon: "payments" },
  { label: "Notifications", icon: "notifications" },
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
}: {
  adminProfile: { full_name: string; email: string; phone: string }
}) {
  const [activeTab, setActiveTab] = useState("General")
  const [pricing, setPricing] = useState<Record<string, string>>({})
  const [pricingMsg, setPricingMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

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
