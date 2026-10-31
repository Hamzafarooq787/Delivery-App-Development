"use client"

import {ukDate} from "@/lib/admin-operations"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { adminApproveDriver, adminRejectDriver } from "@/app/actions/delivery"
import { getDriverDocumentsById } from "@/app/actions/documents"
import { AddDriverModal } from "@/components/admin/add-driver-modal"
import { DocumentPreviewModal } from "@/components/admin/document-preview-modal"
import type { DriverDocument } from "@/app/actions/documents"

type Tab = "approved" | "pending" | "rejected"

export type DriverRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
  status: "pending" | "approved" | "rejected"
}

type Doc = { document_type: string; file_url: string }

const DOC_CONFIGS = [
  { type: "identity",             label: "Identity",     icon: "badge",   color: "text-[var(--brand-soft)]", bg: "bg-[var(--brand-strong)]/10" },
  { type: "insurance",            label: "Insurance",    icon: "shield",  color: "text-[var(--color-secondary)]", bg: "bg-[var(--color-secondary)]/10" },
  { type: "vehicle_registration", label: "Vehicle Reg.", icon: "commute", color: "text-[var(--brand-soft)]", bg: "bg-[var(--brand-strong)]/10" },
]

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url)
}

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
}

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved")
    return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Approved</span>
  if (status === "rejected")
    return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-[#ff6e84]/10 text-[#ff6e84] border border-[#ff6e84]/20 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-[#ff6e84]" />Rejected</span>
  return <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border border-[var(--brand-strong)]/20 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-strong)] animate-pulse" />Pending</span>
}

