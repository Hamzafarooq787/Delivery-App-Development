"use client"

import { useState, useTransition } from "react"
import { updateDriverProfile } from "@/app/actions/delivery"

const INPUT = "w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
const LABEL = "text-xs font-semibold text-[#adaaaa] uppercase tracking-wider"

type Props = { fullName: string; phone: string }

export function ProfileForm({ fullName, phone }: Props) {
  const parts        = fullName.trim().split(" ")
  const initialFirst = parts[0] ?? ""
  const initialLast  = parts.slice(1).join(" ")

  const [isPending, startTransition] = useTransition()
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateDriverProfile(new FormData(e.currentTarget))
      if (result?.error) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={LABEL}>First Name</label>
          <input
            name="first_name"
            type="text"
            defaultValue={initialFirst}
            placeholder="First"
            className={INPUT}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Last Name</label>
          <input
            name="last_name"
            type="text"
            defaultValue={initialLast}
            placeholder="Last"
            className={INPUT}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={LABEL}>Phone</label>
        <input
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder="+44 7700 000000"
          className={INPUT}
        />
      </div>

      {error && (
        <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60 flex items-center gap-2 transition-all"
        >
          {isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving…
            </>
          ) : "Save Changes"}
        </button>
        {saved && (
          <span className="text-xs text-[#6ee7b7] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Saved!
          </span>
        )}
      </div>
    </form>
  )
}

