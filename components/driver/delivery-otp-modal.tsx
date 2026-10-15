"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { compressImage } from "@/lib/image-compress"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { verifyDeliveryOtpAndComplete } from "@/app/actions/delivery"

type Step = "camera" | "preview" | "otp"

type Props = {
  deliveryId: string
  onClose: () => void
  onSuccess: () => void
}

export function DeliveryOtpModal({ deliveryId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("camera")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      setError("Could not process image. Please try again.")
    }
  }

  async function handleConfirmPhoto() {
    if (!compressedBlob) return
    setUploading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("Not authenticated"); return }

      const path = `${user.id}/delivered-${deliveryId}-${Date.now()}.jpg`
      const file = new File([compressedBlob], "delivered.jpg", { type: "image/jpeg" })
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(path, file, { contentType: "image/jpeg", upsert: true })

      if (uploadError) { setError(uploadError.message); return }

      const { data: { publicUrl } } = supabase.storage.from("driver-documents").getPublicUrl(path)
      setPhotoUrl(publicUrl)
      setStep("otp")
    } catch {
      setError("Upload failed. Please check your connection and try again.")
    } finally {
      setUploading(false)
    }
  }

  function handleSubmitOtp() {
    if (code.length !== 4 || isPending || !photoUrl) return
    setError(null)
    startTransition(async () => {
      const result = await verifyDeliveryOtpAndComplete(deliveryId, code, photoUrl)
      if (result.error) {
        setError(result.error)
        setCode("")
        return
      }
      onSuccess()
    })
  }

  const busy = uploading || isPending

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => { if (!busy) onClose() }} />
      <div className="relative w-full max-w-md bg-[var(--brand-panel)] rounded-2xl border border-[var(--color-outline-variant)]/20 shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-outline-variant)]/15 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#6ee7b7]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#6ee7b7]">local_shipping</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Confirm Delivery</p>
            <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase tracking-wider">
              {step === "camera" ? "Step 1 of 2 — Photo Proof" : step === "preview" ? "Step 1 of 2 — Confirm Photo" : "Step 2 of 2 — Delivery Code"}
            </p>
          </div>
          <button onClick={onClose} disabled={busy} className="ml-auto p-1.5 rounded-lg text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors disabled:opacity-40">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5">

          {/* STEP 1 — Camera */}
          {step === "camera" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-highest)] p-8 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-[#6ee7b7]/10 border border-[#6ee7b7]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#6ee7b7] text-4xl">photo_camera</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Photograph the Delivered Package</p>
                  <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1">Show the package at the drop-off location as proof of delivery</p>
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#6ee7b7] text-[#052e16] font-bold text-sm hover:brightness-110 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">camera_alt</span>
                  Open Camera
                </button>
              </div>
              <p className="text-[10px] text-[var(--color-outline-variant)] text-center">Image is automatically compressed for faster upload</p>
            </div>
          )}

          {/* STEP 2 — Preview */}
          {step === "preview" && previewUrl && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-[var(--color-outline-variant)]/20">
                <img src={previewUrl} alt="Delivered package" className="w-full object-cover" style={{ maxHeight: 280 }} />
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#6ee7b7]/5 border border-[#6ee7b7]/20">
                <span className="material-symbols-outlined text-[#6ee7b7] text-base">check_circle</span>
                <p className="text-[12px] text-[var(--color-on-surface-variant)]">Photo captured. Compressed for efficient upload.</p>
              </div>
              <button
                onClick={() => { setStep("camera"); setPreviewUrl(null); setCompressedBlob(null) }}
                className="w-full py-2 rounded-xl border border-[var(--color-outline-variant)]/30 text-[var(--color-on-surface-variant)] text-sm font-bold hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors"
              >
                Retake Photo
              </button>
            </div>
          )}

          {/* STEP 3 — OTP */}
          {step === "otp" && (
            <div className="space-y-5 text-center">
              <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
                Ask the customer for their 4-digit delivery code and enter it below to confirm handoff.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={code} onChange={setCode} disabled={isPending} onComplete={handleSubmitOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-lg" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-lg" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-lg" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[#ff6e84] mt-4 text-center">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--color-outline-variant)]/15 shrink-0 flex gap-3">
          {step === "camera" && (
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors">
              Cancel
            </button>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("camera")} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors">
                ← Back
              </button>
              <button
                onClick={handleConfirmPhoto}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-[#6ee7b7] text-[#052e16] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                {uploading ? "Uploading…" : "Confirm Photo"}
              </button>
            </>
          )}
          {step === "otp" && (
            <>
              <button onClick={onClose} disabled={isPending} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--color-surface-container-highest)] transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handleSubmitOtp}
                disabled={code.length !== 4 || isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#6ee7b7] text-[#052e16] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40"
              >
                {isPending ? "Verifying…" : "Confirm Delivery"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
