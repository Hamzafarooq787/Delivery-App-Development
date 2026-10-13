"use client"

import { useState, useTransition, useEffect } from "react"
import { updateDriverProfile }        from "@/app/actions/delivery"
import {
  toggleDriverOnline,
  updateDriverNotifications,
  changeDriverPassword,
}                                     from "@/app/actions/driver"
import type { DriverVehicle }        from "@/app/actions/vehicles"
import { VehicleManager }            from "@/components/driver/vehicle-manager"
import {
  SOUND_OPTIONS,
  getSoundPrefs,
  setSoundPrefs,
  playNotificationSound,
  primeAudio,
  isNotificationSupported,
  canUseSystemSound,
  requestNotificationPermission,
  type SoundType,
}                                     from "@/lib/notification-sound"
import { LogoutButton }              from "@/components/auth/logout-button"

// ─────────── Shared primitives ─────────────────────────────────────────────

const INPUT = "w-full bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all"
const LABEL = "text-xs font-semibold text-[#adaaaa] uppercase tracking-wider"

function Feedback({ saved, error }: { saved: boolean; error: string | null }) {
  if (error)
    return (
      <p className="text-xs text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-4 py-3 mt-3">
        {error}
      </p>
    )
  if (saved)
    return (
      <p className="text-xs text-[#6ee7b7] flex items-center gap-1 mt-3 font-semibold">
        <span className="material-symbols-outlined text-sm">check_circle</span>
        Saved successfully!
      </p>
    )
  return null
}

function SaveBtn({
  isPending,
  label = "Save Changes",
}: {
  isPending: boolean
  label?: string
}) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60 flex items-center gap-2 transition-all"
    >
      {isPending ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : null}
      {isPending ? "Saving…" : label}
    </button>
  )
}

// ─────────── Profile section ───────────────────────────────────────────────

