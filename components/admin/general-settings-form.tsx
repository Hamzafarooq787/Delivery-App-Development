"use client"

import { useRef, useState } from "react"
import { adminSaveSettings } from "@/app/actions/delivery"

type Props = {
  fullName: string
  email: string
  phone: string
}

export function GeneralSettingsForm({ fullName, email, phone }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    await adminSaveSettings(fd)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-4">
        {[
          { label: "Platform Name", name: "full_name", placeholder: "Kinetic Velocity", type: "text", defaultValue: fullName },
          { label: "Support Email", name: "email", placeholder: "support@kinetic.io", type: "email", defaultValue: email, readOnly: true },
          { label: "Support Phone", name: "phone", placeholder: "+1 (800) 000-0000", type: "tel", defaultValue: phone },
        ].map(({ label, name, placeholder, type, defaultValue, readOnly }) => (
          <div key={name}>
            <label className="block text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-2">
              {label}
            </label>
            <input
              type={type}
              name={name}
              placeholder={placeholder}
              defaultValue={defaultValue ?? ""}
              readOnly={readOnly}
              className="w-full bg-[var(--color-surface-container-high)] border border-[var(--color-outline-variant)]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[var(--color-outline-variant)] outline-none focus:border-[var(--brand-strong)]/40 transition-colors read-only:opacity-60 read-only:cursor-not-allowed"
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-green-400">Saved!</span>}
        <button
          type="submit"
          disabled={saving}
          className="bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[var(--brand-soft)] transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save General"}
        </button>
      </div>
    </form>
  )
}

