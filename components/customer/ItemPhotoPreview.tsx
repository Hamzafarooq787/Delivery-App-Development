'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './ItemPhotoPreview.module.css'

export function ItemPhotoPreview({ url, label, onRemove }: { url: string; label: string; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (expanded) dialog.current?.showModal() }, [expanded])
  const close = () => {
    setExpanded(false)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <div className={styles.photo}>
    <button ref={trigger} className={styles.preview} type="button" aria-label={`Enlarge ${label}`} onClick={() => setExpanded(true)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} />
    </button>
    <button type="button" className={styles.remove} aria-label={`Remove ${label}`} onClick={onRemove}>Remove</button>
    {expanded && <dialog ref={dialog} className={styles.dialog} aria-label={label} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); close() }}>
      <div><strong>{label}</strong><button type="button" autoFocus onClick={close}>Close ×</button></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} />
    </dialog>}
  </div>
}
