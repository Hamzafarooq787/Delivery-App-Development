"use client"

import { useState, useTransition } from "react"
import { adminApproveDriver, adminRejectDriver } from "@/app/actions/delivery"
import type { PendingVerificationDriver } from "@/app/actions/delivery"
import { DocumentPreviewModal } from "@/components/admin/document-preview-modal"

const DOC_LABELS: Record<string, string> = {
  identity: "Identity",
  insurance: "Insurance",
  vehicle_registration: "Vehicle Reg.",
}

function fmtDate(v: string) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

type Doc = { document_type: string; file_url: string }

function DriverCard({ driver, onRemove }: { driver: PendingVerificationDriver; onRemove: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)

  function handleAction(type: "approve" | "reject") {
    setAction(type)
    setError(null)
    startTransition(async () => {
      const result = type === "approve"
        ? await adminApproveDriver(driver.id)
        : await adminRejectDriver(driver.id)
      if (result.error) { setError(result.error); setAction(null); return }
      onRemove(driver.id)
    })
  }

  const initials = driver.full_name
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "DR"

  return (
    <>
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-[#494847]/10">
          <div className="w-10 h-10 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-[#a3a6ff]">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{driver.full_name}</p>
            <p className="text-xs text-[#adaaaa] truncate">{driver.email}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Submitted</p>
            <p className="text-xs text-white">{fmtDate(driver.submitted_at)}</p>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-[#494847]/10">
          <div>
            <p className="text-[10px] text-[#adaaaa] uppercase font-bold mb-1">Phone</p>
            <p className="text-sm text-white">{driver.phone || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#adaaaa] uppercase font-bold mb-1">Vehicle Type</p>
            <p className="text-sm text-white">{driver.vehicle_type || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#adaaaa] uppercase font-bold mb-1">Plate Number</p>
            <p className="text-sm text-white">{driver.vehicle_number || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#adaaaa] uppercase font-bold mb-1">Documents</p>
            <div className="flex flex-wrap gap-1">
              {["identity", "insurance", "vehicle_registration"].map((type) => {
                const uploaded = driver.documents.some((d) => d.document_type === type)
                return (
                  <span
                    key={type}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      uploaded
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-[#262626] text-[#494847] border border-[#494847]/20"
                    }`}
                  >
                    {DOC_LABELS[type]}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Document preview buttons */}
        {driver.documents.length > 0 && (
          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[#494847]/10">
            {driver.documents.map((doc) => (
              <button
                key={doc.document_type}
                onClick={() => setPreviewDoc(doc)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#262626] border border-[#494847]/20 text-[#adaaaa] hover:text-white hover:border-[#a3a6ff]/30 rounded-lg text-xs font-semibold transition-all"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                {DOC_LABELS[doc.document_type] ?? doc.document_type}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          {error && <p className="text-xs text-[#ff6e84]">{error}</p>}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleAction("reject")}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] font-bold text-xs hover:bg-[#ff6e84]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isPending && action === "reject" ? (
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : (
                <span className="material-symbols-outlined text-sm">cancel</span>
              )}
              Reject
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-xs hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isPending && action === "approve" ? (
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : (
                <span className="material-symbols-outlined text-sm">check_circle</span>
              )}
              Approve
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function VerificationRequestsPanel({ initialDrivers }: { initialDrivers: PendingVerificationDriver[] }) {
  const [drivers, setDrivers] = useState(initialDrivers)

  function handleRemove(id: string) {
    setDrivers((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">
            Verification Requests
          </h1>
          <p className="text-[#adaaaa] mt-1">Review and approve driver verification submissions.</p>
        </div>
        {drivers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#a3a6ff] animate-pulse" />
            <span className="text-xs font-bold text-[#a3a6ff]">{drivers.length} pending</span>
          </div>
        )}
      </div>

      {drivers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#494847]/30 bg-[#1a1919] px-6 py-20 text-center">
          <span className="material-symbols-outlined text-4xl text-[#494847] mb-3 block">verified_user</span>
          <p className="text-base font-semibold text-white">No pending requests</p>
          <p className="mt-1 text-sm text-[#adaaaa]">All driver submissions have been reviewed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  )
}
