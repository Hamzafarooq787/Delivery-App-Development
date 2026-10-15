"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { safetyReleaseJob } from "@/app/actions/delivery"
import { toast } from "sonner"

const SAFETY_REASONS = [
  { icon: "suspicious_activity", label: "Item appears suspicious or illegal" },
  { icon: "warning", label: "Package contains dangerous goods" },
  { icon: "person_alert", label: "Customer behaviour feels threatening" },
  { icon: "location_off", label: "Pickup/drop-off location feels unsafe" },
  { icon: "crisis_alert", label: "I feel personally threatened" },
  { icon: "report", label: "Other safety concern" },
]

export function SafetyCancelButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    if (!selected) return
    startTransition(async () => {
      const result = await safetyReleaseJob(jobId, selected)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Job released. Stay safe — your account is protected.")
      setOpen(false)
      router.push("/dashboard/driver/jobs/available")
      router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/25 bg-red-500/8 text-sm font-bold text-red-400 hover:bg-red-500/15 transition-all active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-base">shield_with_heart</span>
        Safety Cancel
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[var(--brand-panel)] rounded-2xl border border-red-500/20 shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-red-500/15 bg-red-500/5">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-400">shield_with_heart</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Driver Safety Cancel</p>
                <p className="text-[10px] text-red-400/80 uppercase tracking-wider">Your safety comes first</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto p-1.5 rounded-lg text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed">
                You can cancel this job at any time if you feel unsafe. The job will be released back to the pool and <span className="text-white font-semibold">your account will not be penalised</span>. Select your reason:
              </p>

              <div className="space-y-2">
                {SAFETY_REASONS.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setSelected(r.label)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      selected === r.label
                        ? "border-red-500/50 bg-red-500/10 text-white"
                        : "border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] hover:border-[var(--color-outline-variant)]/40 hover:text-white"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-base shrink-0 ${selected === r.label ? "text-red-400" : "text-[var(--color-outline-variant)]"}`}>
                      {r.icon}
                    </span>
                    <span className="text-sm font-medium">{r.label}</span>
                    {selected === r.label && (
                      <span className="material-symbols-outlined text-red-400 text-base ml-auto">check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--color-outline-variant)]/15 bg-[var(--color-surface-container-highest)] px-4 py-3">
                <p className="text-[11px] text-[var(--color-on-surface-variant)] leading-relaxed">
                  <span className="material-symbols-outlined text-amber-400 text-sm align-middle mr-1">info</span>
                  This action is logged for safety review. The job will be reassigned to another driver. Your anonymity is protected.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--color-outline-variant)]/15 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selected || isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">shield_with_heart</span>
                {isPending ? "Releasing…" : "Confirm Safety Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
