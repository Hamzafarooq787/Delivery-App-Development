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
        className="relative w-full max-w-md rounded-2xl border border-[#494847]/20 shadow-2xl overflow-hidden"
        style={{ background: "rgba(26,25,25,0.98)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#494847]/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#a3a6ff]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#a3a6ff] text-base">person_add</span>
            </div>
            <h2 className="text-base font-bold text-white">Add Driver Manually</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#262626] flex items-center justify-center text-[#adaaaa] hover:text-white transition-colors"
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
              <p className="text-[#adaaaa] text-sm">They will appear in the Pending Approval tab.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">
                  Full Name <span className="text-[#ff6e84]">*</span>
                </label>
                <input
                  name="full_name"
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">
                  Email Address <span className="text-[#ff6e84]">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="driver@example.com"
                  className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+1 555 000 0000"
                  className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/60 focus:ring-1 focus:ring-[#a3a6ff]/30 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-[#ff6e84] text-base shrink-0 mt-0.5">error</span>
                  <p className="text-[#ff6e84] text-xs">{error}</p>
                </div>
              )}

              <p className="text-[10px] text-[#adaaaa] leading-relaxed">
                If this email already exists, the account will be converted to a driver role. New accounts
                are created with email confirmation bypassed — the driver can set their password via "Forgot Password".
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[#262626] text-[#adaaaa] font-semibold text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-3 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm shadow-[0_0_15px_rgba(163,166,255,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
