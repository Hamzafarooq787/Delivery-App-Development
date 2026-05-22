"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  driver: "Driver",
}
const ROLE_ICONS: Record<string, string> = {
  customer: "person",
  driver:   "local_shipping",
}
const ROLE_COLORS: Record<string, string> = {
  customer: "text-[#a3a6ff]",
  driver:   "text-[#6ee7b7]",
}
const ROLE_BG: Record<string, string> = {
  customer: "bg-[#a3a6ff]/10 border-[#a3a6ff]/20",
  driver:   "bg-[#6ee7b7]/10 border-[#6ee7b7]/20",
}

function AccountLinkedContent() {
  const params = useSearchParams()
  const existing = params.get("existing") ?? "customer"
  const added    = params.get("added")    ?? "driver"

  const existingLabel = ROLE_LABELS[existing] ?? existing
  const addedLabel    = ROLE_LABELS[added]    ?? added
  const addedHref     = added === "driver" ? "/dashboard/driver" : "/dashboard/customer"
  const existingHref  = existing === "driver" ? "/dashboard/driver" : "/dashboard/customer"

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#a3a6ff]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#6ee7b7]/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a3a6ff] text-2xl">bolt</span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold text-white tracking-tight">KINETIC VOID</h1>
          </Link>
        </div>

        <div className="glass-card rounded-2xl border border-[#262626] p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#6ee7b7]/10 border border-[#6ee7b7]/20 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#6ee7b7] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                link
              </span>
            </div>
            <h2 className="font-headline text-xl font-bold text-white mb-1">Accounts Linked!</h2>
            <p className="text-[#adaaaa] text-sm leading-relaxed">
              Your Google account was already registered as a{" "}
              <span className={`font-bold ${ROLE_COLORS[existing]}`}>{existingLabel}</span>.
              We&apos;ve automatically added{" "}
              <span className={`font-bold ${ROLE_COLORS[added]}`}>{addedLabel}</span> access too.
            </p>
          </div>

          {/* Role cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[existing, added].map((r, i) => (
              <div key={r} className={`rounded-xl border p-3.5 flex flex-col items-center gap-2 ${ROLE_BG[r]}`}>
                <span
                  className={`material-symbols-outlined text-2xl ${ROLE_COLORS[r]}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {ROLE_ICONS[r]}
                </span>
                <p className={`text-xs font-bold ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</p>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#262626] text-[#adaaaa]">
                  {i === 0 ? "existing" : "just added"}
                </span>
              </div>
            ))}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 bg-[#a3a6ff]/8 border border-[#a3a6ff]/15 rounded-xl px-4 py-3 mb-6">
            <span className="material-symbols-outlined text-[#a3a6ff] text-base shrink-0 mt-0.5">info</span>
            <p className="text-xs text-[#adaaaa] leading-relaxed">
              You can switch between <span className="text-white font-medium">{existingLabel}</span> and{" "}
              <span className="text-white font-medium">{addedLabel}</span> at any time from the{" "}
              <span className="text-[#a3a6ff] font-medium">profile menu</span> in the top-right corner. Your data for each role is kept separate and safe.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            <Link
              href={addedHref}
              className="w-full milled-gradient text-white font-semibold text-sm rounded-xl py-3 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all glow-primary"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {ROLE_ICONS[added]}
              </span>
              Go to {addedLabel} Dashboard
            </Link>
            <Link
              href={existingHref}
              className="w-full bg-[#262626] hover:bg-[#2e2e2e] text-[#adaaaa] hover:text-white font-semibold text-sm rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-[#494847]/20"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {ROLE_ICONS[existing]}
              </span>
              Stay as {existingLabel}
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[#494847] mt-6">
          &copy; {new Date().getFullYear()} Kinetic Void. All rights reserved.
        </p>
      </div>
    </main>
  )
}

export default function AccountLinkedPage() {
  return (
    <Suspense fallback={null}>
      <AccountLinkedContent />
    </Suspense>
  )
}
