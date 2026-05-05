"use client"

import { useState } from "react"
import { updateDriverProfile } from "@/app/actions/delivery"

type Props = {
  fullName: string
  phone: string
}

export function ProfileForm({ fullName, phone }: Props) {
  const parts = fullName.trim().split(" ")
  const initialFirst = parts[0] ?? ""
  const initialLast = parts.slice(1).join(" ")

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    const result = await updateDriverProfile(new FormData(e.currentTarget))
    setSaving(false)
    if (result?.error) { setError(result.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">First Name</label>
          <input
            name="first_name"
            type="text"
            defaultValue={initialFirst}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Last Name</label>
          <input
            name="last_name"
            type="text"
            defaultValue={initialLast}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Phone</label>
        <input
          name="phone"
          type="tel"
          defaultValue={phone}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-xs text-green-500">Saved!</span>}
      </div>
    </form>
  )
}
