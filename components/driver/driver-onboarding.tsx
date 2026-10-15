"use client"

import { BrandLogo } from '@/components/shared/brand-logo'
import Link from "next/link"
import { LogoutButton } from "@/components/auth/logout-button"

type Step = "account" | "documents" | "review" | "approved"

const STEPS = [
  { key: "account",   label: "Account Created",  icon: "person_check" },
  { key: "documents", label: "Upload Documents",  icon: "upload_file" },
  { key: "review",    label: "Under Review",      icon: "manage_search" },
  { key: "approved",  label: "Access Granted",    icon: "verified" },
] as const

function getStep(status: string, hasDocuments: boolean): Step {
  if (status === "approved") return "approved"
  if (hasDocuments) return "review"
  return "documents"
}

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current)

  return (
    <div className="flex items-center w-full max-w-2xl mx-auto">
      {STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const locked = i > currentIdx

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                done   ? "bg-green-500 shadow-[0_0_15px_rgba(74,222,128,0.4)]" :
                active ? "bg-[var(--brand-strong)] shadow-[0_0_20px_rgba(var(--brand-rgb),0.5)] animate-pulse" :
                         "bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/30"
              }`}>
                {done ? (
                  <span className="material-symbols-outlined text-white text-lg">check</span>
                ) : (
                  <span className={`material-symbols-outlined text-lg ${active ? "text-[var(--brand-ink)]" : "text-[var(--color-outline-variant)]"}`}>{step.icon}</span>
                )}
              </div>
              <p className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap hidden sm:block ${
                done ? "text-green-400" : active ? "text-[var(--brand-soft)]" : "text-[var(--color-outline-variant)]"
              }`}>{step.label}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 mb-5 sm:mb-0 transition-all duration-500 ${done ? "bg-green-500/50" : "bg-[var(--color-surface-container-highest)]"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DriverOnboarding({
  user,
  driverStatus,
  hasDocuments,
}: {
  user: { full_name: string; email: string }
  driverStatus: string
  hasDocuments: boolean
}) {
  const currentStep = getStep(driverStatus, hasDocuments)
  const initials = user.full_name
    ? user.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "DR"

  return (
    <div className="min-h-screen bg-[var(--brand-bg)] flex flex-col">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[var(--brand-strong)]/4 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[var(--color-secondary)]/4 blur-[100px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--brand-panel)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--brand-soft)] text-base">bolt</span>
          </div>
          <BrandLogo />
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 rounded-full text-[9px] font-bold text-[var(--brand-soft)] uppercase tracking-wider">Driver Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[var(--brand-soft)]">{initials}</span>
            </div>
            <span className="hidden sm:block text-sm text-[var(--color-on-surface-variant)]">{user.full_name || user.email}</span>
          </div>
          <LogoutButton className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-on-surface-variant)] hover:text-white hover:bg-[var(--brand-panel)] rounded-lg transition-all">
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="hidden sm:inline">Sign Out</span>
          </LogoutButton>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Step indicator */}
        <div className="w-full max-w-2xl mb-12 px-4">
          <StepIndicator current={currentStep} />
        </div>

        {/* Main card */}
        <div className="w-full max-w-2xl">
          {/* ── REJECTED ─────────────────────────────────────────── */}
          {driverStatus === "rejected" && (
            <div className="bg-[var(--brand-panel)] rounded-2xl border border-[#ff6e84]/20 overflow-hidden">
              <div className="px-8 py-6 border-b border-[#ff6e84]/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#ff6e84]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#ff6e84] text-2xl">error</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Application Rejected</h2>
                  <p className="text-sm text-[var(--color-on-surface-variant)] mt-0.5">One or more of your documents need to be re-submitted.</p>
                </div>
              </div>
              <div className="px-8 py-6 space-y-4">
                <div className="bg-[#ff6e84]/5 border border-[#ff6e84]/15 rounded-xl px-5 py-4">
                  <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
                    Our verification team was unable to approve your application. This is usually due to unclear document images, expired documents, or missing information. Please re-upload your documents and resubmit.
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: "photo_camera", text: "Ensure documents are clearly photographed with all four corners visible" },
                    { icon: "light_mode",   text: "Good lighting — avoid glare, shadows, or blurriness" },
                    { icon: "event",        text: "All documents must be current and not expired" },
                    { icon: "crop",         text: "Do not crop or obscure any part of the document" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[var(--brand-soft)] text-sm mt-0.5 shrink-0">{icon}</span>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">{text}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/driver/verification"
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-black text-sm rounded-xl hover:bg-[var(--color-primary-fixed-dim)] shadow-[0_0_20px_rgba(var(--brand-rgb),0.25)] transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  Re-upload Documents
                </Link>
              </div>
            </div>
          )}

          {/* ── UPLOAD DOCUMENTS ──────────────────────────────────── */}
          {driverStatus !== "rejected" && currentStep === "documents" && (
            <div className="bg-[var(--brand-panel)] rounded-2xl border border-[var(--color-outline-variant)]/15 overflow-hidden">
              <div className="px-8 py-6 border-b border-[var(--color-outline-variant)]/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[var(--brand-soft)] text-2xl">upload_file</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Upload Your Documents</h2>
                  <p className="text-sm text-[var(--color-on-surface-variant)] mt-0.5">Complete your profile to start accepting deliveries.</p>
                </div>
              </div>

              <div className="px-8 py-6 space-y-5">
                {/* Required documents */}
                <div>
                  <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-3">Required Documents</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { icon: "badge",   label: "Identity / Licence", desc: "Government-issued photo ID or driver's licence" },
                      { icon: "shield",  label: "Insurance Policy",   desc: "Active commercial vehicle insurance certificate" },
                      { icon: "commute", label: "Vehicle Registration",desc: "Current vehicle registration document" },
                    ].map(({ icon, label, desc }) => (
                      <div key={label} className="bg-[var(--brand-bg)] border border-[var(--color-outline-variant)]/15 rounded-xl p-4 flex flex-col gap-2">
                        <span className="material-symbols-outlined text-[var(--brand-soft)] text-xl">{icon}</span>
                        <p className="text-xs font-bold text-white">{label}</p>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)] leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Process steps */}
                <div className="bg-[var(--brand-bg)] border border-[var(--color-outline-variant)]/10 rounded-xl px-5 py-4">
                  <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-3">What Happens Next</p>
                  <div className="space-y-3">
                    {[
                      { n: "1", text: "Upload your 3 required documents in the Verification tab" },
                      { n: "2", text: "Click 'Submit for Review' once all documents are uploaded" },
                      { n: "3", text: "Our team reviews within 24 hours and notifies you by email" },
                      { n: "4", text: "Once approved, full access to all driver features is unlocked" },
                    ].map(({ n, text }) => (
                      <div key={n} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-black text-[var(--brand-soft)]">{n}</span>
                        </div>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/dashboard/driver/verification"
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--brand-strong)] text-[var(--brand-ink)] font-black text-sm rounded-xl hover:bg-[var(--color-primary-fixed-dim)] shadow-[0_0_20px_rgba(var(--brand-rgb),0.25)] transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  Upload My Documents
                </Link>
              </div>
            </div>
          )}

          {/* ── UNDER REVIEW ──────────────────────────────────────── */}
          {currentStep === "review" && driverStatus !== "rejected" && (
            <div className="bg-[var(--brand-panel)] rounded-2xl border border-[var(--brand-strong)]/15 overflow-hidden">
              <div className="px-8 py-6 border-b border-[var(--brand-strong)]/10">
                <div className="flex items-center gap-4 mb-1">
                  <div className="w-12 h-12 rounded-xl bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center shrink-0 animate-pulse">
                    <span className="material-symbols-outlined text-[var(--brand-soft)] text-2xl">manage_search</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Application Under Review</h2>
                    <p className="text-sm text-[var(--color-on-surface-variant)] mt-0.5">Our compliance team is verifying your submission.</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 space-y-5">
                {/* Timeline */}
                <div>
                  <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Review Timeline</p>
                  <div className="relative pl-6 space-y-5">
                    <div className="absolute left-2.5 top-2 bottom-2 w-px bg-[var(--color-outline-variant)]/30" />
                    {[
                      { icon: "check_circle", color: "text-green-400", bg: "bg-green-500", label: "Documents Submitted", desc: "All required documents received.", done: true },
                      { icon: "manage_search", color: "text-[var(--brand-soft)]", bg: "bg-[var(--brand-strong)]", label: "Identity Verification", desc: "Verifying your identity and licence.", done: false, active: true },
                      { icon: "schedule", color: "text-[var(--color-outline-variant)]", bg: "bg-[var(--color-outline-variant)]", label: "Background Check", desc: "Standard compliance check.", done: false },
                      { icon: "schedule", color: "text-[var(--color-outline-variant)]", bg: "bg-[var(--color-outline-variant)]", label: "Final Approval", desc: "Account activated for deliveries.", done: false },
                    ].map(({ icon, color, bg, label, desc, done, active }) => (
                      <div key={label} className="flex items-start gap-4">
                        <div className={`absolute left-0 w-5 h-5 rounded-full ${bg} flex items-center justify-center ${active ? "shadow-[0_0_10px_rgba(var(--brand-rgb),0.5)]" : ""}`}
                          style={{ marginTop: "2px" }}>
                          <span className="material-symbols-outlined text-white text-xs">{icon}</span>
                        </div>
                        <div className="ml-2">
                          <p className={`text-sm font-bold ${done || active ? "text-white" : "text-[var(--color-outline-variant)]"}`}>{label}</p>
                          <p className={`text-xs mt-0.5 ${done || active ? "text-[var(--color-on-surface-variant)]" : "text-[var(--color-outline-variant)]"}`}>{desc}</p>
                          {active && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black text-[var(--brand-soft)] bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-strong)] animate-pulse" />In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Estimated time */}
                <div className="bg-[var(--brand-bg)] border border-[var(--color-outline-variant)]/10 rounded-xl px-5 py-4 flex items-center gap-4">
                  <span className="material-symbols-outlined text-[var(--brand-soft)] text-2xl shrink-0">schedule</span>
                  <div>
                    <p className="text-sm font-bold text-white">Estimated Review Time</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Typically <span className="text-white font-semibold">24–48 hours</span>. You will receive an email notification once your application is reviewed.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/dashboard/driver/verification"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-white font-bold text-sm rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-base">folder_open</span>
                    View My Documents
                  </Link>
                  <Link
                    href="/dashboard/driver/support"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-white font-bold text-sm rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-base">headset_mic</span>
                    Contact Support
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--color-outline-variant)] mt-10">&copy; {new Date().getFullYear()} Go Drop. All rights reserved.</p>
      </main>
    </div>
  )
}

