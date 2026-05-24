/**
 * Shared notification sound utility
 *
 * Two-tier sound system:
 *  1. System OS notification  — browser fires a native OS alert that plays the
 *     device's own notification ringtone (Android, Windows, macOS, Linux).
 *     This is the most reliable sound and works even when the tab is in the
 *     background.  Not available on iOS Safari (browser limitation).
 *
 *  2. Web Audio API (in-app) — plays immediately while the tab is active.
 *     Volume and sound type are controlled by the driver from Settings.
 *     Falls back gracefully when OS notifications are denied or unsupported.
 *
 * AudioContext lifetime
 * ─────────────────────
 * Browsers require a user gesture before they allow audio.  We create one
 * shared context and call primeAudio() on the first click so it is already
 * in "running" state when a realtime notification arrives later.
 *
 * localStorage keys
 * ─────────────────
 *   notif_sound_type   – "chime" | "bell" | "ping" | "soft"  (default: "chime")
 *   notif_sound_volume – 0–100                                (default: 80)
 */

// ── Types & constants ─────────────────────────────────────────────────────────

export type SoundType = "chime" | "bell" | "ping" | "soft"

export const SOUND_OPTIONS: {
  id: SoundType
  label: string
  description: string
  icon: string
}[] = [
  { id: "chime", label: "Chime", description: "Two rising tones — classic alert",  icon: "music_note"          },
  { id: "bell",  label: "Bell",  description: "Single warm bell strike with decay", icon: "notifications"       },
  { id: "ping",  label: "Ping",  description: "Short crisp high-pitched ping",      icon: "circle_notifications"},
  { id: "soft",  label: "Soft",  description: "Gentle two-note low pulse",          icon: "volume_down"         },
]

export const SOUND_LS_TYPE   = "notif_sound_type"
export const SOUND_LS_VOLUME = "notif_sound_volume"

// ── Preferences ───────────────────────────────────────────────────────────────

export function getSoundPrefs(): { type: SoundType; volume: number } {
  if (typeof window === "undefined") return { type: "chime", volume: 80 }
  const raw  = localStorage.getItem(SOUND_LS_TYPE) as SoundType
  const type = SOUND_OPTIONS.some((s) => s.id === raw) ? raw : "chime"
  const vol  = parseInt(localStorage.getItem(SOUND_LS_VOLUME) ?? "80", 10)
  return { type, volume: Math.max(0, Math.min(100, isNaN(vol) ? 80 : vol)) }
}

export function setSoundPrefs(type: SoundType, volume: number) {
  if (typeof window === "undefined") return
  localStorage.setItem(SOUND_LS_TYPE,   type)
  localStorage.setItem(SOUND_LS_VOLUME, String(Math.round(volume)))
}

// ── Singleton AudioContext ────────────────────────────────────────────────────

let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  try {
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new Ctor() as AudioContext
    }
    return _ctx
  } catch { return null }
}

/**
 * Prime the Web Audio context on a user gesture (click / tap).
 * Call this from any interactive element early in the session so
 * audio will play when a realtime notification arrives later.
 */
export async function primeAudio(): Promise<void> {
  try {
    const ctx = getCtx()
    if (ctx && ctx.state === "suspended") {
      await ctx.resume()
    }
  } catch {}
}

// ── System notification helpers ───────────────────────────────────────────────

/** Whether the browser supports the Notification API at all. */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

/** Whether OS notifications are currently allowed. */
export function canUseSystemSound(): boolean {
  return isNotificationSupported() && Notification.permission === "granted"
}

/** Request OS notification permission (must be called from a user gesture). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied"
  if (Notification.permission !== "default") return Notification.permission
  try { return await Notification.requestPermission() } catch { return "denied" }
}

// ── Main sound player ─────────────────────────────────────────────────────────

/**
 * Play a notification alert.
 *
 * @param preview  When true, ignores the saved volume and plays at full
 *                 audible level — used by the ▶ preview buttons in Settings.
 */
export async function playNotificationSound(preview = false): Promise<void> {
  if (typeof window === "undefined") return
  const { volume } = getSoundPrefs()
  // In preview mode always play; otherwise respect volume setting
  const level = preview ? 1 : volume / 100
  if (level === 0 && !preview) return

  await _playWebAudio(level)
}

// ── Web Audio implementation ──────────────────────────────────────────────────

async function _playWebAudio(level: number): Promise<void> {
  try {
    const ctx = getCtx()
    if (!ctx) return

    // Try to resume a suspended context (happens when no prior user gesture)
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {})
    }
    if (ctx.state !== "running") return   // nothing we can do without gesture

    const { type } = getSoundPrefs()

    // Master gain: level (0–1) scaled so peak is ~0.30 — loud enough to hear,
    // safe from clipping.  Preview always uses full gain.
    const masterGain = level * 0.30

    switch (type) {
      case "chime":
        // Classic ascending two-note chime (880 → 1100 Hz)
        _tone(ctx, 880,  masterGain,       0,    0.45)
        _tone(ctx, 1100, masterGain,       0.14, 0.45)
        break

      case "bell":
        // Warm triangle fundamental + sine harmonic, both with slow decay
        _tone(ctx, 660,  masterGain,        0, 0.75, "triangle")
        _tone(ctx, 1320, masterGain * 0.38, 0, 0.75, "sine")
        break

      case "ping":
        // Single crisp high sine — short attack, quick decay
        _tone(ctx, 1760, masterGain, 0, 0.20, "sine")
        break

      case "soft":
        // Gentle overlapping pair — 330 + 440 Hz
        _tone(ctx, 330, masterGain * 0.85, 0,    0.55)
        _tone(ctx, 440, masterGain * 0.55, 0.09, 0.50)
        break
    }
  } catch {}
}

/**
 * Schedule a single oscillator tone on an already-running AudioContext.
 *
 * gain.gain envelope:
 *   0.0001  (now+delay)     — tiny non-zero start (exponential ramps cannot
 *                             start from 0; any value < 1e-4 is inaudible)
 *   peakGain (+ 15 ms)      — fast linear attack
 *   0.0001  (+ durationS)   — exponential decay to silence
 */
function _tone(
  ctx: AudioContext,
  freq: number,
  peakGain: number,
  delayS: number,
  durationS: number,
  waveType: OscillatorType = "sine",
) {
  if (peakGain <= 0) return

  const osc = ctx.createOscillator()
  const g   = ctx.createGain()
  osc.connect(g)
  g.connect(ctx.destination)

  osc.type = waveType
  osc.frequency.value = freq

  const t = ctx.currentTime + delayS
  // Must start from a tiny positive value — exponential ramp from 0 is undefined
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peakGain, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + durationS)

  osc.start(t)
  osc.stop(t + durationS + 0.05)   // small tail so the ramp reaches 0.0001
}
