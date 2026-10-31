"use client"

import { useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { recordDriverDocument, submitForReview } from "@/app/actions/documents"
import type { DriverDocument } from "@/app/actions/documents"
import type { DriverVehicle } from "@/app/actions/vehicles"
import { VehicleManager } from "@/components/driver/vehicle-manager"

type DocType = "identity" | "insurance" | "vehicle_registration" | "selfie"
type DriverStatus = "pending" | "approved" | "rejected"

const DOC_CONFIGS: {
  type: DocType
  label: string
  description: string
  icon: string
  iconColor: string
  iconBg: string
}[] = [
  {
    type: "identity",
    label: "Identity Verification",
    description: "Passport or Commercial Driver's License — all four corners visible, text legible.",
    icon: "badge",
    iconColor: "text-[var(--brand-soft)]",
    iconBg: "bg-[var(--brand-strong)]/20",
  },
  {
    type: "selfie",
    label: "Selfie Verification",
    description: "A clear photo of your face, taken live, matching your ID document.",
    icon: "face",
    iconColor: "text-[#6ee7b7]",
    iconBg: "bg-[#6ee7b7]/20",
  },
  {
    type: "insurance",
    label: "Insurance Policy",
    description: "Current active commercial insurance certificate.",
    icon: "shield",
    iconColor: "text-[var(--color-secondary)]",
    iconBg: "bg-[var(--color-secondary-container)]/20",
  },
  {
    type: "vehicle_registration",
    label: "Vehicle Registration",
    description: "Official registration documents for your primary logistics vehicle.",
    icon: "commute",
    iconColor: "text-[var(--brand-soft)]",
    iconBg: "bg-[var(--brand-strong)]/20",
  },
]

function statusBadge(s: DriverStatus) {
  if (s === "approved")
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full text-[11px] font-bold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Approved
      </div>
    )
  if (s === "rejected")
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#a70138]/20 text-[#ff6e84] rounded-full text-[11px] font-bold uppercase tracking-wider">
        <span className="material-symbols-outlined text-sm">error</span>
        Rejected
      </div>
    )
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] rounded-full text-[11px] font-bold uppercase tracking-wider">
      <span className="material-symbols-outlined text-sm">schedule</span>
      Pending Review
    </div>
  )
}

