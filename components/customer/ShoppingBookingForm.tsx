'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Camera, Pencil, ShoppingBag } from 'lucide-react'
import { getShoppingBookingSettings, getShoppingQuote, type BfmSettings, type ShoppingItem, type ShoppingQuote } from '@/app/actions/shopping'
import { startOrderCheckout } from '@/app/actions/order-checkout'
import { DEFAULT_BOOKING_PRICING } from '@/lib/booking-pricing'
import { requestBrowserLocation, locationIssue, type LocationIssue } from '@/lib/browser-location'
import { compressImage } from '@/lib/image-compress'
import { createClient } from '@/lib/supabase/client'
import { googleReverseGeocode } from '@/lib/google'
import { shoppingEstimate, duplicateShoppingProduct, newShoppingRequestId } from '@/lib/shopping-booking'
import { validateShoppingItems } from '@/lib/shopping-validation'
import { useBookingDraft } from '@/hooks/use-booking-draft'
import { ShoppingAddressField, type ShoppingPlace } from './ShoppingAddressField'
import { ShoppingItemEditor } from './ShoppingItemEditor'
import { ItemPhotoPreview } from './ItemPhotoPreview'
import { LocationButton } from './LocationButton'
import { LocationPermissionDialog } from './LocationPermissionDialog'
import styles from './ShoppingSteps.module.css'

const BookingRouteMap = dynamic(() => import('./BookingRouteMap'), { ssr: false })
type Item = ShoppingItem & { id: string }
type Draft = { items: Item[]; savedIds: string[]; shopName: string; shopInput: string; deliveryInput: string; shop: ShoppingPlace | null; delivery: ShoppingPlace | null; shopInstructions: string; deliveryInstructions: string }
const steps = ['Shopping items', 'Shop & delivery', 'Replacements', 'Review & Pay']
const titles = ['What should we buy?', 'Where should we shop?', 'If an item is unavailable', 'Check your shopping']
const choices = [
  { value: 'contact_me', label: 'Ask me first', description: 'Approve a replacement before purchase.' },
  { value: 'skip_if_unavailable', label: 'Skip the item', description: 'Leave it out and refund the difference.' },
  { value: 'best_alternative', label: 'Suggest an alternative', description: 'Approve the suggestion before purchase.' },
] as const
const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
const freshItem = (): Item => ({ id: newShoppingRequestId(), name: '', quantity: 1, estimated_price: null, brand_size_variant: null, notes: null, photo_url: null, substitution_preference: 'contact_me' })

function ShoppingSummary({ items, onEdit }: { items: Item[]; onEdit: () => void }) {
  return <section className={styles.card} aria-label="Shopping summary"><div className={styles.cardHeading}><strong>Your shopping · {items.length} products</strong><button type="button" className={styles.link} onClick={onEdit}>Edit</button></div><div className={styles.summaryRows} tabIndex={0} aria-label="Shopping products">{items.map(i => <p key={i.id}><span>{i.name} · Qty {i.quantity}</span><strong>{i.estimated_price == null ? 'Not estimated' : money(i.estimated_price * i.quantity)}</strong></p>)}</div></section>
}

