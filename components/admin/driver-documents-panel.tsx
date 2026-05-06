"use client"

import { useState } from "react"
import { DocumentPreviewModal } from "@/components/admin/document-preview-modal"
import type { DriverDocument } from "@/app/actions/documents"

const DOC_TYPES = ["identity", "insurance", "vehicle_registration"] as const
const DOC_LABELS: Record<string, string> = {
  identity: "Identity / Driving Licence",
  insurance: "Insurance Policy",
  vehicle_registration: "Vehicle Registration",
}

function fmtDate(v: string) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function DriverDocumentsPanel({ documents }: { documents: DriverDocument[] }) {
  const [previewDoc, setPreviewDoc] = useState<{ document_type: string; file_url: string } | null>(null)

  if (documents.length === 0) {
    return (
      <div className="py-10 text-center">
        <span className="material-symbols-outlined text-3xl text-[#494847] block mb-2">description</span>
        <p className="text-sm text-[#adaaaa]">No documents uploaded yet.</p>
      </div>
    )
  }

  return (
    <>
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {/* Checklist */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DOC_TYPES.map((type) => {
          const uploaded = documents.some((d) => d.document_type === type)
          return (
            <span
              key={type}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ${
                uploaded
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-[#262626] text-[#494847] border border-[#494847]/20"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{uploaded ? "check_circle" : "radio_button_unchecked"}</span>
              {DOC_LABELS[type]}
            </span>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#494847]/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#131313] border-b border-[#494847]/10">
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Document</th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Uploaded</th>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-bold text-[#adaaaa]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#494847]/5">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-[#201f1f]/40 transition-colors">
                <td className="px-5 py-3.5 text-sm font-semibold text-white">
                  {DOC_LABELS[doc.document_type] ?? doc.document_type}
                </td>
                <td className="px-5 py-3.5 text-xs text-[#adaaaa]">{fmtDate(doc.created_at)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewDoc({ document_type: doc.document_type, file_url: doc.file_url })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#262626] border border-[#494847]/20 text-[#adaaaa] hover:text-white hover:border-[#a3a6ff]/30 rounded-lg text-xs font-semibold transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Preview
                    </button>
                    <a
                      href={doc.file_url}
                      download
                      onClick={async (e) => {
                        e.preventDefault()
                        try {
                          const res = await fetch(doc.file_url)
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url
                          a.download = `${doc.document_type}-${doc.id.slice(0, 8)}`
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          window.open(doc.file_url, "_blank")
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] hover:bg-[#a3a6ff]/20 rounded-lg text-xs font-semibold transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Download
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
