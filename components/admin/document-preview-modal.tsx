"use client"

import { useEffect } from "react"

const DOC_LABELS: Record<string, string> = {
  identity: "Identity / Driving Licence",
  insurance: "Insurance Policy",
  vehicle_registration: "Vehicle Registration",
}

type Doc = { document_type: string; file_url: string }

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url)
}

async function triggerDownload(url: string, filename: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, "_blank")
  }
}

export function DocumentPreviewModal({
  doc,
  onClose,
}: {
  doc: Doc
  onClose: () => void
}) {
  const label = DOC_LABELS[doc.document_type] ?? doc.document_type
  const img = isImage(doc.file_url)
  const filename = `${doc.document_type}-${Date.now()}.${img ? "jpg" : "pdf"}`

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[#494847]/20 shadow-2xl overflow-hidden bg-[#1a1919] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#a3a6ff]">description</span>
            <div>
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-[10px] text-[#adaaaa] uppercase font-bold tracking-wider">Document Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerDownload(doc.file_url, filename)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#a3a6ff] text-[#0f00a4] font-bold text-xs rounded-lg hover:bg-[#8387ff] transition-all"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#adaaaa] hover:text-white hover:bg-[#262626] rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-[#131313] flex items-center justify-center min-h-[300px]">
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={doc.file_url}
              alt={label}
              className="max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <iframe
              src={doc.file_url}
              title={label}
              className="w-full h-[70vh] border-0"
            />
          )}
        </div>
      </div>
    </div>
  )
}
