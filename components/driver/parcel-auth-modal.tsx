"use client"

import { useRef, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { markParcelCollected } from "@/app/actions/delivery"
import { compressImage } from "@/lib/image-compress"

const PROHIBITED = [
  { icon: "gavel", label: "Illegal goods" },
  { icon: "security", label: "Weapons & ammo" },
  { icon: "whatshot", label: "Flammables" },
  { icon: "science", label: "Hazardous chemicals" },
  { icon: "medication", label: "Controlled substances" },
  { icon: "payments", label: "Cash & currency" },
]

type Props = { deliveryId: string; onClose: () => void }

export function ParcelAuthModal({ deliveryId, onClose }: Props) {
  const [step, setStep] = useState<"warning" | "camera" | "preview">("warning")
  const [agreed, setAgreed] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>("Uploading…")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const blob = await compressImage(file)
      setCompressedBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setStep("preview")
    } catch {
      toast.error("Could not process image. Please try again.")
    }
  }

  async function handleConfirm() {
    if (!compressedBlob) return
    setUploading(true)

    try {
      // Step 1: get current user id for the storage path
      setUploadProgress("Preparing upload…")
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Not authenticated"); setUploading(false); return }

      // Step 2: upload directly from browser → Supabase Storage (no server relay)
      setUploadProgress("Uploading photo…")
      const path = `${user.id}/parcel-${deliveryId}-${Date.now()}.jpg`
      const file = new File([compressedBlob], "parcel.jpg", { type: "image/jpeg" })
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(path, file, { contentType: "image/jpeg", upsert: true })

      if (uploadError) { toast.error(uploadError.message); setUploading(false); return }

      const { data: { publicUrl } } = supabase.storage.from("driver-documents").getPublicUrl(path)

      // Step 3: lightweight server action — just the DB update + revalidate
      setUploadProgress("Saving…")
      const result = await markParcelCollected(deliveryId, publicUrl)
      if (result.error) { toast.error(result.error); setUploading(false); return }

      toast.success("Parcel authenticated! Status updated to Collected.")
      onClose()
      router.refresh()
    } catch {
      toast.error("Upload failed. Please check your connection and try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#1a1919] rounded-2xl border border-[#494847]/20 shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#494847]/15 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#a3a6ff]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#a3a6ff]">verified_user</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Parcel Authentication</p>
            <p className="text-[10px] text-[#adaaaa] uppercase tracking-wider">
              {step === "warning" ? "Step 1 of 3 — Safety Check" : step === "camera" ? "Step 2 of 3 — Capture Photo" : "Step 3 of 3 — Confirm"}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5">

          {/* STEP 1 — Warning */}
          {step === "warning" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/15 bg-red-500/10">
                  <span className="material-symbols-outlined text-red-400">block</span>
                  <p className="text-sm font-bold text-red-400 uppercase tracking-wider">Prohibited Items Notice</p>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  {PROHIBITED.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-400/70 text-sm">{item.icon}</span>
                      <span className="text-xs text-[#adaaaa]">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <p className="text-[11px] text-[#adaaaa] leading-relaxed">
                    Transporting prohibited items is a criminal offence. You are personally responsible for items in your possession. Violations will result in immediate account termination and may lead to legal prosecution.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-base mt-0.5 shrink-0">info</span>
                  <p className="text-[12px] text-[#adaaaa] leading-relaxed">
                    You must photograph the parcel <span className="text-white font-semibold">before accepting custody</span>. This image is timestamped and securely stored as proof of condition at collection.
                  </p>
                </div>
              </div>

              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${agreed ? "border-[#6ee7b7]/40 bg-[#6ee7b7]/5" : "border-[#494847]/20 bg-[#262626] hover:border-[#494847]/40"}`}>
                <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${agreed ? "bg-[#6ee7b7] border-[#6ee7b7]" : "border-[#494847]/60"}`}>
                  {agreed && <span className="material-symbols-outlined text-[#0e0e0e] text-[12px]">check</span>}
                </div>
                <input type="checkbox" className="sr-only" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <p className="text-[12px] text-[#adaaaa] leading-relaxed">
                  I confirm this parcel does <span className="text-white font-bold">not</span> contain any prohibited, illegal, or dangerous items. I accept full legal responsibility for this delivery.
                </p>
              </label>
            </div>
          )}

          {/* STEP 2 — Camera */}
          {step === "camera" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#494847]/20 bg-[#262626] p-8 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-4xl">photo_camera</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Take a Photo of the Parcel</p>
                  <p className="text-[11px] text-[#adaaaa] mt-1">Ensure the parcel and its label are clearly visible</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm hover:brightness-110 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">camera_alt</span>
                  Open Camera
                </button>
              </div>
              <p className="text-[10px] text-[#494847] text-center">Image is automatically compressed for faster upload</p>
            </div>
          )}

          {/* STEP 3 — Preview */}
          {step === "preview" && previewUrl && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-[#494847]/20">
                <img src={previewUrl} alt="Parcel" className="w-full object-cover" style={{ maxHeight: 280 }} />
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#6ee7b7]/5 border border-[#6ee7b7]/20">
                <span className="material-symbols-outlined text-[#6ee7b7] text-base">check_circle</span>
                <p className="text-[12px] text-[#adaaaa]">Photo captured. Compressed for efficient upload.</p>
              </div>
              <button
                onClick={() => { setStep("camera"); setPreviewUrl(null); setCompressedBlob(null) }}
                className="w-full py-2 rounded-xl border border-[#494847]/30 text-[#adaaaa] text-sm font-bold hover:text-white hover:bg-[#262626] transition-colors"
              >
                Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#494847]/15 shrink-0 flex gap-3">
          {step === "warning" && (
            <>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
                Cancel
              </button>
              <button
                disabled={!agreed}
                onClick={() => setStep("camera")}
                className="flex-1 py-2.5 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">arrow_forward</span>
                I Understand — Continue
              </button>
            </>
          )}
          {step === "camera" && (
            <button onClick={() => setStep("warning")} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
              ← Back
            </button>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("camera")} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors">
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-[#6ee7b7] text-[#0e0e0e] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                {uploading ? uploadProgress : "Confirm & Mark Collected"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