function DocPreviewCard({ doc, onOpen }: { doc: DriverDocument; onOpen: (d: Doc) => void }) {
  const cfg = DOC_CONFIGS.find((c) => c.type === doc.document_type)
  const img = isImage(doc.file_url)

  return (
    <div
      onClick={() => onOpen({ document_type: doc.document_type, file_url: doc.file_url })}
      className="rounded-xl border border-[var(--color-outline-variant)]/15 bg-[var(--brand-bg)] overflow-hidden cursor-pointer hover:border-[var(--brand-strong)]/30 transition-all group"
    >
      {/* Thumbnail */}
      <div className="h-[90px] relative flex items-center justify-center overflow-hidden">
        {img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={doc.file_url} alt={cfg?.label ?? doc.document_type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span className="material-symbols-outlined text-4xl text-[var(--color-outline-variant)]">picture_as_pdf</span>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-2xl drop-shadow">zoom_in</span>
        </div>
      </div>
      {/* Label */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 border-t border-[var(--color-outline-variant)]/10 ${cfg?.bg ?? "bg-[var(--color-surface-container-highest)]/50"}`}>
        <span className={`material-symbols-outlined text-xs ${cfg?.color ?? "text-[var(--color-on-surface-variant)]"}`}>{cfg?.icon ?? "description"}</span>
        <p className={`text-[9px] font-bold uppercase tracking-wider truncate ${cfg?.color ?? "text-[var(--color-on-surface-variant)]"}`}>{cfg?.label ?? doc.document_type}</p>
      </div>
    </div>
  )
}

export function DriversPanel({ drivers }: { drivers: DriverRow[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("approved")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showAddModal, setShowAddModal] = useState(false)
  const [documents, setDocuments] = useState<DriverDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Sort: approved first, then by name
  const sorted = [...drivers].sort((a, b) => {
    const order = { approved: 0, pending: 1, rejected: 2 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return a.full_name.localeCompare(b.full_name)
  })

  const filtered = sorted.filter((d) => d.status === activeTab)
  const pendingCount = drivers.filter((d) => d.status === "pending").length
  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null

  // Fetch documents whenever selected driver changes
  useEffect(() => {
    if (!selected) { setDocuments([]); return }
    setLoadingDocs(true)
    getDriverDocumentsById(selected.id).then((docs) => {
      setDocuments(docs)
      setLoadingDocs(false)
    })
  }, [selected?.id])

  function handleApprove() {
    if (!selected || isPending) return
    setActionError(null)
    startTransition(async () => {
      const result = await adminApproveDriver(selected.id)
      if (result.error) { setActionError(result.error); return }
      setSelectedId(null)
      router.refresh()
    })
  }

  function handleReject() {
    if (!selected || isPending) return
    setActionError(null)
    startTransition(async () => {
      const result = await adminRejectDriver(selected.id,window.prompt("Reason for rejecting this driver:")??undefined)
      if (result.error) { setActionError(result.error); return }
      setSelectedId(null)
      router.refresh()
    })
  }

  return (
    <div className="p-4 md:p-8">
      {showAddModal && <AddDriverModal onClose={() => setShowAddModal(false)} />}
      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-sans">Driver Onboarding</h2>
          <p className="text-[var(--color-on-surface-variant)] mt-1 text-sm">Manage and verify fleet operator applications.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto bg-[var(--brand-strong)] text-[var(--brand-ink)] px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Manual Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-[var(--color-outline-variant)]/20">
        {(["approved", "pending", "rejected"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedId(null) }}
            className={`pb-4 text-sm font-semibold transition-all capitalize flex items-center gap-2 ${
              activeTab === tab ? "border-b-2 border-[var(--brand-strong)] text-white" : "text-[var(--color-on-surface-variant)] hover:text-white"
            }`}
          >
            {tab === "pending" ? "Pending Approval" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "pending" && pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] text-[10px] font-black">{pendingCount}</span>
            )}
            <span className="text-[10px] text-[var(--color-outline-variant)]">({drivers.filter((d) => d.status === tab).length})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Driver list */}
        <div className="col-span-1 lg:col-span-7">
          {filtered.length === 0 ? (
            <p className="text-[var(--color-on-surface-variant)] text-sm py-8 text-center">No {activeTab} drivers.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((driver) => {
                const isSelected = driver.id === (selected?.id ?? null)
                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedId(driver.id)}
                    className={`group flex items-center p-4 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-surface-container-high)] border border-[var(--brand-strong)]/20 ring-1 ring-[var(--brand-strong)]/10"
                        : "bg-[var(--brand-panel)] hover:bg-[var(--color-surface-container-high)] border border-transparent hover:border-[var(--color-outline-variant)]/10"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--color-secondary-container)]/20 flex items-center justify-center text-[var(--color-secondary)] font-bold text-sm shrink-0">
                      {getInitials(driver.full_name)}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{driver.full_name}</h4>
                      <p className="text-xs text-[var(--color-on-surface-variant)] truncate">{driver.email}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 mr-3 shrink-0">
                      <StatusPill status={driver.status} />
                      <p className="text-[10px] text-[var(--color-outline-variant)]">
                        {new Date(driver.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-lg transition-colors shrink-0 ${isSelected ? "text-[var(--brand-soft)]" : "text-[var(--color-outline-variant)] group-hover:text-[var(--brand-soft)]"}`}>
                      chevron_right
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="col-span-1 lg:col-span-5">
          {selected ? (
            <div
              className="sticky top-24 rounded-2xl border border-[var(--color-outline-variant)]/15 overflow-hidden shadow-2xl"
              style={{ background: "var(--brand-panel)", backdropFilter: "blur(40px)" }}
            >
              {/* Cover + avatar */}
              <div className="relative h-28 bg-gradient-to-br from-[var(--color-surface-container-highest)] to-[var(--brand-bg)] overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 60% 50%, var(--brand-strong) 0%, transparent 70%)" }} />
                <div className="absolute -bottom-8 left-5 w-16 h-16 rounded-2xl bg-[var(--color-secondary-container)]/20 border-4 border-[var(--brand-panel)] flex items-center justify-center text-[var(--color-secondary)] font-black text-xl shadow-xl">
                  {getInitials(selected.full_name)}
                </div>
              </div>

              <div className="px-5 pt-10 pb-5">
                {/* Name + status + contact icons */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white truncate">{selected.full_name}</h3>
                    <div className="mt-1"><StatusPill status={selected.status} /></div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={`mailto:${selected.email}`}
                      className="p-2 rounded-lg bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-[var(--brand-soft)] hover:border-[var(--brand-strong)]/30 transition-all"
                      title={`Email ${selected.full_name}`}
                    >
                      <span className="material-symbols-outlined text-lg">mail</span>
                    </a>
                    {selected.phone && (
                      <a
                        href={`tel:${selected.phone}`}
                        className="p-2 rounded-lg bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-[var(--brand-soft)] hover:border-[var(--brand-strong)]/30 transition-all"
                        title={`Call ${selected.full_name}`}
                      >
                        <span className="material-symbols-outlined text-lg">phone</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="bg-[var(--brand-bg)] rounded-xl px-3 py-2.5 border border-[var(--color-outline-variant)]/10">
                    <p className="text-[9px] text-[var(--color-on-surface-variant)] uppercase font-bold mb-0.5">Email</p>
                    <p className="text-xs font-semibold text-white truncate">{selected.email || "—"}</p>
                  </div>
                  <div className="bg-[var(--brand-bg)] rounded-xl px-3 py-2.5 border border-[var(--color-outline-variant)]/10">
                    <p className="text-[9px] text-[var(--color-on-surface-variant)] uppercase font-bold mb-0.5">Phone</p>
                    <p className="text-xs font-semibold text-white">{selected.phone ?? "—"}</p>
                  </div>
                </div>

                {/* Documents */}
                <div className="mb-5">
                  <p className="text-[9px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-bold mb-3">
                    Verified Documents
                    {documents.length > 0 && <span className="ml-1.5 text-[var(--brand-soft)]">({documents.length})</span>}
                  </p>
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-6">
                      <svg className="animate-spin w-5 h-5 text-[var(--brand-soft)]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/20 py-6 text-center">
                      <span className="material-symbols-outlined text-2xl text-[var(--color-outline-variant)] block mb-1">folder_open</span>
                      <p className="text-xs text-[var(--color-outline-variant)]">No documents uploaded</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {documents.map((doc) => (
                        <DocPreviewCard
                          key={doc.id}
                          doc={doc}
                          onOpen={setPreviewDoc}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {actionError && (
                  <p className="text-xs font-bold text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-lg px-3 py-2 -mt-1">
                    {actionError}
                  </p>
                )}
                <div className="flex gap-2 pt-3 border-t border-[var(--color-outline-variant)]/10">
                  <button
                    onClick={handleReject}
                    disabled={isPending || selected.status === "rejected"}
                    className="flex-1 py-2.5 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] font-bold text-xs hover:bg-[#ff6e84]/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isPending || selected.status === "approved"}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-xs hover:bg-[var(--color-primary-fixed-dim)] shadow-[0_0_12px_rgba(var(--brand-rgb),0.2)] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="sticky top-24 rounded-2xl border border-[var(--color-outline-variant)]/15 p-8 text-center"
              style={{ background: "var(--brand-panel)", backdropFilter: "blur(40px)" }}
            >
              <span className="material-symbols-outlined text-3xl text-[var(--color-outline-variant)] block mb-2">person_search</span>
              <p className="text-[var(--color-on-surface-variant)] text-sm">Select a driver to view their profile and documents.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

