"use client"

import { useState, useTransition } from "react"
import { adminApproveDriver, adminRejectDriver } from "@/app/actions/delivery"
import type { PendingVerificationDriver } from "@/app/actions/delivery"
import { DocumentPreviewModal } from "@/components/admin/document-preview-modal"

const DOC_TYPES = [
  { type: "identity", label: "Identity Verification", icon: "badge", color: "text-[#a3a6ff]", bg: "bg-[#a3a6ff]/10", border: "border-[#a3a6ff]/20" },
  { type: "insurance", label: "Insurance Policy", icon: "shield", color: "text-[#c180ff]", bg: "bg-[#c180ff]/10", border: "border-[#c180ff]/20" },
  { type: "vehicle_registration", label: "Vehicle Registration", icon: "commute", color: "text-[#a3a6ff]", bg: "bg-[#a3a6ff]/10", border: "border-[#a3a6ff]/20" },
]

function fmtDate(v: string) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url)
}

type Doc = { document_type: string; file_url: string }

function DocumentCard({
  docType,
  label,
  icon,
  color,
  bg,
  border,
  doc,
  onPreview,
}: {
  docType: string
  label: string
  icon: string
  color: string
  bg: string
  border: string
  doc: Doc | undefined
  onPreview: (doc: Doc) => void
}) {
  const uploaded = !!doc
  const img = doc ? isImage(doc.file_url) : false

  return (
    <div className={`rounded-xl border ${uploaded ? "border-[#494847]/15" : "border-dashed border-[#494847]/25"} bg-[#131313] overflow-hidden flex flex-col`}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#494847]/10">
        <div className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{label}</p>
        </div>
        {uploaded ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-xs">check</span>
            Uploaded
          </span>
        ) : (
          <span className="text-[10px] font-bold text-[#494847] bg-[#262626] border border-[#494847]/20 px-2 py-0.5 rounded-full">
            Missing
          </span>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 relative bg-[#0e0e0e] min-h-[200px] flex items-center justify-center">
        {uploaded ? (
          img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={doc!.file_url}
              alt={label}
              className="w-full h-[200px] object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
              <span className="material-symbols-outlined text-4xl text-[#494847]">picture_as_pdf</span>
              <p className="text-xs text-[#adaaaa]">PDF Document</p>
              <p className="text-[10px] text-[#494847]">Click Preview to view</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            <span className={`material-symbols-outlined text-4xl ${color} opacity-20`}>{icon}</span>
            <p className="text-xs text-[#494847]">Not uploaded yet</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {uploaded && (
        <div className="px-4 py-3 border-t border-[#494847]/10 flex gap-2">
          <button
            onClick={() => onPreview(doc!)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#262626] border border-[#494847]/20 text-[#adaaaa] hover:text-white hover:border-[#a3a6ff]/30 rounded-lg text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            Preview
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
                a.href = url
                a.download = `${docType}-document`
                a.click()
                URL.revokeObjectURL(url)
              } catch {
                window.open(doc!.file_url, "_blank")
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] hover:bg-[#a3a6ff]/20 rounded-lg text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download
          </a>
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

  const docMap = new Map(driver.documents.map((d) => [d.document_type, d]))
  const initials = driver.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "DR"

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

        {/* Driver details */}
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-4 border-b border-[#494847]/10">
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
        </div>

        {/* Document preview cards — always show all 3 slots */}
        <div className="px-5 py-5 border-b border-[#494847]/10">
          <p className="text-[10px] text-[#adaaaa] uppercase font-bold tracking-widest mb-4">Submitted Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                onPreview={setPreviewDoc}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          {error && <p className="text-xs text-[#ff6e84]">{error}</p>}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={() => handleAction("reject")}
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] font-bold text-sm hover:bg-[#ff6e84]/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && action === "reject" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : (
                <span className="material-symbols-outlined text-base">cancel</span>
              )}
              Reject
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && action === "approve" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : (
                <span className="material-symbols-outlined text-base">check_circle</span>
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
        <div className="flex flex-col gap-6">
          {drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  )
}
