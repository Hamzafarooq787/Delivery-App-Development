export const SLIDE_COUNT = 6
export const INTERACTIVE_SELECTOR = "a,button,input,select,textarea,label,summary,details,[role='button'],[role='dialog'],[data-no-slide]"

export function clampSlide(index: number) {
  return Math.max(0, Math.min(SLIDE_COUNT - 1, index))
}

// Mouse/trackpad: scrolling down or right advances; up or left returns.
export function wheelDirection(deltaX: number, deltaY: number): -1 | 0 | 1 {
  const dominant = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
  return dominant === 0 ? 0 : dominant > 0 ? 1 : -1
}

export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  const distance = Math.max(Math.abs(dx), Math.abs(dy))
  if (distance < 55) return 0
  // Finger up/left moves content forward; finger down/right goes back.
  if (Math.abs(dx) >= Math.abs(dy) * 1.25) return dx < 0 ? 1 : -1
  if (Math.abs(dy) >= Math.abs(dx) * 1.25) return dy < 0 ? 1 : -1
  return 0
}

export function isDoubleTap(previous: { time: number; x: number; y: number } | null, current: { time: number; x: number; y: number }) {
  return !!previous && current.time - previous.time <= 320 && current.time > previous.time && Math.hypot(current.x - previous.x, current.y - previous.y) <= 28
}
