"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { adminCreateDriver } from "@/app/actions/delivery"

export function AddDriverModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await adminCreateDriver(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        router.refresh()
        setTimeout(onClose, 1200)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl overflow-hidden"
        style={{ background: "var(--brand-panel)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-outline-variant)]/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-strong)]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[var(--brand-soft)] text-base">person_add</span>
            </div>
            <h2 className="text-base font-bold text-white">Add Driver Manually</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[var(--color-surface-container-highest)] flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-400 text-2xl">check_circle</span>
              </div>
              <p className="text-white font-semibold">Driver added successfully</p>
              <p className="text-[var(--color-on-surface-variant)] text-sm">They will appear in the Pending Approval tab.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                  Full Name <span className="text-[#ff6e84]">*</span>
                </label>
                <input
                  name="full_name"
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  className="w-full bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/60 focus:ring-1 focus:ring-[var(--brand-strong)]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                  Email Address <span className="text-[#ff6e84]">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="driver@example.com"
                  className="w-full bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/60 focus:ring-1 focus:ring-[var(--brand-strong)]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+1 555 000 0000"
                  className="w-full bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:border-[var(--brand-strong)]/60 focus:ring-1 focus:ring-[var(--brand-strong)]/30 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-[#ff6e84] text-base shrink-0 mt-0.5">error</span>
                  <p className="text-[#ff6e84] text-xs">{error}</p>
                </div>
              )}

              <p className="text-[10px] text-[var(--color-on-surface-variant)] leading-relaxed">
                Existing accounts keep their current mode and verification. New drivers receive an invitation to set their password and complete verification.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] font-semibold text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-3 rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Adding...
                    </>
                  ) : (
                    "Add Driver"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

