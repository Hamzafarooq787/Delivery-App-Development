/**
 * Shared notification sound utility
 * Reads user preferences from localStorage and plays the selected sound at the chosen volume.
 *
 * localStorage keys:
 *   notif_sound_type   – "chime" | "bell" | "ping" | "soft"   (default: "chime")
 *   notif_sound_volume – 0–100 (default: 70)
 */

export type SoundType = "chime" | "bell" | "ping" | "soft"

export const SOUND_OPTIONS: { id: SoundType; label: string; description: string; icon: string }[] = [
  { id: "chime",  label: "Chime",  description: "Two rising tones — classic alert",   icon: "music_note" },
  { id: "bell",   label: "Bell",   description: "Single warm bell strike",            icon: "notifications" },
  { id: "ping",   label: "Ping",   description: "Short, crisp high-pitched ping",     icon: "circle_notifications" },
  { id: "soft",   label: "Soft",   description: "Gentle low-frequency pulse",         icon: "volume_down" },
]

export const SOUND_LS_TYPE   = "notif_sound_type"
export const SOUND_LS_VOLUME = "notif_sound_volume"

export function getSoundPrefs(): { type: SoundType; volume: number } {
  if (typeof window === "undefined") return { type: "chime", volume: 70 }
  const type   = (localStorage.getItem(SOUND_LS_TYPE)   as SoundType) ?? "chime"
  const volume = parseInt(localStorage.getItem(SOUND_LS_VOLUME) ?? "70", 10)
  return {
    type:   SOUND_OPTIONS.some((s) => s.id === type) ? type : "chime",
    volume: Math.max(0, Math.min(100, isNaN(volume) ? 70 : volume)),
  }
}

export function setSoundPrefs(type: SoundType, volume: number) {
  if (typeof window === "undefined") return
  localStorage.setItem(SOUND_LS_TYPE,   type)
  localStorage.setItem(SOUND_LS_VOLUME, String(Math.round(volume)))
}

/** Play a notification sound using Web Audio API.
 *  Reads type + volume from localStorage automatically.
 *  Pass `preview = true` to always play even at volume 0 (for the settings preview). */
export function playNotificationSound(preview = false) {
  try {
    const { type, volume } = getSoundPrefs()
    const gain = preview ? 0.22 : (volume / 100) * 0.22  // max master gain = 0.22
    if (gain === 0 && !preview) return

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx() as AudioContext

    switch (type) {
      case "chime":
        // Two rising tones: 880 → 1100 Hz
        playTone(ctx, 880,  gain, 0,    0.35)
        playTone(ctx, 1100, gain, 0.12, 0.35)
        break

      case "bell":
        // Single warm bell: fundamental + harmonic at 2x, both decay slowly
        playTone(ctx, 660,  gain,        0, 0.6,  "triangle")
        playTone(ctx, 1320, gain * 0.4,  0, 0.6,  "sine")
        break

      case "ping":
        // Fast crisp high ping
        playTone(ctx, 1760, gain, 0, 0.18, "sine")
        break

      case "soft":
        // Gentle low pulse — two overlapping sine waves
        playTone(ctx, 330, gain * 0.9, 0,    0.5, "sine")
        playTone(ctx, 440, gain * 0.6, 0.08, 0.5, "sine")
        break
    }

    // Auto-close context after sounds finish
    setTimeout(() => { try { ctx.close() } catch {} }, 1500)
  } catch {}
}

function playTone(
  ctx: AudioContext,
  freq: number,
  peakGain: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = "sine",
) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.start(t0)
  osc.stop(t0 + duration)
}
