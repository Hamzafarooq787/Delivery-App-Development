"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { adminAssignDriver } from "@/app/actions/delivery"

export type DriverOption = { id: string; full_name: string }

export function AssignDriverDropdown({
  deliveryId,
  currentDriverId,
  drivers,
  disabled = false,
}: {
  deliveryId: string
  currentDriverId: string | null
  drivers: DriverOption[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [localDriverId, setLocalDriverId] = useState(currentDriverId)
  const ref = useRef<HTMLDivElement>(null)

  const currentDriver = drivers.find((d) => d.id === localDriverId)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(driverId: string | null) {
    setOpen(false)
    if (driverId === localDriverId) return
    setLocalDriverId(driverId)
    startTransition(async () => {
      const result = await adminAssignDriver(deliveryId, driverId)
      if (result.error) {
        setLocalDriverId(currentDriverId)
        alert("Failed to assign driver: " + result.error)
      }
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={isPending || disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap ${
          localDriverId
            ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
            : "bg-[#262626] border-[#494847]/20 text-[#adaaaa] hover:text-white hover:bg-[#2c2c2c]"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isPending ? (
          <>
            <svg className="animate-spin w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Assigning...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-sm">
              {localDriverId ? "person" : "person_add"}
            </span>
            <span className="max-w-[100px] truncate">
              {currentDriver?.full_name ?? "Assign Driver"}
            </span>
            <span className="material-symbols-outlined text-xs">expand_more</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl bg-[#1a1919] border border-[#494847]/20 shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[#494847]/10">
            <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-wider">Select Driver</p>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {/* Unassign option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors hover:bg-[#262626] ${
                !localDriverId ? "text-[#ff6e84]" : "text-[#adaaaa]"
              }`}
            >
              <span className="material-symbols-outlined text-sm">person_remove</span>
              Unassign
            </button>

            {drivers.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[#adaaaa] text-center">No approved drivers</p>
            ) : (
              drivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => handleSelect(driver.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors hover:bg-[#262626] ${
                    driver.id === localDriverId
                      ? "text-[var(--color-primary)] font-bold"
                      : "text-white"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                    <span className="text-[8px] font-bold text-[var(--color-primary)]">
                      {driver.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="truncate">{driver.full_name}</span>
                  {driver.id === localDriverId && (
                    <span className="material-symbols-outlined text-xs ml-auto shrink-0 text-[var(--color-primary)]">check</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