function ProfileSection({
  fullName,
  phone,
  email,
}: {
  fullName: string
  phone: string
  email: string
}) {
  const [isPending, start] = useTransition()
  const [saved,  setSaved] = useState(false)
  const [error,  setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const fd   = new FormData(e.currentTarget)
    const name = (fd.get("full_name") as string ?? "").trim()
    const parts = name.split(" ")
    fd.set("first_name", parts[0] ?? "")
    fd.set("last_name",  parts.slice(1).join(" "))
    start(async () => {
      const r = await updateDriverProfile(fd)
      if (r?.error) { setError(r.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-[var(--color-primary)]">person</span>
        </div>
        <h3 className="text-lg font-bold font-headline text-white">Profile Information</h3>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Full Name</label>
            <input name="full_name" type="text" defaultValue={fullName} placeholder="Your full name" className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Phone Number</label>
            <input name="phone" type="tel" defaultValue={phone} placeholder="+44 7700 000000" className={INPUT} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className={LABEL}>Email Address</label>
            <input
              type="email"
              value={email}
              readOnly
              className={`${INPUT} opacity-50 cursor-not-allowed`}
              title="Email cannot be changed here"
            />
            <p className="text-[10px] text-[#adaaaa] mt-1">Contact support to change your email address.</p>
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div className="pt-1"><SaveBtn isPending={isPending} /></div>
      </form>
    </div>
  )
}

// ─────────── Vehicle section ───────────────────────────────────────────────
// A driver can register multiple vehicles — job matching uses the union of
// capabilities across all of them, so this is a list, not a single-vehicle form.

function VehicleSection({ vehicles }: { vehicles: DriverVehicle[] }) {
  const [list, setList] = useState<DriverVehicle[]>(vehicles)

  return (
    <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 bg-[var(--color-secondary)]/10 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-[var(--color-secondary)]">directions_car</span>
        </div>
        <div>
          <h3 className="text-lg font-bold font-headline text-white">My Vehicles</h3>
          <p className="text-xs text-[#adaaaa] mt-0.5">You'll only be matched to jobs your registered vehicles can carry.</p>
        </div>
      </div>
      <VehicleManager vehicles={list} onChange={setList} />
    </div>
  )
}

// ─────────── Notifications section ────────────────────────────────────────

function Toggle({
  id,
  name,
  checked,
  onChange,
  label,
  description,
}: {
  id: string
  name: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-[#adaaaa] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? "bg-[var(--color-primary)]" : "bg-[#494847]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      {/* Hidden input so it's included in FormData */}
      <input type="hidden" name={name} value={checked ? "1" : "0"} />
    </div>
  )
}

function NotificationsSection({
  notificationsEnabled,
  deliveryAlerts,
}: {
  notificationsEnabled: boolean
  deliveryAlerts: boolean
}) {
  const [notifs,   setNotifs]  = useState(notificationsEnabled)
  const [alerts,   setAlerts]  = useState(deliveryAlerts)
  const [isPending, start]     = useTransition()
  const [saved,  setSaved]     = useState(false)
  const [error,  setError]     = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    start(async () => {
      const r = await updateDriverNotifications(new FormData(e.currentTarget))
      if (r?.error) { setError(r.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 bg-[#6ee7b7]/10 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-[#6ee7b7]">notifications</span>
        </div>
        <h3 className="text-lg font-bold font-headline text-white">Notification Settings</h3>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <Toggle
          id="notifications_enabled"
          name="notifications_enabled"
          checked={notifs}
          onChange={setNotifs}
          label="Push Notifications"
          description="Receive push notifications for job assignments and platform alerts."
        />
        <div className="h-px bg-[#494847]/10" />
        <Toggle
          id="delivery_alerts"
          name="delivery_alerts"
          checked={alerts}
          onChange={setAlerts}
          label="Delivery Alerts"
          description="Get notified when a new delivery in your area becomes available."
        />
        <Feedback saved={saved} error={error} />
        <div className="pt-1"><SaveBtn isPending={isPending} label="Save Preferences" /></div>
      </form>
    </div>
  )
}

// ─────────── Sound settings section ──────────────────────────────────────

type NotifPerm = "granted" | "denied" | "default" | "unsupported"

function SoundSettingsSection() {
  const [selectedType,  setSelectedType]  = useState<SoundType>("chime")
  const [volume,        setVolume]        = useState(80)
  const [previewingId,  setPreviewingId]  = useState<SoundType | null>(null)
  const [saved,         setSaved]         = useState(false)
  const [notifPerm,     setNotifPerm]     = useState<NotifPerm>("default")
  const [requesting,    setRequesting]    = useState(false)

  // Hydrate from localStorage and check notification permission (client-only)
  useEffect(() => {
    const prefs = getSoundPrefs()
    setSelectedType(prefs.type)
    setVolume(prefs.volume)
    if (!isNotificationSupported()) {
      setNotifPerm("unsupported")
    } else {
      setNotifPerm(Notification.permission as NotifPerm)
    }
  }, [])

  async function handleEnableSystemSound() {
    setRequesting(true)
    const perm = await requestNotificationPermission()
    setNotifPerm(perm as NotifPerm)
    setRequesting(false)
  }

  function handleSave() {
    setSoundPrefs(selectedType, volume)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handlePreview(id: SoundType) {
    // Prime AudioContext (this IS a user gesture — safe to do here)
    await primeAudio()
    // Temporarily write this sound type so the utility picks it up
    setSoundPrefs(id, Math.max(volume, 30))  // at least 30% so preview is audible
    setPreviewingId(id)
    await playNotificationSound(true)
    setTimeout(() => setPreviewingId(null), 700)
    // Restore in-memory prefs (user still needs to Save to persist)
    setTimeout(() => setSoundPrefs(selectedType, volume), 750)
  }

  const systemBadge = (() => {
    switch (notifPerm) {
      case "granted":     return { color: "bg-[#6ee7b7]", text: "Active",      pulse: true  }
      case "denied":      return { color: "bg-[#ff6e84]", text: "Blocked",     pulse: false }
      case "default":     return { color: "bg-amber-400", text: "Not enabled", pulse: false }
      case "unsupported": return { color: "bg-[#494847]", text: "Unsupported", pulse: false }
    }
  })()

  return (
    <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">

      {/* Header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-10 h-10 bg-[var(--color-secondary)]/10 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-[var(--color-secondary)]" style={{ fontVariationSettings: "'FILL' 1" }}>
            volume_up
          </span>
        </div>
        <div>
          <h3 className="text-lg font-bold font-headline text-white">Notification Sound</h3>
          <p className="text-xs text-[#adaaaa] mt-0.5">System alert + in-app sound for every job notification</p>
        </div>
      </div>

      {/* ── System (OS) notification sound ─────────────────────────────────── */}
      <div className="mb-7">
        <p className="text-xs font-bold text-[#adaaaa] uppercase tracking-widest mb-3">System Sound</p>
        <div className="bg-[#262626] rounded-xl border border-[#494847]/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                notifPerm === "granted" ? "bg-[#6ee7b7]/15" : "bg-[#494847]/20"
              }`}>
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    notifPerm === "granted" ? "text-[#6ee7b7]" : "text-[#adaaaa]"
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {notifPerm === "granted" ? "notifications_active" : "notifications_off"}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white">Device Notification Sound</p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    notifPerm === "granted"
                      ? "bg-[#6ee7b7]/15 text-[#6ee7b7]"
                      : notifPerm === "denied"
                      ? "bg-[#ff6e84]/15 text-[#ff6e84]"
                      : notifPerm === "unsupported"
                      ? "bg-[#494847]/30 text-[#adaaaa]"
                      : "bg-amber-400/15 text-amber-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${systemBadge.color} ${systemBadge.pulse ? "animate-pulse" : ""}`} />
                    {systemBadge.text}
                  </span>
                </div>
                <p className="text-[11px] text-[#adaaaa] mt-1 leading-relaxed">
                  {notifPerm === "granted"
                    ? "Your device plays its own notification ringtone for every alert. Works on Android, Windows & macOS."
                    : notifPerm === "denied"
                    ? "Blocked in browser settings. Open your browser's site settings and allow notifications, then reload."
                    : notifPerm === "unsupported"
                    ? "System notifications are not supported on this browser (iOS Safari). In-app sounds work instead."
                    : "Allow notifications so your device plays its built-in alert sound for new job alerts."}
                </p>
              </div>
            </div>

            {/* Enable button — only show when actionable */}
            {(notifPerm === "default") && (
              <button
                type="button"
                onClick={handleEnableSystemSound}
                disabled={requesting}
                className="shrink-0 px-3 py-2 rounded-xl bg-[#6ee7b7]/15 border border-[#6ee7b7]/30 text-[#6ee7b7] text-xs font-bold hover:bg-[#6ee7b7]/25 transition-all disabled:opacity-60 flex items-center gap-1.5"
              >
                {requesting ? (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">notifications</span>
                )}
                {requesting ? "Requesting…" : "Enable"}
              </button>
            )}
          </div>

          {/* iOS note */}
          {notifPerm === "unsupported" && (
            <div className="mt-3 flex items-start gap-2 bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/15 rounded-lg px-3 py-2.5">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-[14px] shrink-0 mt-0.5">info</span>
              <p className="text-[11px] text-[#adaaaa] leading-relaxed">
                On <span className="text-white font-semibold">iOS</span>, add this app to your Home Screen (Share → Add to Home Screen) to enable push notifications with system sounds.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── In-app sound (Web Audio) ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[#adaaaa] uppercase tracking-widest">In-App Sound</p>
          <span className="text-[10px] text-[#494847]">Plays while the app is open</span>
        </div>

        {/* Volume */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <label className={LABEL}>Volume</label>
            <span className="text-xs font-bold text-[var(--color-primary)] tabular-nums">{volume}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adaaaa] text-[18px]">volume_mute</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 h-2 rounded-full cursor-pointer appearance-none"
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${volume}%, #2a2a2a ${volume}%)`,
                accentColor: "var(--color-primary)",
              }}
            />
            <span className="material-symbols-outlined text-[#adaaaa] text-[18px]">volume_up</span>
          </div>
          {volume === 0 && (
            <p className="text-[11px] text-amber-400 mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">warning</span>
              In-app sound is muted — only system notification will play
            </p>
          )}
        </div>

        {/* Sound type grid */}
        <label className={`${LABEL} block mb-3`}>Sound Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {SOUND_OPTIONS.map((opt) => {
            const isSelected   = selectedType === opt.id
            const isPreviewing = previewingId  === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedType(opt.id)}
                className={`
                  relative flex items-center gap-3 p-4 rounded-xl border text-left transition-all
                  ${isSelected
                    ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 shadow-[0_0_12px_rgba(var(--brand-rgb),0.12)]"
                    : "bg-[#262626] border-[#494847]/20 hover:border-[#494847]/50 hover:bg-[#2a2a2a]"
                  }
                `}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-[var(--color-primary)]/20" : "bg-[#1a1919]"
                }`}>
                  <span
                    className={`material-symbols-outlined text-[18px] transition-colors ${
                      isSelected ? "text-[var(--color-primary)]" : "text-[#adaaaa]"
                    }`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {opt.icon}
                  </span>
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold transition-colors ${isSelected ? "text-[var(--color-primary)]" : "text-white"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[11px] text-[#adaaaa] mt-0.5 leading-relaxed">{opt.description}</p>
                </div>

                {/* ▶ Preview button */}
                <button
                  type="button"
                  title={`Preview ${opt.label}`}
                  onClick={(e) => { e.stopPropagation(); handlePreview(opt.id) }}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all
                    ${isPreviewing
                      ? "bg-[var(--color-primary)] scale-110"
                      : "bg-[#1a1919] hover:bg-[var(--color-primary)]/20 hover:scale-105"
                    }
                  `}
                >
                  <span
                    className={`material-symbols-outlined text-[15px] ${isPreviewing ? "text-[var(--color-on-primary)]" : "text-[#adaaaa]"}`}
                    style={{ fontVariationSettings: isPreviewing ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {isPreviewing ? "graphic_eq" : "play_arrow"}
                  </span>
                </button>

                {/* Selected tick */}
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[var(--color-on-primary)]" style={{ fontSize: 11 }}>check</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(var(--brand-rgb),0.35)]"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save Sound Settings
          </button>
          {saved && (
            <p className="text-xs text-[#6ee7b7] flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Saved!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────── Security section ──────────────────────────────────────────────

function SecuritySection() {
  const [isPending, start] = useTransition()
  const [saved,  setSaved] = useState(false)
  const [error,  setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const form = e.currentTarget
    start(async () => {
      const r = await changeDriverPassword(new FormData(form))
      if (r?.error) { setError(r.error); return }
      form.reset()
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    })
  }

  return (
    <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 bg-[#ff6e84]/10 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-[#ff6e84]">lock</span>
        </div>
        <h3 className="text-lg font-bold font-headline text-white">Security</h3>
      </div>

      {/* Change password */}
      <p className="text-xs font-bold text-[#adaaaa] uppercase tracking-widest mb-4">Change Password</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className={LABEL}>New Password</label>
          <input
            name="new_password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className={INPUT}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Confirm New Password</label>
          <input
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            className={INPUT}
          />
        </div>
        <Feedback saved={saved} error={error} />
        <div className="pt-1">
          <SaveBtn isPending={isPending} label="Update Password" />
        </div>
      </form>

      {/* Divider */}
      <div className="h-px bg-[#494847]/10 my-6" />

      {/* Session info */}
      <p className="text-xs font-bold text-[#adaaaa] uppercase tracking-widest mb-4">Session</p>
      <LogoutButton
        className="flex items-center gap-3 w-full p-4 bg-[#262626] hover:bg-[#ff6e84]/10 border border-[#494847]/10 hover:border-[#ff6e84]/20 rounded-xl transition-all group"
      >
        <span className="material-symbols-outlined text-[#ff6e84] group-hover:scale-110 transition-transform">logout</span>
        <div>
          <p className="text-sm font-semibold text-white">Sign Out</p>
          <p className="text-xs text-[#adaaaa]">Sign out of this device</p>
        </div>
        <span className="material-symbols-outlined text-[#adaaaa] text-sm ml-auto">chevron_right</span>
      </LogoutButton>
    </div>
  )
}

// ─────────── Availability sidebar card ────────────────────────────────────

function AvailabilityCard({ isOnline: initial }: { isOnline: boolean }) {
  const [online,   setOnline]  = useState(initial)
  const [isPending, start]     = useTransition()
  const [error,    setError]   = useState<string | null>(null)

  function toggle(val: boolean) {
    setOnline(val)
    setError(null)
    start(async () => {
      const r = await toggleDriverOnline(val)
      if (r.error) { setError(r.error); setOnline(!val) }
    })
  }

  return (
    <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-2xl p-5 md:p-8 flex flex-col items-center text-center border border-[#494847]/15">
      <div className="mb-5 relative">
        <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-colors ${
          online ? "border-[#6ee7b7]/40 bg-[#6ee7b7]/10" : "border-[#494847]/40 bg-[#262626]"
        }`}>
          <span className={`material-symbols-outlined text-3xl transition-colors ${online ? "text-[#6ee7b7]" : "text-[#adaaaa]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            sensors
          </span>
        </div>
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#0e0e0e] transition-colors ${
          online ? "bg-[#6ee7b7]" : "bg-[#494847]"
        }`} style={{ boxShadow: online ? "0 0 10px rgba(110,231,183,0.4)" : undefined }} />
      </div>
      <h3 className="text-xl font-black font-headline text-white mb-1">Driver Status</h3>
      <p className="text-xs text-[#adaaaa] mb-6 leading-relaxed px-2">Toggle your visibility to the dispatch network.</p>

      {/* Online / Offline pill toggle */}
      <div className="w-full bg-[#0e0e0e] rounded-full p-1.5 flex items-center">
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={isPending}
          className={`w-1/2 py-2.5 rounded-full text-sm font-bold transition-all ${
            online
              ? "bg-[#6ee7b7] text-[#0f3d2c] shadow-[0_0_10px_rgba(110,231,183,0.3)]"
              : "text-[#adaaaa] hover:text-white"
          }`}
        >
          Online
        </button>
        <button
          type="button"
          onClick={() => toggle(false)}
          disabled={isPending}
          className={`w-1/2 py-2.5 rounded-full text-sm font-bold transition-all ${
            !online
              ? "bg-[#494847] text-white"
              : "text-[#adaaaa] hover:text-white"
          }`}
        >
          Offline
        </button>
      </div>

      <p className={`mt-3 text-[11px] font-semibold tracking-wider uppercase ${online ? "text-[#6ee7b7]/80" : "text-[#adaaaa]/60"}`}>
        {online ? "Receiving Jobs" : "Not Accepting Jobs"}
      </p>
      {isPending && <p className="text-[10px] text-[#adaaaa] mt-1">Updating…</p>}
      {error    && <p className="text-[10px] text-[#ff6e84] mt-1">{error}</p>}
    </div>
  )
}

// ─────────── Safety sidebar card ──────────────────────────────────────────

function SafetyCard() {
  const links = [
    { icon: "cancel",          label: "Cancel Active Job",  color: "text-[#ff6e84]", hover: "hover:bg-[#ff6e84]/10", href: "/dashboard/driver/active-jobs" },
    { icon: "report",          label: "Report Incident",    color: "text-[var(--color-secondary)]", hover: "hover:bg-[var(--color-secondary)]/10", href: "/dashboard/driver/support" },
    { icon: "contact_support", label: "Live Dispatch Chat", color: "text-[var(--color-primary)]", hover: "hover:bg-[var(--color-primary)]/10", href: "/dashboard/driver/support" },
  ]
  return (
    <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
      <h3 className="text-base font-bold font-headline text-white mb-5">Safety &amp; Support</h3>
      <div className="space-y-3">
        {links.map(item => (
          <a
            key={item.label}
            href={item.href}
            className={`flex items-center justify-between p-4 bg-[#262626] ${item.hover} rounded-xl border border-[#494847]/10 transition-all group`}
          >
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined ${item.color} group-hover:scale-110 transition-transform text-lg`}>{item.icon}</span>
              <span className="text-sm font-semibold text-white">{item.label}</span>
            </div>
            <span className="material-symbols-outlined text-[#adaaaa] text-sm">chevron_right</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─────────── Account card ──────────────────────────────────────────────────

function AccountCard({ email, role }: { email: string; role: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-primary)]/10 p-5" style={{ background: "linear-gradient(to bottom right, rgba(var(--brand-rgb),0.08), transparent)" }}>
      <p className="text-[10px] font-bold text-[var(--color-primary)] tracking-widest uppercase mb-3">Account</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">account_circle</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-white font-semibold truncate">{email || "—"}</p>
          <p className="text-[10px] text-[#adaaaa] capitalize mt-0.5">{role}</p>
        </div>
      </div>
    </div>
  )
}

// ─────────── Main panel ────────────────────────────────────────────────────

export type DriverSettingsPanelProps = {
  fullName: string
  phone: string
  email: string
  role: string
  vehicles: DriverVehicle[]
  isOnline: boolean
  notificationsEnabled: boolean
  deliveryAlerts: boolean
}

export function DriverSettingsPanel({
  fullName,
  phone,
  email,
  role,
  vehicles,
  isOnline,
  notificationsEnabled,
  deliveryAlerts,
}: DriverSettingsPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

      {/* ── Main column ── */}
      <section className="lg:col-span-8 space-y-6">
        <ProfileSection      fullName={fullName}  phone={phone}   email={email} />
        <VehicleSection      vehicles={vehicles} />
        <NotificationsSection
          notificationsEnabled={notificationsEnabled}
          deliveryAlerts={deliveryAlerts}
        />
        <SoundSettingsSection />
        <SecuritySection />
      </section>

      {/* ── Sidebar ── */}
      <aside className="lg:col-span-4 space-y-5">
        <AvailabilityCard isOnline={isOnline} />
        <SafetyCard />
        <AccountCard email={email} role={role} />
      </aside>
    </div>
  )
}

