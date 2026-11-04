'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Minus, Plus } from 'lucide-react'
import type { ShoppingItem } from '@/app/actions/shopping'
import { ItemPhotoPreview } from './ItemPhotoPreview'
import styles from './ShoppingSteps.module.css'

export function ShoppingItemEditor({ item, existing, maxQuantity, busy, error, showDetails, onChange: onParentChange, onPhoto, onSave, onCancel, onDelete }: {
  item: ShoppingItem
  existing: boolean
  maxQuantity: number
  busy: boolean
  error: string
  showDetails: boolean
  onChange: (field: keyof ShoppingItem, value: unknown) => void
  onPhoto: (file: File) => void
  onSave: (draft: ShoppingItem) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(item)
  const [price, setPrice] = useState(String(item.estimated_price ?? ''))
  const onChange = (field: keyof ShoppingItem, value: unknown) => {
    if (field === 'photo_url') onParentChange(field, value)
    else setDraft(previous => ({ ...previous, [field]: value }))
  }
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    dialog.current?.querySelector<HTMLInputElement>(showDetails ? '[data-item-detail]' : '[data-item-name]')?.focus({preventScroll:true})
    return () => previous?.focus({ preventScroll: true })
  }, [])
  return <dialog ref={dialog} className={styles.editorDialog} aria-labelledby="shopping-editor-title"
    onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); if (!busy) onCancel() }}>
    <header><h2 id="shopping-editor-title">{existing ? 'Edit item' : 'Add an item'}</h2><button type="button" aria-label="Close item editor" disabled={busy} onClick={onCancel}>×</button></header>
    <form onSubmit={e => { e.preventDefault(); if (!busy) onSave({ ...draft, photo_url: item.photo_url, estimated_price: price.trim() === "" ? null : /^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(price.trim()) ? Number(price.replace(",", ".")) : NaN }) }}>
      <div className={styles.stack}>
        <label>Item name<input data-item-name required maxLength={200} value={draft.name} onChange={e => onChange('name', e.target.value)} placeholder="e.g. Whole milk 2L" /></label>
        <div className={styles.columns}>
          <div><span>Quantity</span><div className={styles.quantity}><button type="button" aria-label="Reduce quantity" disabled={busy || draft.quantity <= 1} onClick={() => onChange('quantity', draft.quantity - 1)}><Minus size={18} /></button><output aria-live="polite">{draft.quantity}</output><button type="button" aria-label="Increase quantity" disabled={busy || draft.quantity >= maxQuantity} onClick={() => onChange('quantity', draft.quantity + 1)}><Plus size={18} /></button></div></div>
          <label>Est. price per item (£)<input type="text" maxLength={8} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Optional" /></label>
        </div>
        <details className={styles.disclosure} open={showDetails || undefined}>
          <summary>Brand, size & instructions (optional)</summary>
          <div className={styles.stack}><label>Brand, size or variant<input data-item-detail maxLength={200} value={draft.brand_size_variant ?? ''} onChange={e => onChange('brand_size_variant', e.target.value)} placeholder="e.g. 5 kg bag, preferred brand" /></label><label>Item instructions<textarea maxLength={500} rows={2} value={draft.notes ?? ''} onChange={e => onChange('notes', e.target.value)} placeholder="Anything your shopper should know?" /></label></div>
        </details>
        <div className={styles.photoArea}>
          {item.photo_url && <ItemPhotoPreview url={item.photo_url} label="Shopping item photo" onRemove={() => { if (!busy) onChange('photo_url', null) }} />}
          <label className={styles.photoUpload}><Camera size={22} /><span>{busy ? 'Preparing photo…' : 'Add photo'}<small>Compressed automatically · up to 10 MB</small></span><input className={styles.fileInput} type="file" accept="image/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onPhoto(file) }} /></label>
        </div>
        <p className={styles.hint}>Up to {maxQuantity} units of one product.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {existing && <button className={`${styles.link} ${styles.danger}`} disabled={busy} type="button" onClick={onDelete}>Remove item</button>}
      </div>
      <div className={styles.actions}><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Preparing…' : 'Save item'}</button></div>
    </form>
  </dialog>
}
