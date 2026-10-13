/**
 * components/admin/marketing-panel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Customer Database & Marketing surface. Three internal tabs:
 *   Compose & Send        — manual broadcast (promotional offers, discount
 *                            codes, service updates) to an audience segment
 *   Campaign History       — past manual + automatic sends with outcomes
 *   Re-engagement Reminders — configure the automatic "come back" cron
 *
 * Every send is gated server-side on the recipient's actual marketing
 * consent — this UI can only choose WHO to target and WHAT to send, never
 * bypass opt-in.
 */
"use client"

import { useEffect, useState, useTransition } from "react"
import {
  adminCreateAndSendCampaign, adminPreviewSegment, adminUpdateReengagementSettings,
  type MarketingCampaign, type ReengagementSettings, type CreateCampaignInput,
} from "@/app/actions/marketing"
import type { PromoCode } from "@/app/actions/promotions"

const INPUT = "w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
const LABEL = "text-xs font-semibold text-[#adaaaa] uppercase tracking-wider"

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        {description && <p className="text-xs text-[#adaaaa] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? "bg-[#6ee7b7]" : "bg-[#494847]/40"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}

function SegmentPicker({
  channel, segment, setSegment, inactiveDays, setInactiveDays,
}: {
  channel: "push" | "email" | "both"
  segment: "all" | "inactive"
  setSegment: (s: "all" | "inactive") => void
  inactiveDays: number
  setInactiveDays: (n: number) => void
}) {
  return (
    <div className="space-y-3">
      <label className={LABEL}>Audience</label>
      <div className="flex rounded-xl bg-[#262626] border border-[#494847]/20 p-1">
        {([
          { key: "all" as const, label: "All Customers" },
          { key: "inactive" as const, label: "Inactive Customers" },
        ]).map((s) => (
          <button key={s.key} type="button" onClick={() => setSegment(s.key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${segment === s.key ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[#adaaaa]"}`}>
            {s.label}
          </button>
        ))}
      </div>
      {segment === "inactive" && (
        <div className="space-y-1.5 max-w-[220px]">
          <label className={LABEL}>Inactive For (days)</label>
          <input type="number" min={1} className={INPUT} value={inactiveDays} onChange={(e) => setInactiveDays(parseInt(e.target.value) || 1)} />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Compose & Send
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_CAMPAIGN: CreateCampaignInput = {
  title: "", subject: "", message: "", channel: "both", segment: "all", inactiveDays: 30, promoCodeId: null,
}

function ComposeSection({ promoCodes, onSent }: { promoCodes: PromoCode[]; onSent: (campaign: MarketingCampaign) => void }) {
  const [form, setForm] = useState<CreateCampaignInput>(EMPTY_CAMPAIGN)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ total: number; willReceive: number; skippedOptedOut: number; skippedNoContact: number } | null>(null)

  function set<K extends keyof CreateCampaignInput>(key: K, value: CreateCampaignInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      adminPreviewSegment(form.segment, form.segment === "inactive" ? form.inactiveDays : null, form.channel).then((res) => {
        if (!cancelled) setPreview(res.data)
      })
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [form.segment, form.inactiveDays, form.channel])

  function handleSend() {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await adminCreateAndSendCampaign(form)
      if (result.error) { setError(result.error); return }
      setSuccess("Campaign sent.")
      setForm(EMPTY_CAMPAIGN)
      onSent({
        id: result.campaignId ?? crypto.randomUUID(),
        type: "manual",
        title: form.title,
        subject: form.subject,
        message: form.message,
        channel: form.channel,
        segment: form.segment,
        inactive_days: form.segment === "inactive" ? form.inactiveDays : null,
        promo_code_id: form.promoCodeId,
        status: "sent",
        recipient_count: preview?.total ?? 0,
        sent_count: preview?.willReceive ?? 0,
        failed_count: 0,
        skipped_count: (preview?.skippedOptedOut ?? 0) + (preview?.skippedNoContact ?? 0),
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    })
  }

  const activeCodes = promoCodes.filter((c) => c.active)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <label className={LABEL}>Campaign Title (internal)</label>
          <input className={INPUT} placeholder="Spring sale announcement" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Subject / Push Title</label>
          <input className={INPUT} placeholder="20% off your next delivery!" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Message</label>
          <textarea rows={4} className={INPUT} placeholder="Write your message to customers…" value={form.message} onChange={(e) => set("message", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Promo Code (optional)</label>
          <select className={INPUT} value={form.promoCodeId ?? ""} onChange={(e) => set("promoCodeId", e.target.value || null)}>
            <option value="">None</option>
            {activeCodes.map((c) => <option key={c.id} value={c.id}>{c.code}{c.description ? ` — ${c.description}` : ""}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <label className={LABEL}>Channel</label>
          <div className="flex rounded-xl bg-[#262626] border border-[#494847]/20 p-1">
            {([
              { key: "push" as const, label: "Push Only" },
              { key: "email" as const, label: "Email Only" },
              { key: "both" as const, label: "Push + Email" },
            ]).map((c) => (
              <button key={c.key} type="button" onClick={() => set("channel", c.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.channel === c.key ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[#adaaaa]"}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <SegmentPicker channel={form.channel} segment={form.segment} setSegment={(s) => set("segment", s)} inactiveDays={form.inactiveDays ?? 30} setInactiveDays={(n) => set("inactiveDays", n)} />

        {preview && (
          <div className="rounded-xl bg-[#262626] border border-[#494847]/20 px-4 py-3 text-xs text-[#adaaaa] space-y-0.5">
            <p><span className="text-white font-bold">{preview.willReceive}</span> of {preview.total} customer{preview.total !== 1 ? "s" : ""} in this segment will actually receive this.</p>
            {preview.skippedOptedOut > 0 && <p>{preview.skippedOptedOut} skipped — not opted in to marketing.</p>}
            {preview.skippedNoContact > 0 && <p>{preview.skippedNoContact} skipped — opted in but no email on file.</p>}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">{success}</p>}

      <button
        onClick={handleSend}
        disabled={isPending || !form.title.trim() || !form.subject.trim() || !form.message.trim()}
        className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60 flex items-center gap-2 transition-all"
      >
        {isPending ? "Sending…" : "Send Campaign"}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Campaign History
// ═══════════════════════════════════════════════════════════════════════════

function CampaignHistorySection({ campaigns }: { campaigns: MarketingCampaign[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#494847]/30 bg-[#1a1919] px-6 py-16 text-center">
        <span className="material-symbols-outlined text-4xl text-[#494847] mb-3 block">campaign</span>
        <p className="text-sm font-semibold text-white">No campaigns sent yet</p>
        <p className="mt-1 text-xs text-[#adaaaa]">Compose your first broadcast to see it here.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left min-w-[760px]">
        <thead className="bg-[#131313] text-[10px] uppercase tracking-widest font-bold text-[#adaaaa]">
          <tr>
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Segment</th>
            <th className="px-4 py-3">Sent</th>
            <th className="px-4 py-3">Failed</th>
            <th className="px-4 py-3">Skipped</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#494847]/10">
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-[#201f1f]/40">
              <td className="px-4 py-3">
                <p className="text-sm font-bold text-white">{c.title}</p>
                <p className="text-[10px] text-[#adaaaa] truncate max-w-[220px]">{c.subject}</p>
              </td>
              <td className="px-4 py-3 text-xs text-[#adaaaa]">{c.type === "auto_reengagement" ? "Automatic" : "Manual"}</td>
              <td className="px-4 py-3 text-xs text-[#adaaaa] capitalize">{c.channel === "both" ? "Push + Email" : c.channel}</td>
              <td className="px-4 py-3 text-xs text-[#adaaaa]">{c.segment === "inactive" ? `Inactive ${c.inactive_days}d+` : "All"}</td>
              <td className="px-4 py-3 text-sm text-green-400 font-bold">{c.sent_count}</td>
              <td className="px-4 py-3 text-sm text-[#ff6e84] font-bold">{c.failed_count}</td>
              <td className="px-4 py-3 text-sm text-[#adaaaa]">{c.skipped_count}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  c.status === "sent" ? "bg-green-500/10 text-green-400" : c.status === "failed" ? "bg-[#ff6e84]/10 text-[#ff6e84]" : "bg-[#494847]/20 text-[#adaaaa]"
                }`}>
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-[#adaaaa]">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Re-engagement Settings
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS: ReengagementSettings = {
  enabled: false, inactive_days: 30, channel: "both",
  subject: "We miss you at Go Drop!",
  message: "It's been a while — come back and get your next delivery moving with Go Drop.",
  promo_code_id: null,
}

function ReengagementSection({ initial, promoCodes }: { initial: ReengagementSettings | null; promoCodes: PromoCode[] }) {
  const [form, setForm] = useState<ReengagementSettings>(initial ?? DEFAULT_SETTINGS)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ReengagementSettings>(key: K, value: ReengagementSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await adminUpdateReengagementSettings(form)
      if (result.error) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  const activeCodes = promoCodes.filter((c) => c.active)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl p-5">
        <Toggle
          checked={form.enabled}
          onChange={(v) => set("enabled", v)}
          label="Automatic Re-engagement Reminders"
          description="Runs once daily. Sends a reminder to customers who've gone quiet, on the channel(s) they've opted into — each customer only gets one reminder per inactivity window."
        />
      </div>

      <div className={`bg-[#1a1919] border border-[#494847]/15 rounded-xl p-5 space-y-4 transition-opacity ${!form.enabled ? "opacity-50" : ""}`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={LABEL}>Inactive For (days)</label>
            <input type="number" min={1} className={INPUT} value={form.inactive_days} onChange={(e) => set("inactive_days", parseInt(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Channel</label>
            <div className="flex rounded-xl bg-[#262626] border border-[#494847]/20 p-1">
              {([
                { key: "push" as const, label: "Push" },
                { key: "email" as const, label: "Email" },
                { key: "both" as const, label: "Both" },
              ]).map((c) => (
                <button key={c.key} type="button" onClick={() => set("channel", c.key)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.channel === c.key ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[#adaaaa]"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Subject / Push Title</label>
          <input className={INPUT} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Message</label>
          <textarea rows={3} className={INPUT} value={form.message} onChange={(e) => set("message", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Promo Code (optional)</label>
          <select className={INPUT} value={form.promo_code_id ?? ""} onChange={(e) => set("promo_code_id", e.target.value || null)}>
            <option value="">None</option>
            {activeCodes.map((c) => <option key={c.id} value={c.id}>{c.code}{c.description ? ` — ${c.description}` : ""}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={isPending} className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60">
          {isPending ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span className="text-xs text-green-400 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Saved</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main panel
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { key: "compose", label: "Compose & Send", icon: "send" },
  { key: "history", label: "Campaign History", icon: "history" },
  { key: "reengagement", label: "Re-engagement Reminders", icon: "autorenew" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function MarketingPanel({
  initialCampaigns, initialSettings, promoCodes,
}: {
  initialCampaigns: MarketingCampaign[]
  initialSettings: ReengagementSettings | null
  promoCodes: PromoCode[]
}) {
  const [tab, setTab] = useState<TabKey>("compose")
  const [campaigns, setCampaigns] = useState(initialCampaigns)

  return (
    <div className="px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">Customer Marketing</h1>
        <p className="text-[#adaaaa] mt-1">Broadcast promotions and updates, and manage automatic re-engagement reminders — always respecting each customer's opt-in.</p>
      </div>

      <div className="flex rounded-xl bg-[#1a1919] border border-[#494847]/20 p-1 w-fit mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.key ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[#adaaaa] hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "compose" && <ComposeSection promoCodes={promoCodes} onSent={(c) => { setCampaigns((prev) => [c, ...prev]); setTab("history") }} />}
      {tab === "history" && <CampaignHistorySection campaigns={campaigns} />}
      {tab === "reengagement" && <ReengagementSection initial={initialSettings} promoCodes={promoCodes} />}
    </div>
  )
}