export function NewShoppingRequestModal({ onClose }: { onClose: () => void }) {
  const [limits, setLimits] = useState(DEFAULT_BOOKING_PRICING)
  const [settings, setSettings] = useState<BfmSettings | null>(null)
  const [settingsError, setSettingsError] = useState('')
  const [step, setStep] = useState(1)
  const [items, setItems] = useState<Item[]>([])
  const [editor, setEditor] = useState<Item | null>(null)
  const [editorError, setEditorError] = useState('')
  const [editorDetails, setEditorDetails] = useState(false)
  const [individual, setIndividual] = useState(false)
  const [replacementIndex, setReplacementIndex] = useState(0)
  const [limitsAccepted, setLimitsAccepted] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [shopName, setShopName] = useState('')
  const [shopInput, setShopInput] = useState('')
  const [deliveryInput, setDeliveryInput] = useState('')
  const [shop, setShop] = useState<ShoppingPlace | null>(null)
  const [delivery, setDelivery] = useState<ShoppingPlace | null>(null)
  const [shopInstructions, setShopInstructions] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [quote, setQuote] = useState<ShoppingQuote | null>(null)
  const [estimate, setEstimate] = useState<ShoppingQuote | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState('')
  const [estimateRetry, setEstimateRetry] = useState(0)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationHelp, setLocationHelp] = useState<LocationIssue | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const frame = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLElement>(null)
  const quoteVersion = useRef(0)
  const gpsVersion = useRef(0)
  const editorVersion = useRef(0)
  const requestKey = useRef<string | null>(null)
  const mounted = useRef(true)
  const submitLock = useRef(false)
  const uploadLock = useRef(false)
  const total = shoppingEstimate(items)
  const maximum = settings?.max_purchase_amount ?? 100
  const savedIds = items.map(i => i.id)
  const persistBooking = useBookingDraft<Draft>('buy_for_me', { items, savedIds, shopName, shopInput, deliveryInput, shop, delivery, shopInstructions, deliveryInstructions }, draft => {
    if (!Array.isArray(draft?.items)) return
    // Legacy drafts included an unfinished row; only restore saved products.
    setItems(draft.items.filter(i => i && typeof i.id === 'string' && typeof i.name === 'string' && i.name.trim() && (!Array.isArray(draft.savedIds) || draft.savedIds.includes(i.id))))
    setShopName(draft.shopName ?? ''); setShopInput(draft.shopInput ?? ''); setDeliveryInput(draft.deliveryInput ?? '')
    setShop(draft.shop ?? null); setDelivery(draft.delivery ?? null); setShopInstructions(draft.shopInstructions ?? ''); setDeliveryInstructions(draft.deliveryInstructions ?? '')
  })
  useEffect(() => {
    let active = true
    void getShoppingBookingSettings().then(([pricing, bfm]) => {
      if (active) { setLimits(pricing); setSettings(bfm); setSettingsError('') }
    }).catch(() => { if (active) setSettingsError('Shopping settings could not load. Close this form and try again.') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    mounted.current = true
    const viewport = window.visualViewport
    const measure = () => {
      if (viewport && viewport.scale !== 1) return
      const height = Math.floor(Math.min(window.innerHeight, viewport?.height ?? window.innerHeight))
      frame.current?.style.setProperty('--shopping-height', `${height}px`)
      if (frame.current) { frame.current.style.top = `${viewport?.offsetTop ?? 0}px`; frame.current.dataset.compact = String(height < 700) }
    }
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; measure()
    frame.current?.querySelector<HTMLElement>('[aria-label="Close shopping form"]')?.focus()
    viewport?.addEventListener('resize', measure); viewport?.addEventListener('scroll', measure); window.addEventListener('resize', measure)
    return () => {
      mounted.current = false; gpsVersion.current++; quoteVersion.current++; editorVersion.current++
      document.body.style.overflow = overflow; previous?.focus()
      viewport?.removeEventListener('resize', measure); viewport?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure)
    }
  }, [])
  useEffect(() => { if (body.current) body.current.scrollTop = 0; body.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true }) }, [step])
  useEffect(() => {
    let active = true
    setEstimate(null); setEstimateError(''); setEstimating(false)
    if (step !== 2 || !shop || !delivery || !settings?.enabled) return
    setEstimating(true)
    const timer = setTimeout(() => {
      void getShoppingQuote({shop_lat:shop.lat,shop_lng:shop.lng,delivery_lat:delivery.lat,delivery_lng:delivery.lng,estimated_items_total:total}).then(result => {
        if (!active) return
        if ('error' in result) setEstimateError(result.error)
        else setEstimate(result.data)
      }).catch(() => { if (active) setEstimateError('Could not calculate the estimate. Please retry.') }).finally(() => { if (active) setEstimating(false) })
    }, 400)
    return () => { active = false; clearTimeout(timer) }
  }, [step, shop?.lat, shop?.lng, delivery?.lat, delivery?.lng, total, settings?.enabled, estimateRetry])
  function invalidate() { quoteVersion.current++; setQuote(null); setQuoting(false); setConfirmed(false); requestKey.current = null; setError('') }
  function cancelGps() { gpsVersion.current++; setLocating(false); setLocationHelp(null) }
  function go(next: number) { if (next < step) invalidate(); cancelGps(); setError(''); setStep(next) }
  function validItems() {
    const message = validateShoppingItems(items, limits)
    if (message) { setError(message); return false }
    if (total > maximum) { setError(`Keep your estimated shopping within ${money(maximum)}.`); return false }
    return true
  }
  async function loadQuote() {
    if (!validItems() || !shop || !delivery || !limitsAccepted) return
    const version = ++quoteVersion.current
    setStep(4); setQuote(null); setConfirmed(false); setQuoting(true); setError('')
    try {
      const result = await getShoppingQuote({ shop_lat: shop.lat, shop_lng: shop.lng, delivery_lat: delivery.lat, delivery_lng: delivery.lng, estimated_items_total: total })
      if (!mounted.current || version !== quoteVersion.current) return
      if ('error' in result) setError(result.error); else setQuote(result.data)
    } catch { if (mounted.current && version === quoteVersion.current) setError('Could not calculate the price. Check your connection and retry.') }
    finally { if (mounted.current && version === quoteVersion.current) setQuoting(false) }
  }
  function next() {
    if (submitting || uploading || locating || quoting) return
    if (step === 1) {
      if (!settings || settingsError) { setError(settingsError || 'Please wait for shopping settings to load.'); return }
      if (!settings.enabled) { setError('Buy for Me is temporarily unavailable.'); return }
      if (validItems()) go(2)
    } else if (step === 2) {
      if (!shopName.trim() || !shop || !delivery) { setError('Enter the shop name and select both addresses from suggestions or the map.'); return }
      go(3)
    } else if (step === 3) {
      if (!limitsAccepted) { setError('Confirm the shopping size and weight limits to continue.'); return }
      void loadQuote()
    } else void submit()
  }
  async function submit() {
    if (submitLock.current || !confirmed || !limitsAccepted || !quote || !shop || !delivery || uploading || !validItems()) return
    submitLock.current = true; setSubmitting(true); setError('')
    try {
      persistBooking(); requestKey.current ??= newShoppingRequestId()
      const result = await startOrderCheckout({ requestKey: requestKey.current, type: 'buy_for_me', order: {
        request_key: requestKey.current, limits_acknowledged: limitsAccepted, consent_token: quote.consentToken,
        shop_name: shopName.trim(), shop_address: shop.address, shop_lat: shop.lat, shop_lng: shop.lng,
        shop_instructions: shopInstructions.trim() || null, delivery_instructions: deliveryInstructions.trim(),
        delivery_address: delivery.address, delivery_lat: delivery.lat, delivery_lng: delivery.lng,
        shopping_items: items.map(({ id: _id, ...i }) => ({ ...i, name: i.name.trim() })),
      } })
      if (!mounted.current) return
      if ('error' in result) setError(result.error); else window.location.assign(result.url)
    } catch { if (mounted.current) setError('We could not confirm checkout. Check My Deliveries before trying again.') }
    finally { submitLock.current = false; if (mounted.current) setSubmitting(false) }
  }
  function openEditor(existing?: Item, details = false) {
    if (!existing && items.length >= limits.maxShoppingProducts) { setError(`You can add up to ${limits.maxShoppingProducts} different products.`); return }
    editorVersion.current++; setEditor(existing ? { ...existing } : freshItem()); setEditorError(''); setEditorDetails(details)
  }
  function closeEditor() { if (!uploadLock.current) { editorVersion.current++; setEditor(null); setEditorError('') } }
  function saveItem() {
    if (!editor || uploadLock.current) return
    const cleaned = { ...editor, name: editor.name.trim(), brand_size_variant: editor.brand_size_variant?.trim() || null }
    const others = items.filter(i => i.id !== editor.id)
    const message = validateShoppingItems([...others, cleaned], limits)
    if (message) { setEditorError(message); return }
    if (duplicateShoppingProduct(others, cleaned)) { setEditorError('This product is already listed. Edit its quantity instead.'); return }
    if (shoppingEstimate([...others, cleaned]) > maximum) { setEditorError(`Your estimated shopping must be ${money(maximum)} or less.`); return }
    const exists = items.some(i => i.id === editor.id)
    setItems(prev => exists ? prev.map(i => i.id === editor.id ? cleaned : i) : [...prev, cleaned])
    invalidate(); closeEditor()
  }
  function removeItem(id: string) { setItems(prev => prev.filter(i => i.id !== id)); setReplacementIndex(0); invalidate(); closeEditor() }
  async function photo(file: File) {
    if (!editor || uploadLock.current) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { setEditorError('Choose an image smaller than 10 MB.'); return }
    const id = editor.id, version = editorVersion.current
    const current = () => mounted.current && version === editorVersion.current
    uploadLock.current = true; setUploading(true); setEditorError('')
    try {
      const client = createClient(); const { data: { user } } = await client.auth.getUser()
      if (!user) throw new Error('Session expired')
      const compressed = await compressImage(file, 1280, 0.82), path = `${user.id}/bfm-items/${newShoppingRequestId()}.jpg`
      const result = await client.storage.from('delivery-item-photos').upload(path, compressed, { contentType: compressed.type, upsert: false })
      if (result.error) throw result.error
      const { data } = client.storage.from('delivery-item-photos').getPublicUrl(path)
      if (current()) setEditor(prev => prev?.id === id ? { ...prev, photo_url: data.publicUrl } : prev)
    } catch { if (current()) setEditorError('Photo upload failed. Try again.') }
    finally { uploadLock.current = false; if (mounted.current) setUploading(false) }
  }
  async function gps(position?: GeolocationPosition) {
    setLocationHelp(null); const version = ++gpsVersion.current
    const current = () => mounted.current && version === gpsVersion.current
    setLocating(true)
    try {
      const pos = position ?? await requestBrowserLocation()
      if (!current()) return
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }, fallback = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
      setDelivery({ ...point, address: fallback }); setDeliveryInput(fallback); setUserLocation(point); invalidate(); setLocating(false)
      const address = await googleReverseGeocode(point.lat, point.lng).catch(() => null)
      if (address && current()) { setDelivery({ ...point, address }); setDeliveryInput(address) }
    } catch (e) { if (current()) setLocationHelp(locationIssue(e)) }
    finally { if (current()) setLocating(false) }
  }
  const replacementItem = items[replacementIndex] ?? items[0]
  const map = <BookingRouteMap pickup={shop} destination={delivery} userLocation={userLocation} mapHeight="var(--shopping-map-height,180px)" />
  return <div ref={frame} className={styles.overlay} onKeyDown={e => {
    if (e.key === 'Escape' && !submitting && !uploading) onClose()
    if (e.key === 'Tab') {
      const all = Array.from(frame.current?.querySelectorAll<HTMLElement>('button:not(:disabled),geolocation,input:not(:disabled),textarea:not(:disabled),summary') ?? []).filter(el => el.getClientRects().length)
      const first = all[0], last = all[all.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
  }}><div className={styles.backdrop} />
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="shopping-title">
      <header className={styles.header}><div className={styles.wordmark}><b>Go</b>Drop</div><button type="button" aria-label="Close shopping form" disabled={submitting || uploading} onClick={onClose}>×</button></header>
      <div className={styles.progressWrap}><div className={styles.stepLine}><span>{step} of 4 · {steps[step - 1]}</span><nav aria-label="Shopping steps">{steps.map((name, i) => <button type="button" key={name} disabled={i + 1 > step || submitting} aria-current={i + 1 === step ? 'step' : undefined} onClick={() => go(i + 1)}>{i + 1} {['Items', 'Locations', 'Replacements', 'Review & Pay'][i]}</button>)}</nav></div><div className={styles.progress}><div style={{ width: `${step * 25}%` }} /></div></div>
      <main className={styles.body} ref={body}>
        <h2 id="shopping-title" tabIndex={-1}>{titles[step - 1]}</h2>
        {step === 1 && <div className={styles.layout}><div className={styles.stack}>
          <div className={styles.listHeading}><span>{items.length} of {limits.maxShoppingProducts} products</span><strong>{money(total)} estimated</strong></div>
          <section className={styles.savedList} aria-label="Added shopping items" tabIndex={0}>
            {!items.length && <div className={styles.empty}><ShoppingBag size={36} /><strong>Your shopping list starts here</strong><span>Add a product, quantity and an optional photo.</span></div>}
            {items.map(i => <article key={i.id} className={styles.savedItem}>
              <div className={styles.itemPhoto}>{i.photo_url ? <ItemPhotoPreview url={i.photo_url} label={`Photo of ${i.name}`} onRemove={() => { setItems(prev => prev.map(x => x.id === i.id ? { ...x, photo_url: null } : x)); invalidate() }} /> : <span aria-hidden="true"><ShoppingBag size={34} /></span>}</div>
              <div className={styles.itemText}><strong>{i.name}</strong><small>{i.brand_size_variant || 'Standard size'} · Qty {i.quantity}</small><b>{i.estimated_price == null ? 'Price not entered' : money(i.estimated_price * i.quantity)}</b></div>
              <button type="button" aria-label={`Edit ${i.name}`} onClick={() => openEditor(i)}><Pencil size={20} /></button>
            </article>)}
          </section>
          <button className={styles.outline} type="button" disabled={items.length >= limits.maxShoppingProducts} onClick={() => openEditor()}>＋ {items.length ? 'Add another item' : 'Add your first item'}</button>
          <button className={styles.detailsButton} type="button" onClick={() => openEditor(items[0], true)}><Camera size={23} /><span>Photos & item instructions<small>Add a photo or tell us your preferred brand.</small></span><span aria-hidden="true">›</span></button>
          <p className={styles.hint}>Up to {limits.maxShoppingProducts} products · {money(maximum)} shopping limit</p>{settingsError && <p className={styles.error} role="alert">{settingsError}</p>}
        </div><aside className={styles.desktopAside}>{map}<ShoppingSummary items={items} onEdit={() => openEditor(items[0])} /><p className={styles.hint}>Add each product separately. You can update quantities without losing other items.</p></aside></div>}
        {step === 2 && <div className={styles.layout}><div className={styles.stack}>
          <label>Shop name<input maxLength={200} value={shopName} onChange={e => { setShopName(e.target.value); invalidate() }} placeholder="e.g. Tesco" /></label>
          <ShoppingAddressField label="Shop address" value={shopInput} onChange={v => { setShopInput(v); setShop(null); invalidate() }} onSelect={p => { setShop(p); setShopInput(p.address); invalidate() }} />
          <ShoppingAddressField label="Delivery address" value={deliveryInput} onChange={v => { cancelGps(); setDeliveryInput(v); setDelivery(null); invalidate() }} onSelect={p => { cancelGps(); setDelivery(p); setDeliveryInput(p.address); invalidate() }} locationControl={<LocationButton label={locating ? 'Locating…' : 'Use my location for delivery'} disabled={locating} suspended={!!locationHelp} getRequestVersion={() => gpsVersion.current} onRequest={() => void gps()} onPosition={p => void gps(p)} onError={e => setLocationHelp(locationIssue(e))} />} />
          <details className={styles.disclosure}><summary><span className={styles.desktopOnly}>Flat, entrance or access instructions (optional)</span><span className={styles.mobileOnly}>Access & shop instructions (optional)</span></summary><label>Delivery instructions<textarea rows={2} maxLength={500} value={deliveryInstructions} onChange={e => { setDeliveryInstructions(e.target.value); invalidate() }} placeholder="e.g. Flat 4, use the side entrance" /></label><label className={styles.mobileOnly}>Instructions for the shop<textarea rows={2} maxLength={500} value={shopInstructions} onChange={e => { setShopInstructions(e.target.value); invalidate() }} placeholder="Anything your shopper should know?" /></label></details>
          <label className={styles.desktopOnly}>Instructions for the shop (optional)<textarea rows={2} maxLength={500} value={shopInstructions} onChange={e => { setShopInstructions(e.target.value); invalidate() }} placeholder="Anything your shopper should know?" /></label>
          <div className={styles.desktopOnly}><ShoppingSummary items={items} onEdit={() => go(1)} /></div>
        </div><aside className={styles.mapAside}>{map}<div className={`${styles.card} ${styles.budget}`} aria-live="polite"><span>{shop && delivery ? 'Estimated total' : 'Shopping funds budget'}</span><strong>{shop && delivery ? estimate ? money(estimate.totalCharge) : estimating || !estimateError ? 'Calculating…' : 'Unavailable' : money(maximum)}</strong></div>{estimateError && <p className={styles.hint} role="status">{estimateError} <button type="button" className={styles.link} onClick={() => setEstimateRetry(n => n + 1)}>Retry estimate</button></p>}</aside></div>}
        {step === 3 && <div className={styles.layout}><div className={styles.stack}>
          {individual && <label>Product for replacement preference<select aria-label="Product for replacement preference" value={replacementIndex} onChange={e => setReplacementIndex(Number(e.target.value))}>{items.map((i, n) => <option key={i.id} value={n}>{i.name}</option>)}</select></label>}
          {choices.map(c => <button type="button" key={c.value} className={styles.choice} aria-pressed={individual ? replacementItem?.substitution_preference === c.value : items.every(i => i.substitution_preference === c.value)} onClick={() => { setItems(prev => prev.map(i => !individual || i.id === replacementItem?.id ? { ...i, substitution_preference: c.value } : i)); invalidate() }}><span className={styles.radio} aria-hidden="true" /><span><strong>{c.label}</strong><small>{c.description}</small></span></button>)}
          <p className={styles.hint}>Any higher price needs your approval.</p><label className={styles.check}><input type="checkbox" checked={limitsAccepted} onChange={e => { setLimitsAccepted(e.target.checked); invalidate() }} />My shopping is within {limits.maxShoppingWeightKg} kg total and {limits.maxShoppingDimensionCm} cm per item.</label>
          <button className={styles.link} type="button" onClick={() => { setIndividual(!individual); setReplacementIndex(0) }}>{individual ? 'Apply a choice to all items' : 'Change a specific item'}</button>
        </div><aside className={styles.desktopAside}><ShoppingSummary items={items} onEdit={() => go(1)} /><section className={styles.card}><strong>You stay in control</strong><p className={styles.hint}>Your driver must get approval before buying a replacement or any higher-priced product.</p></section></aside></div>}
        {step === 4 && <div className={`${styles.layout} ${styles.reviewLayout}`}><div className={`${styles.stack} ${styles.reviewDetails}`}>
          <section className={styles.card}><div className={styles.cardHeading}><strong>{items.length} products</strong><button className={styles.link} type="button" onClick={() => go(1)}>Edit items</button></div><div className={styles.summaryRows} tabIndex={0} aria-label="Shopping products">{items.map(i => <p key={i.id}><span>{i.name} · Qty {i.quantity}</span><strong>{i.estimated_price == null ? 'Not estimated' : money(i.quantity * i.estimated_price)}</strong></p>)}</div></section>
          <section className={styles.card}><div className={styles.cardHeading}><strong>Shop</strong><button className={styles.link} type="button" onClick={() => go(2)}>Edit</button></div><p className={styles.addressText}>{shopName}, {shop?.address}</p><strong>Deliver to</strong><p className={styles.addressText}>{delivery?.address}</p></section>
          <button className={styles.link} type="button" onClick={() => go(3)}>Replacement: {items.every(i => i.substitution_preference === items[0]?.substitution_preference) ? choices.find(c => c.value === items[0]?.substitution_preference)?.label : 'Per item'} · Edit</button>
        </div><details className={styles.compactReview}><summary><strong>{items.length} products · {shopName}</strong><span className={styles.reviewExtra}>{items.slice(0, 2).map(i => i.name).join(' · ')}{items.length > 2 ? ` +${items.length - 2} more` : ''}</span><span className={styles.reviewExtra}>Shop: {shop?.address}</span><span>Deliver to {delivery?.address}</span></summary><div className={styles.stack}>
          <ShoppingSummary items={items} onEdit={() => go(1)} />
          <p className={styles.addressText}>Shop: {shop?.address}<br />Deliver to: {delivery?.address}</p>
          <button type="button" className={styles.link} onClick={() => go(2)}>Edit addresses</button>
          <button type="button" className={styles.link} onClick={() => go(3)}>Edit replacement choices</button>
          {quote && <section className={styles.costs}><strong>Delivery price breakdown</strong>{quote.priceLines.map((line, i) => <p key={i}><span>{line.label}</span><strong>{money(line.amount)}</strong></p>)}</section>}
        </div></details><aside className={styles.reviewAside}><section className={styles.card}>
          {quoting ? <p role="status">Calculating your price…</p> : quote ? <>
            <div className={styles.costs}><p><span>Prepaid shopping funds</span><strong>{money(quote.itemsHold)}</strong></p><p><span>Shopping service</span><strong>{money(quote.serviceFee)}</strong></p><p><span>Delivery · {quote.distanceMiles.toFixed(1)} miles</span><strong>{money(quote.deliveryFee)}</strong></p></div>
            <details className={styles.priceDetails}><summary>View delivery price breakdown</summary>{quote.priceLines.map((line, i) => <p key={i}><span>{line.label}</span><strong>{money(line.amount)}</strong></p>)}</details>
            <div className={styles.total}><span>Total to pay</span><strong>{money(quote.totalCharge)}</strong></div><p className={styles.hint}>Shopping funds of {money(quote.itemsHold)} are charged now. Purchases are settled at receipt price. Unused funds are refunded to your payment card.</p>
            <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I agree to the order details and total shown.</label>
          </> : <div className={styles.stack}><p>Price unavailable. Please retry before paying.</p><button type="button" className={styles.outline} onClick={() => void loadQuote()}>Retry price calculation</button></div>}
        </section></aside></div>}
      </main>
      <footer className={styles.footer}>{error && !editor && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="button" disabled={submitting || uploading} onClick={() => step === 1 ? onClose() : go(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button type="button" className={styles.primary} disabled={submitting || quoting || uploading || locating || (step === 4 && (!quote || !confirmed))} onClick={next}>{submitting ? 'Opening checkout…' : quoting ? 'Calculating…' : locating ? 'Finding location…' : step === 4 ? `Confirm & Pay ${quote ? money(quote.totalCharge) : ''}` : 'Continue'}</button></div>{step === 4 && <p className={styles.secure}>Secure card checkout · No wallet required</p>}</footer>
    </section>
    {editor && <ShoppingItemEditor item={editor} existing={items.some(i => i.id === editor.id)} maxQuantity={limits.maxQuantityPerProduct} busy={uploading} error={editorError} showDetails={editorDetails} onChange={(field, value) => { setEditor(prev => prev ? { ...prev, [field]: value } : prev); setEditorError('') }} onPhoto={file => void photo(file)} onSave={saveItem} onCancel={closeEditor} onDelete={() => removeItem(editor.id)} />}
    {locationHelp && <LocationPermissionDialog issue={locationHelp} onClose={() => setLocationHelp(null)} onRetry={() => void gps()} onPosition={p => void gps(p)} onError={e => setLocationHelp(locationIssue(e))} />}
  </div>
}
