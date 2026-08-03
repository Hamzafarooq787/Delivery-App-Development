"use client"

import { useState, useTransition } from "react"
import { adminApproveDriver, adminRejectDriver } from "@/app/actions/delivery"
import type { PendingVerificationDriver } from "@/app/actions/delivery"
import { DocumentPreviewModal } from "@/components/admin/document-preview-modal"
import { VEHICLE_INFO } from "@/lib/vehicles"

const DOC_TYPES = [
  { type: "identity",            label: "Identity",       icon: "badge",   color: "text-[#a3a6ff]", bg: "bg-[#a3a6ff]/10", border: "border-[#a3a6ff]/20" },
  { type: "insurance",           label: "Insurance",      icon: "shield",  color: "text-[#c180ff]", bg: "bg-[#c180ff]/10", border: "border-[#c180ff]/20" },
  { type: "vehicle_registration",label: "Vehicle Reg.",   icon: "commute", color: "text-[#a3a6ff]", bg: "bg-[#a3a6ff]/10", border: "border-[#a3a6ff]/20" },
]

function fmtDate(v: string) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url)
}

type Doc = { document_type: string; file_url: string }
type DocStatus = "pending" | "approved" | "rejected"

function DocumentCard({
  docType, label, icon, color, bg, border,
  doc, status, onPreview, onApprove, onReject,
}: {
  docType: string; label: string; icon: string; color: string; bg: string; border: string
  doc: Doc | undefined
  status: DocStatus
  onPreview: (doc: Doc) => void
  onApprove: () => void
  onReject: () => void
}) {
  const uploaded = !!doc
  const img = doc ? isImage(doc.file_url) : false

  const borderClass =
    status === "approved" ? "border-green-500/40" :
    status === "rejected" ? "border-[#ff6e84]/40" :
    uploaded ? "border-[#494847]/15" : "border-dashed border-[#494847]/20"

  return (
    <div className={`rounded-xl border ${borderClass} bg-[#131313] overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#494847]/10">
        <div className={`w-6 h-6 rounded-md ${bg} border ${border} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-xs ${color}`}>{icon}</span>
        </div>
        <p className="text-[11px] font-bold text-white flex-1 truncate">{label}</p>
        {status === "approved" && (
          <span className="text-[9px] font-black text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Approved</span>
        )}
        {status === "rejected" && (
          <span className="text-[9px] font-black text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Rejected</span>
        )}
        {status === "pending" && !uploaded && (
          <span className="text-[9px] font-bold text-[#494847] bg-[#1a1919] border border-[#494847]/20 px-1.5 py-0.5 rounded-full">Missing</span>
        )}
      </div>

      {/* Preview */}
      <div className="relative bg-[#0e0e0e] h-[110px] flex items-center justify-center overflow-hidden">
        {uploaded ? (
          img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={doc!.file_url} alt={label} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center px-2">
              <span className="material-symbols-outlined text-3xl text-[#494847]">picture_as_pdf</span>
              <p className="text-[10px] text-[#494847]">PDF — click Preview</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center px-2">
            <span className={`material-symbols-outlined text-3xl ${color} opacity-15`}>{icon}</span>
            <p className="text-[10px] text-[#494847]">Not uploaded</p>
          </div>
        )}

        {/* Approved overlay */}
        {status === "approved" && (
          <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-green-400 opacity-60">check_circle</span>
          </div>
        )}
        {/* Rejected overlay */}
        {status === "rejected" && (
          <div className="absolute inset-0 bg-[#ff6e84]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-[#ff6e84] opacity-60">cancel</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {uploaded && (
        <div className="px-2 py-2 border-t border-[#494847]/10 flex flex-col gap-1.5">
          {/* Preview + Download row */}
          <div className="flex gap-1.5">
            <button
              onClick={() => onPreview(doc!)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#262626] border border-[#494847]/20 text-[#adaaaa] hover:text-white rounded-lg text-[10px] font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-xs">visibility</span>Preview
            </button>
            <a
              href={doc!.file_url}
              onClick={async (e) => {
                e.preventDefault()
                try {
                  const res = await fetch(doc!.file_url)
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url; a.download = `${docType}-document`; a.click()
                  URL.revokeObjectURL(url)
                } catch { window.open(doc!.file_url, "_blank") }
              }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] hover:bg-[#a3a6ff]/20 rounded-lg text-[10px] font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-xs">download</span>Download
            </a>
          </div>

          {/* Per-doc approve / reject */}
          <div className="flex gap-1.5">
            <button
              onClick={onReject}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                status === "rejected"
                  ? "bg-[#ff6e84]/20 border-[#ff6e84]/40 text-[#ff6e84]"
                  : "bg-transparent border-[#ff6e84]/20 text-[#ff6e84]/60 hover:bg-[#ff6e84]/10 hover:text-[#ff6e84]"
              }`}
            >
              <span className="material-symbols-outlined text-xs">thumb_down</span>Reject
            </button>
            <button
              onClick={onApprove}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                status === "approved"
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-transparent border-green-500/20 text-green-400/60 hover:bg-green-500/10 hover:text-green-400"
              }`}
            >
              <span className="material-symbols-outlined text-xs">thumb_up</span>Approve
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DriverCard({ driver, onRemove }: { driver: PendingVerificationDriver; onRemove: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [docStatuses, setDocStatuses] = useState<Record<string, DocStatus>>({})

  const docMap = new Map(driver.documents.map((d) => [d.document_type, d]))
  const initials = driver.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "DR"

  const uploadedTypes = DOC_TYPES.filter((c) => docMap.has(c.type))
  const allApproved = uploadedTypes.length > 0 && uploadedTypes.every((c) => docStatuses[c.type] === "approved")

  function setDocStatus(type: string, status: DocStatus) {
    setDocStatuses((prev) => ({ ...prev, [type]: status }))
  }

  function approveAllDocs() {
    const next: Record<string, DocStatus> = {}
    uploadedTypes.forEach((c) => { next[c.type] = "approved" })
    setDocStatuses(next)
  }

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

  return (
    <>
      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#494847]/10">
          <div className="w-9 h-9 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[#a3a6ff]">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{driver.full_name}</p>
            <p className="text-xs text-[#adaaaa] truncate">{driver.email}</p>
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-3 text-right shrink-0">
            <div>
              <p className="text-[9px] text-[#adaaaa] uppercase font-bold">Phone</p>
              <p className="text-xs text-white">{driver.phone || "—"}</p>
            </div>
            <div>
              <p className="text-[9px] text-[#adaaaa] uppercase font-bold">Vehicles</p>
              <p className="text-xs text-white">
                {driver.vehicles.length > 0
                  ? driver.vehicles.map((v) => VEHICLE_INFO[v.vehicle_type].label).join(", ")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-[#adaaaa] uppercase font-bold">Submitted</p>
              <p className="text-xs text-white">{fmtDate(driver.submitted_at)}</p>
            </div>
          </div>
        </div>

        {/* Vehicles */}
        <div className="px-4 pt-3.5 pb-1">
          <p className="text-[10px] text-[#adaaaa] uppercase font-bold tracking-widest mb-3">Vehicles</p>
          {driver.vehicles.length === 0 ? (
            <p className="text-xs text-[#adaaaa] pb-2">No vehicles registered.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
              {driver.vehicles.map((v) => (
                <div key={v.id} className="flex items-start gap-2.5 bg-[#131313] border border-[#494847]/15 rounded-lg px-3 py-2.5">
                  <span className="text-base shrink-0">{VEHICLE_INFO[v.vehicle_type].emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {VEHICLE_INFO[v.vehicle_type].label}
                      {(v.make || v.model) && <span className="text-[#adaaaa] font-normal"> — {[v.make, v.model].filter(Boolean).join(" ")}</span>}
                    </p>
                    <p className="text-[10px] text-[#adaaaa] truncate">
                      {[v.colour, v.registration_number].filter(Boolean).join(" · ") || "No details"}
                    </p>
                    {(v.driving_licence_details || v.insurance_details) && (
                      <p className="text-[10px] text-[#adaaaa]/70 truncate mt-0.5">
                        {v.driving_licence_details && `Licence: ${v.driving_licence_details}`}
                        {v.driving_licence_details && v.insurance_details && " · "}
                        {v.insurance_details && `Insurance: ${v.insurance_details}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document cards */}
        <div className="px-4 pt-3.5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-[#adaaaa] uppercase font-bold tracking-widest">Documents</p>
            {uploadedTypes.length > 0 && (
              <button
                onClick={approveAllDocs}
                disabled={allApproved}
                className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold rounded-full hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-xs">done_all</span>
                {allApproved ? "All Approved" : "Approve All Docs"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {DOC_TYPES.map((cfg) => (
              <DocumentCard
                key={cfg.type}
                docType={cfg.type}
                label={cfg.label}
                icon={cfg.icon}
                color={cfg.color}
                bg={cfg.bg}
                border={cfg.border}
                doc={docMap.get(cfg.type)}
                status={docStatuses[cfg.type] ?? "pending"}
                onPreview={setPreviewDoc}
                onApprove={() => setDocStatus(cfg.type, "approved")}
                onReject={() => setDocStatus(cfg.type, "rejected")}
              />
            ))}
          </div>
        </div>

        {/* Driver-level approve / reject */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-[#494847]/10 mt-2">
          {error && <p className="text-xs text-[#ff6e84]">{error}</p>}
          <p className="text-[10px] text-[#adaaaa] hidden sm:block">
            {allApproved ? "All documents approved — ready to approve driver." : "Review each document above, then approve or reject the driver."}
          </p>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleAction("reject")}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] font-bold text-xs hover:bg-[#ff6e84]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isPending && action === "reject"
                ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <span className="material-symbols-outlined text-sm">cancel</span>}
              Reject Driver
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={isPending}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 border ${
                allApproved
                  ? "bg-green-500 border-green-500 text-white shadow-[0_0_15px_rgba(74,222,128,0.3)]"
                  : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
              }`}
            >
              {isPending && action === "approve"
                ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <span className="material-symbols-outlined text-sm">check_circle</span>}
              Approve Driver
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function VerificationRequestsPanel({ initialDrivers }: { initialDrivers: PendingVerificationDriver[] }) {
  const [drivers, setDrivers] = useState(initialDrivers)

  return (
    <div className="px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">Verification Requests</h1>
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
            <DriverCard key={driver.id} driver={driver} onRemove={(id) => setDrivers((p) => p.filter((d) => d.id !== id))} />
          ))}
        </div>
      )}
    </div>
  )
}
