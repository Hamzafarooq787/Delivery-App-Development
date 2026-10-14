"use client"
import { useLayoutEffect, useRef } from 'react'
import { customerHeightFlags } from '@/lib/customer-viewport'

/** The initial viewport is set in the head; resize only when height changes. */
export function useVisibleViewport() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    let frame = 0
    let lastHeight = parseInt(root.style.getPropertyValue('--customer-viewport-height'), 10) || 0
    const measure = () => {
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
      const height = Math.floor(Math.min(window.innerHeight, viewport?.height ?? window.innerHeight))
      if (!ref.current || height < 1 || height === lastHeight) return
      lastHeight = height
      ref.current.style.setProperty('--customer-viewport-height', height + 'px')
      root.setAttribute('data-customer-height', customerHeightFlags(height))
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
      root.removeAttribute('data-customer-height')
      root.style.removeProperty('--customer-viewport-height')
    }
  }, [])
  return ref
}
