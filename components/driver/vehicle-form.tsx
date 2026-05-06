"use client"

import { useState, useTransition } from "react"
import { updateVehicleInfo } from "@/app/actions/driver"

type Props = {
  vehicleType: string
  vehicleNumber: string
}

export function VehicleForm({ vehicleType, vehicleNumber }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateVehicleInfo(formData)
      if (result.error) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Vehicle Type</label>
        <input
          name="vehicle_type"
          type="text"
          defaultValue={vehicleType}
          placeholder="e.g. Sedan, SUV, Motorcycle"
          className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/40 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-all"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Plate / Vehicle Number</label>
        <input
          name="vehicle_number"
          type="text"
          defaultValue={vehicleNumber}
          placeholder="e.g. ABC-1234"
          className="w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/40 focus:ring-1 focus:ring-[#a3a6ff]/20 transition-all"
        />
      </div>
      {error && (
        <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm shadow-[0_0_15px_rgba(163,166,255,0.2)] disabled:opacity-60 flex items-center gap-2 transition-all"
        >
          {isPending ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Saving...</>
          ) : "Save Vehicle"}
        </button>
        {saved && <span className="text-xs text-green-400 font-semibold">Saved!</span>}
      </div>
    </form>
  )
}
