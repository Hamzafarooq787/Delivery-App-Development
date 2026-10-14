"use client"
import { useLayoutEffect, useRef } from 'react'

/** Safari's layout viewport can include the space behind browser toolbars.
 * Keep this screen sized to the visible area, also on resize/rotation. */
export function useVisibleViewport() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    let frame = 0
    const measure = () => {
      // Do not resize the layout while the user is pinch zooming.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
      const height = Math.floor(Math.min(window.innerHeight, viewport?.height ?? window.innerHeight))
      ref.current?.style.setProperty('--customer-viewport-height', `${height}px`)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('resize', schedule)
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
    }
  }, [])
  return ref
}