export function VerificationPanel({
  driverStatus: initialStatus,
  documents: initialDocs,
  vehicles: initialVehicles,
  userId,
}: {
  driverStatus: DriverStatus
  documents: DriverDocument[]
  vehicles: DriverVehicle[]
  userId: string
}) {
  const [driverStatus, setDriverStatus] = useState<DriverStatus>(initialStatus)
  const [docs, setDocs] = useState<DriverDocument[]>(initialDocs)
  const [vehicles, setVehicles] = useState<DriverVehicle[]>(initialVehicles)
  const [uploading, setUploading] = useState<DocType | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitPending, startSubmitTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)

  const fileInputRefs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({})

  const docMap = new Map(docs.map((d) => [d.document_type, d]))
  const uploadedCount = DOC_CONFIGS.filter((c) => docMap.has(c.type)).length
  const hasVehicle = vehicles.length > 0
  // Vehicle registration counts as one extra "step" alongside the 3 document types
  const totalSteps = DOC_CONFIGS.length + 1
  const completedSteps = uploadedCount + (hasVehicle ? 1 : 0)
  const pct =
    driverStatus === "approved" ? 100 : Math.round((completedSteps / totalSteps) * 66) + (driverStatus === "rejected" ? 0 : completedSteps > 0 ? 10 : 0)

  async function handleUpload(docType: DocType, file: File) {
    setUploadError(null)
    setUploading(docType)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop() ?? "pdf"
      const path = `${userId}/${docType}-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from("driver-documents")
        .upload(path, file, { upsert: true })

      if (uploadErr) {
        setUploadError(`Upload failed: ${uploadErr.message}`)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from("driver-documents").getPublicUrl(path)

      const result = await recordDriverDocument(docType, publicUrl)
      if (result.error) {
        setUploadError(result.error)
        return
      }

      // Optimistically update local docs list
      setDocs((prev) => {
        const filtered = prev.filter((d) => d.document_type !== docType)
        return [
          ...filtered,
          { id: Date.now().toString(), document_type: docType, file_url: URL.createObjectURL(file), created_at: new Date().toISOString() },
        ]
      })
    } finally {
      setUploading(null)
    }
  }

  function handleFileChange(docType: DocType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(docType, file)
    e.target.value = ""
  }

  function handleSubmit() {
    startSubmitTransition(async () => {
      const result = await submitForReview()
      if (result.error) {
        setUploadError(result.error)
        return
      }
      setDriverStatus("pending")
      setSubmitted(true)
    })
  }

  const canSubmit = uploadedCount > 0 && hasVehicle && driverStatus !== "approved"

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white mb-2">
          Driver Verification
        </h2>
        <p className="text-[var(--color-on-surface-variant)] max-w-2xl leading-relaxed">
          Upload your compliance documents below. Once submitted, our team typically reviews within 24 hours.
        </p>
        <p className="mt-2 text-sm text-[var(--brand-soft)]">
          Changing approved documents or vehicles requires another review. Finish any active delivery first.
        </p>
      </div>

      {uploadError && (
        <div className="mb-6 flex items-start gap-3 bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-[#ff6e84] shrink-0 mt-0.5">error</span>
          <p className="text-[#ff6e84] text-sm">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="ml-auto shrink-0 text-[#ff6e84]/60 hover:text-[#ff6e84]">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {submitted && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-green-400">check_circle</span>
          <p className="text-green-400 text-sm font-medium">Documents submitted for review. The admin team will verify within 24 hours.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Status Overview */}
        <div className="md:col-span-4 bg-[var(--brand-panel)] backdrop-blur-xl p-6 rounded-xl flex flex-col justify-between border border-[var(--color-outline-variant)]/15">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[var(--brand-soft)] uppercase mb-4">Overall Status</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black font-headline text-white">
                {driverStatus === "approved" ? 100 : pct}%
              </span>
              <span className="text-[var(--color-on-surface-variant)]">Complete</span>
            </div>
            <div className="mt-3">{statusBadge(driverStatus)}</div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="w-full h-1.5 bg-[var(--brand-panel)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${driverStatus === "approved" ? "bg-green-400" : "bg-[var(--brand-strong)]"}`}
                style={{ width: `${driverStatus === "approved" ? 100 : pct}%`, boxShadow: "0px 0px 15px rgba(var(--brand-rgb),0.2)" }}
              />
            </div>
            <p className="text-xs text-[var(--color-on-surface-variant)] italic">
              {driverStatus === "approved"
                ? "All documents verified. You are fully operational."
                : driverStatus === "rejected"
                ? "One or more documents require re-submission."
                : completedSteps === 0
                ? "Register a vehicle and upload your documents to begin verification."
                : `${completedSteps} of ${totalSteps} steps complete.`}
            </p>

            {/* Checklist */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs">
                <span className={`material-symbols-outlined text-sm ${hasVehicle ? "text-green-400" : "text-[var(--color-outline-variant)]"}`}>
                  {hasVehicle ? "check_circle" : "radio_button_unchecked"}
                </span>
                <span className={hasVehicle ? "text-white" : "text-[var(--color-on-surface-variant)]"}>Vehicle registered</span>
              </div>
              {DOC_CONFIGS.map((c) => {
                const uploaded = docMap.has(c.type)
                return (
                  <div key={c.type} className="flex items-center gap-2 text-xs">
                    <span className={`material-symbols-outlined text-sm ${uploaded ? "text-green-400" : "text-[var(--color-outline-variant)]"}`}>
                      {uploaded ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span className={uploaded ? "text-white" : "text-[var(--color-on-surface-variant)]"}>{c.label}</span>
                  </div>
                )
              })}
            </div>


          </div>
        </div>

        {/* Vehicle + document upload cards */}
        <div className="md:col-span-8 space-y-4">
          <div className="bg-[var(--brand-panel)] backdrop-blur-xl p-5 md:p-6 rounded-xl border border-[var(--color-outline-variant)]/15">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-strong)]/20 flex items-center justify-center text-[var(--brand-soft)] shrink-0">
                <span className="material-symbols-outlined">directions_car</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Vehicle Information</h3>
                <p className="text-[var(--color-on-surface-variant)] text-xs">Add at least one vehicle — you can register more later from Settings.</p>
              </div>
            </div>
            <VehicleManager vehicles={vehicles} onChange={setVehicles} />
          </div>

          {DOC_CONFIGS.map((config) => {
            const existing = docMap.get(config.type)
            const isUploading = uploading === config.type
            const fileName = existing ? decodeURIComponent(existing.file_url.split("/").pop() ?? "").replace(/^\d+-/, "") : null

            return (
              <div
                key={config.type}
                className="bg-[var(--brand-panel)] backdrop-blur-xl p-5 md:p-6 rounded-xl border border-[var(--color-outline-variant)]/15"
              >
                <input
                  ref={(el) => { fileInputRefs.current[config.type] = el }}
                  type="file"
                  accept={config.type === "selfie" ? "image/*" : ".pdf,.jpg,.jpeg,.png,.webp"}
                  capture={config.type === "selfie" ? "user" : undefined}
                  className="hidden"
                  onChange={(e) => handleFileChange(config.type, e)}
                />

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center ${config.iconColor} shrink-0`}>
                    <span className="material-symbols-outlined">{config.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">{config.label}</h3>
                      {existing && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">check</span>
                          Uploaded
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--color-on-surface-variant)] text-xs">{config.description}</p>
                    {fileName && (
                      <p className="mt-1 text-[10px] text-[var(--color-on-surface-variant)] font-mono truncate">
                        📎 {fileName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {existing && (
                      <a
                        href={existing.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        View
                      </a>
                    )}
                    <button
                      onClick={() => fileInputRefs.current[config.type]?.click()}
                      disabled={isUploading || driverStatus === "approved"}
                      className="px-4 py-2 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-xs rounded-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      style={{ boxShadow: "0px 0px 10px rgba(var(--brand-rgb),0.15)" }}
                    >
                      {isUploading ? (
                        <>
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">upload</span>
                          {existing ? "Re-upload" : "Upload"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {driverStatus === "rejected" && (
                  <div className="mt-4 p-3 bg-[#a70138]/10 border-l-2 border-[#ff6e84] rounded-r-lg">
                    <p className="text-xs text-[#ff6e84] font-medium">
                      This document was rejected. Please re-upload a clearer copy.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
            {canSubmit && (
              <button
                onClick={handleSubmit}
                disabled={submitPending}
                className="w-full mt-2 py-3 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ boxShadow: "0px 0px 15px rgba(var(--brand-rgb),0.2)" }}
              >
                {submitPending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">send</span>
                    Submit for Review
                  </>
                )}
              </button>
            )}
        </div>

        {/* Support Banner */}
        <div className="md:col-span-12 mt-4">
          <div className="relative overflow-hidden rounded-2xl bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/10 p-1">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-strong)]/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none" />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between p-5 md:p-8 gap-5 md:gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--brand-soft)] text-3xl">support_agent</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Having trouble with verification?</h4>
                  <p className="text-[var(--color-on-surface-variant)] text-sm">
                    Our compliance specialists are available 24/7 to assist with document formatting and regional requirements.
                  </p>
                </div>
              </div>
              <a
                href="/dashboard/driver/support"
                className="px-8 py-3 bg-[var(--color-surface-container-highest)] text-white font-bold text-sm rounded-lg hover:bg-[var(--color-surface-bright)] transition-all whitespace-nowrap"
              >
                Open Support Ticket
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

