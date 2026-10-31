'use client'

import { createElement, useEffect, useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import styles from './LocationPermission.module.css'

type LocationElement = HTMLElement & {
  position?: GeolocationPosition | null
  error?: GeolocationPositionError | null
}

export function supportsLocationControl() {
  return typeof window !== 'undefined' && 'HTMLGeolocationElement' in window
}

export function LocationButton({ onRequest, onPosition, onError, getRequestVersion, disabled = false, suspended = false, label = 'Use my location' }: {
  onRequest: () => void
  onPosition: (position: GeolocationPosition) => void
  onError: (error: unknown) => void
  getRequestVersion?: () => string | number
  disabled?: boolean
  suspended?: boolean
  label?: string
}) {
  const [native, setNative] = useState(false)
  const control = useRef<LocationElement | null>(null)
  const requestVersion = useRef<string | number | null>(null)
  const callbacks = useRef({ onPosition, onError, getRequestVersion })
  callbacks.current = { onPosition, onError, getRequestVersion }
  useEffect(() => { setNative(supportsLocationControl()) }, [])
  useEffect(() => {
    const element = control.current
    if (!element) return
    const receive = () => {
      // A slow GPS result must not overwrite an address edited after the click.
      if (requestVersion.current !== null && requestVersion.current !== (callbacks.current.getRequestVersion?.() ?? 0)) return
      requestVersion.current = null
      if (element.error) callbacks.current.onError(element.error)
      else if (element.position) callbacks.current.onPosition(element.position)
    }
    element.addEventListener('location', receive)
    return () => element.removeEventListener('location', receive)
  }, [native, disabled, suspended])

  // A real, visible browser control is required for permission recovery. Never
  // hide it behind another button or call .click() to simulate user consent.
  // Chromium allows at most three permission elements. Suspend the background
  // controls while the shared recovery dialog owns the active control.
  if (native && !disabled && !suspended) return createElement('geolocation', {
    ref: control, className: styles.native, accuracymode: 'precise',
    'aria-label': label, lang: 'en',
    onClick: () => { requestVersion.current = callbacks.current.getRequestVersion?.() ?? 0 },
  })
  return <button type="button" disabled={disabled || suspended} aria-label={label} className={styles.fallback} onClick={onRequest}>
    <LocateFixed aria-hidden="true" size={18} />{disabled ? 'Locating…' : 'Use my location'}
  </button>
}
