'use client'

import { useEffect, useRef } from 'react'
import type { LocationIssue } from '@/lib/browser-location'
import { locationSettingsGuide } from '@/lib/location-settings'
import { LocationButton, supportsLocationControl } from './LocationButton'
import styles from './LocationPermission.module.css'

export function LocationPermissionDialog({ issue, onClose, onRetry, onPosition, onError }: {
  issue: LocationIssue
  onClose: () => void
  onRetry: () => void
  onPosition: (position: GeolocationPosition) => void
  onError: (error: unknown) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const guide = locationSettingsGuide(navigator.userAgent, navigator.maxTouchPoints)
  const blocked = issue.code === 1
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => previous?.focus({ preventScroll: true })
  }, [])
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="location-permission-title"
    onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => event.stopPropagation()}>
    <header><h2 id="location-permission-title">{blocked ? 'Enable your location' : 'Find your location'}</h2><button type="button" onClick={onClose} aria-label="Close location help">×</button></header>
    <p>{blocked ? 'Your browser or device has blocked location access.' : issue.message}</p>
    <LocationButton onRequest={onRetry} onPosition={onPosition} onError={onError} />
    {blocked && <>
      <p className={styles.hint}>{supportsLocationControl()
        ? 'Tap the location button to reopen the browser’s permission dialog. If your device still blocks access, follow these steps.'
        : 'This browser requires a saved block to be changed in settings. After allowing access, tap Use my location.'}</p>
      <h3>{guide.device}</h3>
      <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {guide.systemSettingsUrl && <a className={styles.settings} href={guide.systemSettingsUrl}>Open Windows Location Settings ↗</a>}
      <a className={styles.help} href={guide.helpUrl} target="_blank" rel="noopener noreferrer">Official settings guide ↗</a>
    </>}
    <button className={styles.manual} type="button" onClick={onClose}>Enter address manually</button>
  </dialog>
}
