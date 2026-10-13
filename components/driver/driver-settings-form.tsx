"use client"

import { useState } from "react"
import { updateDriverProfile } from "@/app/actions/delivery"

type Props = {
  fullName: string
  phone: string
  email: string
}

export function DriverSettingsForm({ fullName, phone, email }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    const fd = new FormData(e.currentTarget)
    // split full_name into first/last for the action
    const name = (fd.get("full_name") as string ?? "").trim()
    const parts = name.split(" ")
    fd.set("first_name", parts[0] ?? "")
    fd.set("last_name", parts.slice(1).join(" ") || (parts[0] ?? ""))
    const result = await updateDriverProfile(fd)
    setSaving(false)
    if (result?.error) { setError(result.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleDiscard() {
    window.location.reload()
  }

  return (
    <form id="driver-settings-form" onSubmit={handleSubmit} className="contents">
      {/* Profile Information fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-5 md:gap-y-6">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Full Name</label>
          <input
            name="full_name"
            className="w-full bg-[#262626] border border-[#494847]/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all outline-none"
            type="text"
            defaultValue={fullName}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Phone Number</label>
          <input
            name="phone"
            className="w-full bg-[#262626] border border-[#494847]/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all outline-none"
            type="tel"
            defaultValue={phone}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Email Address</label>
          <input
            className="w-full bg-[#262626] border border-[#494847]/10 rounded-lg p-3 text-white transition-all outline-none opacity-60 cursor-not-allowed"
            type="email"
            value={email}
            readOnly
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Home Base</label>
          <select className="w-full bg-[#262626] border border-[#494847]/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all appearance-none outline-none">
            <option>San Francisco - Sector 7</option>
            <option>Oakland - Hub East</option>
            <option>San Jose - South Zone</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      {saved && <p className="text-sm text-green-400 mt-3">Profile saved!</p>}
    </form>
  )
}

export function DriverSettingsActions({ saving, onDiscard }: { saving?: boolean; onDiscard?: () => void }) {
  return (
    <div className="flex gap-3 self-start sm:self-auto">
      <button
        type="button"
        form="driver-settings-form"
        onClick={onDiscard}
        className="px-4 md:px-6 py-2.5 rounded-lg font-headline font-bold text-sm bg-[#262626] text-white hover:bg-[#2c2c2c] transition-all"
      >
        Discard
      </button>
      <button
        type="submit"
        form="driver-settings-form"
        className="px-4 md:px-6 py-2.5 rounded-lg font-headline font-bold text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] transition-all"
        style={{ boxShadow: "0px 0px 15px rgba(var(--brand-rgb),0.2)" }}
      >
        Save Profile
      </button>
    </div>
  )
}

