"use client"

import { useEffect } from "react"
import { useState } from "react"

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

export function DocumentPreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const label = DOC_LABELS[doc.document_type] ?? doc.document_type
  const img = isImage(doc.file_url)
  const filename = `${doc.document_type}-${Date.now()}.${img ? "jpg" : "pdf"}`
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4))
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25))
      if (e.key === "0") setZoom(1)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl overflow-hidden bg-[var(--brand-panel)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-outline-variant)]/15 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--brand-soft)]">description</span>
            <div>
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold tracking-wider">Document Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls (images only) */}
            {img && (
              <div className="flex items-center gap-1 bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 rounded-lg px-1">
                <button
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                  disabled={zoom <= 0.25}
                  className="p-1.5 text-[var(--color-on-surface-variant)] hover:text-white disabled:opacity-30 transition-colors"
                  title="Zoom out ( - )"
                >
                  <span className="material-symbols-outlined text-sm">zoom_out</span>
                </button>
                <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)] min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                  disabled={zoom >= 4}
                  className="p-1.5 text-[var(--color-on-surface-variant)] hover:text-white disabled:opacity-30 transition-colors"
                  title="Zoom in ( + )"
                >
                  <span className="material-symbols-outlined text-sm">zoom_in</span>
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1.5 text-[var(--color-on-surface-variant)] hover:text-white transition-colors border-l border-[var(--color-outline-variant)]/20"
                  title="Reset zoom ( 0 )"
                >
                  <span className="material-symbols-outlined text-sm">fit_screen</span>
                </button>
              </div>
            )}
            <button
              onClick={() => triggerDownload(doc.file_url, filename)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-xs rounded-lg hover:bg-[var(--color-primary-fixed-dim)] transition-all"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-[var(--brand-bg)] flex items-center justify-center min-h-[300px]">
          {img ? (
            <div
              className="transition-transform duration-200 origin-center cursor-zoom-in"
              style={{ transform: `scale(${zoom})` }}
              onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doc.file_url}
                alt={label}
                className="max-w-full max-h-[65vh] object-contain select-none"
              />
            </div>
          ) : (
            <iframe
              src={doc.file_url}
              title={label}
              className="w-full h-[65vh] border-0"
            />
          )}
        </div>

        {img && zoom > 1 && (
          <div className="shrink-0 px-5 py-2 bg-[var(--brand-bg)] border-t border-[var(--color-outline-variant)]/10 text-center">
            <p className="text-[10px] text-[var(--color-outline-variant)]">Click image to zoom in · Press <kbd className="px-1 bg-[var(--brand-panel)] rounded text-[var(--color-on-surface-variant)]">-</kbd> to zoom out · <kbd className="px-1 bg-[var(--brand-panel)] rounded text-[var(--color-on-surface-variant)]">0</kbd> to reset</p>
          </div>
        )}
      </div>
    </div>
  )
}

