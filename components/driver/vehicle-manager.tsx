/**
 * components/driver/vehicle-manager.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Add / edit / remove a driver's vehicles. A driver can register multiple
 * vehicles (Bicycle/Motorcycle/Car/Van) — job matching uses the union of
 * capabilities across all of them, so there's no "active vehicle" toggle here,
 * just a list.
 *
 * Controlled component: the parent owns the vehicles list (mirrors the
 * pattern VerificationPanel already uses for documents) so it can react to
 * changes — e.g. gating "Submit for Review" on having at least one vehicle.
 */
"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { addVehicle, updateVehicle, deleteVehicle, type DriverVehicle, type VehicleInput } from "@/app/actions/vehicles"
import { VEHICLE_TYPES, VEHICLE_INFO, isMotorVehicle, type VehicleType } from "@/lib/vehicles"

const INPUT = "w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
const LABEL = "text-xs font-semibold text-[#adaaaa] uppercase tracking-wider"

const EMPTY_INPUT: VehicleInput = {
  vehicle_type: "car",
  make: "",
  model: "",
  colour: "",
  registration_number: "",
  driving_licence_details: "",
  insurance_details: "",
}

function vehicleToInput(v: DriverVehicle): VehicleInput {
  return {
    vehicle_type: v.vehicle_type,
    make: v.make ?? "",
    model: v.model ?? "",
    colour: v.colour ?? "",
    registration_number: v.registration_number ?? "",
    driving_licence_details: v.driving_licence_details ?? "",
    insurance_details: v.insurance_details ?? "",
  }
}

function VehicleFormModal({
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  initial: VehicleInput
  editingId?: string
  onClose: () => void
  onSaved: (vehicle: DriverVehicle) => void
}) {
  const [form, setForm] = useState<VehicleInput>(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const vehicleType = form.vehicle_type as VehicleType
  const motor = isMotorVehicle(vehicleType)

  function set<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = editingId
        ? await updateVehicle(editingId, form)
        : await addVehicle(form)

      if (result.error) { setError(result.error); return }

      onSaved({
        id: editingId ?? result.id ?? crypto.randomUUID(),
        vehicle_type: vehicleType,
        make: form.make.trim(),
        model: form.model.trim(),
        colour: form.colour.trim(),
        registration_number: form.registration_number.trim() || null,
        driving_licence_details: form.driving_licence_details.trim() || null,
        insurance_details: form.insurance_details.trim() || null,
        created_at: new Date().toISOString(),
      })
    })
  }

  // Rendered via a portal to document.body — this modal is used inside cards
  // that have backdrop-blur (a CSS filter), which makes that ancestor the
  // containing block for any `position: fixed` descendant. Without the
  // portal, "fixed inset-0" ends up clipped to that small card instead of
  // covering the viewport, which is exactly the "modal looks broken/cut off"
  // bug this fixes.
  return createPortal(
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!isPending) onClose() }} />
      <div className="relative w-full max-w-lg bg-[#1a1919] border border-[#494847]/20 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15 shrink-0">
          <h2 className="text-base font-bold text-white">{editingId ? "Edit Vehicle" : "Add Vehicle"}</h2>
          <button onClick={onClose} className="text-[#adaaaa] hover:text-white">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          {/* Vehicle type picker */}
          <div>
            <p className={`${LABEL} mb-2`}>Vehicle Type</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLE_TYPES.map((t) => {
                const active = vehicleType === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("vehicle_type", t)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)]"
                        : "bg-[#262626] border-[#494847]/20 text-[#adaaaa] hover:border-[#494847]/40"
                    }`}
                  >
                    <span className="text-lg">{VEHICLE_INFO[t].emoji}</span>
                    {VEHICLE_INFO[t].label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Make</label>
              <input className={INPUT} placeholder="e.g. Toyota" value={form.make} onChange={(e) => set("make", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Model</label>
              <input className={INPUT} placeholder="e.g. Corolla" value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Colour</label>
            <input className={INPUT} placeholder="e.g. Silver" value={form.colour} onChange={(e) => set("colour", e.target.value)} />
          </div>

          {motor && (
            <>
              <div className="space-y-1.5">
                <label className={LABEL}>Registration Number</label>
                <input className={INPUT} placeholder="e.g. AB12 CDE" value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Driving Licence Details</label>
                <input className={INPUT} placeholder="Licence number / category" value={form.driving_licence_details} onChange={(e) => set("driving_licence_details", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Insurance Details</label>
                <input className={INPUT} placeholder="Provider / policy number" value={form.insurance_details} onChange={(e) => set("insurance_details", e.target.value)} />
              </div>
            </>
          )}

          {!motor && (
            <p className="text-[11px] text-[#adaaaa] bg-[#262626] rounded-xl px-3 py-2.5">
              Registration, driving licence, and insurance aren't required for bicycles.
            </p>
          )}

          {error && (
            <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#494847]/15 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm hover:bg-[var(--color-primary-fixed-dim)] transition-all active:scale-[0.98] disabled:opacity-60 flex items-center gap-2"
          >
            {isPending ? "Saving…" : "Save Vehicle"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function VehicleManager({
  vehicles,
  onChange,
}: {
  vehicles: DriverVehicle[]
  onChange: (vehicles: DriverVehicle[]) => void
}) {
  const [modalState, setModalState] = useState<{ input: VehicleInput; id?: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    setDeleteError(null)
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteVehicle(id)
      setDeletingId(null)
      if (result.error) { setDeleteError(result.error); return }
      onChange(vehicles.filter((v) => v.id !== id))
    })
  }

  return (
    <div>
      {modalState && (
        <VehicleFormModal
          initial={modalState.input}
          editingId={modalState.id}
          onClose={() => setModalState(null)}
          onSaved={(vehicle) => {
            if (modalState.id) {
              onChange(vehicles.map((v) => (v.id === modalState.id ? vehicle : v)))
            } else {
              onChange([...vehicles, vehicle])
            }
            setModalState(null)
          }}
        />
      )}

      {deleteError && (
        <p className="mb-3 text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{deleteError}</p>
      )}

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#494847]/30 bg-[#131313] px-6 py-8 text-center">
          <span className="material-symbols-outlined text-3xl text-[#494847] mb-2 block">directions_car</span>
          <p className="text-sm font-semibold text-white">No vehicles registered</p>
          <p className="mt-1 text-xs text-[#adaaaa]">Add at least one vehicle to receive matching delivery jobs.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-3">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center gap-3 bg-[#131313] border border-[#494847]/15 rounded-xl px-4 py-3">
              <span className="text-xl shrink-0">{VEHICLE_INFO[v.vehicle_type].emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {VEHICLE_INFO[v.vehicle_type].label}
                  {(v.make || v.model) && <span className="text-[#adaaaa] font-normal"> — {[v.make, v.model].filter(Boolean).join(" ")}</span>}
                </p>
                <p className="text-[11px] text-[#adaaaa] truncate">
                  {[v.colour, v.registration_number].filter(Boolean).join(" · ") || "No details added"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setModalState({ input: vehicleToInput(v), id: v.id })}
                  className="p-2 rounded-lg text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors"
                  aria-label="Edit vehicle"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  disabled={isPending && deletingId === v.id}
                  className="p-2 rounded-lg text-[#ff6e84]/70 hover:text-[#ff6e84] hover:bg-[#ff6e84]/10 transition-colors disabled:opacity-40"
                  aria-label="Remove vehicle"
                >
                  <span className="material-symbols-outlined text-base">
                    {isPending && deletingId === v.id ? "hourglass_empty" : "delete"}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setModalState({ input: EMPTY_INPUT })}
        className="w-full py-2.5 rounded-xl border border-dashed border-[#494847]/30 text-[var(--color-primary)] font-bold text-sm hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-base">add_circle</span>
        Add Vehicle
      </button>
    </div>
  )
}

