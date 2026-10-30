'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { googlePlacesAutocomplete, googlePlaceCoords, googleReverseGeocode, type PlaceSuggestion } from '@/lib/google'
import { createShoppingRequest, getShoppingQuote, type ShoppingItem, type ShoppingQuote } from '@/app/actions/shopping'
import { getWalletBalance } from '@/app/actions/wallet'
import styles from './ShoppingSteps.module.css'

type Item = ShoppingItem & { id: string }
type Place = { address: string; lat: number; lng: number }
const choices = [
  { value: 'contact_me', label: 'Contact me first', description: 'Ask before buying a replacement.' },
  { value: 'best_alternative', label: 'Choose an alternative', description: 'Buy the closest similar item.' },
  { value: 'skip_if_unavailable', label: 'Skip the item', description: 'Leave it out of my order.' },
] as const
const freshItem = (): Item => ({ id: Math.random().toString(36).slice(2), name: '', quantity: 1, estimated_price: null, brand_size_variant: null, notes: null, photo_url: null, substitution_preference: 'contact_me' })
const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)

function AddressField({ label, value, onChange, onSelect }: { label: string; value: string; onChange: (v: string) => void; onSelect: (p: Place) => void }) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dropdownHeight, setDropdownHeight] = useState(160)
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequence = useRef(0)
  useEffect(() => () => { sequence.current++; if (timer.current) clearTimeout(timer.current) }, [])
  function change(v: string) {
    onChange(v); setError(''); setBusy(false); setSuggestions([])
    const request = ++sequence.current
    if (timer.current) clearTimeout(timer.current)
    if (v.length < 3) return
    timer.current = setTimeout(async () => {
      try { const list = await googlePlacesAutocomplete(v, {}); if (request === sequence.current) { setDropdownHeight(Math.max(44, (window.visualViewport?.height ?? window.innerHeight) - (input.current?.getBoundingClientRect().bottom ?? 0) - 90)); setSuggestions(list ?? []) } }
      catch { if (request === sequence.current) setError('Address search failed. Please try again.') }
    }, 350)
  }
  async function choose(s: PlaceSuggestion) {
    const request = ++sequence.current
    setBusy(true); setSuggestions([])
    try {
      const coords = await googlePlaceCoords(s.placeId)
      if (request !== sequence.current) return
      if (!coords) { setError('Could not find this address. Try another suggestion.'); return }
      onSelect({ address: s.text, ...coords }); input.current?.blur()
    } catch { if (request === sequence.current) setError('Could not select this address. Please try again.') }
    finally { if (request === sequence.current) setBusy(false) }
  }
  return <div className={styles.field}>
    <label>{label}<input ref={input} aria-label={label} value={value} onChange={e => change(e.target.value)} placeholder="Start typing an address…" autoComplete="off" /></label>
    {busy && <small>Finding address…</small>}{error && <small role="alert">{error}</small>}
    {suggestions.length > 0 && <div className={styles.suggestions} style={{ maxHeight: dropdownHeight }}>{suggestions.map(s => <button key={s.placeId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(s)}>{s.text}</button>)}</div>}
  </div>
}

export function NewShoppingRequestModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const frame = useRef<HTMLDivElement>(null)
  const lock = useRef(false)
  const requestKey = useRef<string | null>(null)
  const [step, setStep] = useState(1)
  const [items, setItems] = useState<Item[]>([freshItem()])
  const [index, setIndex] = useState(0)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [editing, setEditing] = useState(true)
  const [listPage, setListPage] = useState(0)
  const [details, setDetails] = useState(false)
  const [instructions, setInstructions] = useState(false)
  const [individual, setIndividual] = useState(false)
  const [replacementIndex, setReplacementIndex] = useState(0)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [shopName, setShopName] = useState('')
  const [shopInput, setShopInput] = useState('')
  const [deliveryInput, setDeliveryInput] = useState('')
  const [shop, setShop] = useState<Place | null>(null)
  const [delivery, setDelivery] = useState<Place | null>(null)
  const [shopInstructions, setShopInstructions] = useState('')
  const [quote, setQuote] = useState<ShoppingQuote | null>(null)
  const [wallet, setWallet] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string; tracking_number: string } | null>(null)
  const savedItems = items.filter(i => savedIds.includes(i.id))
  const listPageSize = editing ? 2 : 3
  const item = items[index]
  const total = items.reduce((sum, i) => sum + (i.estimated_price ?? 0) * i.quantity, 0)
  useEffect(() => {
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
    void getWalletBalance().then(r => setWallet(r.balance)).catch(() => setWallet(null))
    return () => { document.body.style.overflow = overflow; previous?.focus(); viewport?.removeEventListener('resize', measure); viewport?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure) }
  }, [])
  function update(field: keyof ShoppingItem, value: unknown) { setItems(prev => prev.map((i, n) => n === index ? { ...i, [field]: value } : i)); setQuote(null); setError('') }
  function go(next: number) { setError(''); setDetails(false); setInstructions(false); setStep(next) }
  function validItems() {
    if (items.length > 5) { setError('You can order up to 5 different products.'); return false }
    if (items.some(i => !i.name.trim())) { setError('Name each item, or remove the empty item.'); return false }
    if (items.some(i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99 || (i.estimated_price != null && (!Number.isFinite(i.estimated_price) || i.estimated_price < 0)))) { setError('Check item quantities and estimated prices.'); return false }
    return true
  }
  async function next() {
    if (lock.current || uploading) return
    if (step === 1) { if (!savedItems.length) { setError('Add and save at least one item.'); return }; if (validItems()) go(2); return }
    if (step === 2) { if (!shopName.trim() || !shop || !delivery) { setError('Enter the shop name and select both addresses from suggestions.'); return }; go(3); return }
    if (step === 3) {
      if (!validItems() || !shop || !delivery) return
      go(4); setReviewIndex(0); setQuote(null); setLoading(true); lock.current = true
      try { const result = await getShoppingQuote({ shop_lat: shop.lat, shop_lng: shop.lng, delivery_lat: delivery.lat, delivery_lng: delivery.lng, estimated_items_total: total }); if ('error' in result) setError(result.error); else setQuote(result.data) }
      catch { setError('Could not calculate the price. Go back and try again.') }
      finally { setLoading(false); lock.current = false }
    }
  }
  async function submit() {
    if (lock.current || success || !quote || !shop || !delivery || uploading || !validItems()) return
    lock.current = true; setLoading(true); setError('')
    try {
      requestKey.current ??= crypto.randomUUID()
      const result = await createShoppingRequest({ request_key: requestKey.current, shop_name: shopName.trim(), shop_address: shop.address, shop_lat: shop.lat, shop_lng: shop.lng, shop_instructions: shopInstructions.trim() || null, delivery_address: delivery.address, delivery_lat: delivery.lat, delivery_lng: delivery.lng, shopping_items: items.map(i => ({ name: i.name.trim(), quantity: i.quantity, estimated_price: i.estimated_price, brand_size_variant: i.brand_size_variant, notes: i.notes, photo_url: i.photo_url, substitution_preference: i.substitution_preference })) })
      if ('error' in result) setError(result.error); else setSuccess(result.data)
    } catch { setError('We could not confirm the result. Check My Deliveries before trying again.') }
    finally { lock.current = false; setLoading(false) }
  }
  async function photo(file: File) {
    if (uploading) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { setError('Choose an image smaller than 10 MB.'); return }
    const id = item.id; setUploading(true); setError('')
    try { const client = createClient(); const { data: { user } } = await client.auth.getUser(); if (!user) throw new Error("Session expired"); const path = `${user.id}/bfm-items/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const result = await client.storage.from('delivery-item-photos').upload(path, file); if (result.error) throw result.error; const { data } = client.storage.from('delivery-item-photos').getPublicUrl(path); setItems(prev => prev.map(i => i.id === id ? { ...i, photo_url: data.publicUrl } : i)) }
    catch { setError('Photo upload failed. Try again.') }
    finally { setUploading(false) }
  }
  function gps() {
    if (!navigator.geolocation) { setError('Location is unavailable. Please enter your address.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async pos => { try { const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }; const address = await googleReverseGeocode(p.lat, p.lng); if (!address) throw new Error(); setDelivery({ ...p, address }); setDeliveryInput(address); setQuote(null) } catch { setError('Could not find your address. Please type it instead.') } finally { setLocating(false) } }, () => { setError('Location permission is unavailable. Please enter your address.'); setLocating(false) }, { timeout: 10000 })
  }
  function saveItem() {
    if (!item.name.trim()) { setError('Enter an item name before saving.'); return }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || (item.estimated_price != null && (!Number.isFinite(item.estimated_price) || item.estimated_price < 0))) { setError('Check the quantity and estimated price.'); return }
    if (!savedIds.includes(item.id)) setSavedIds([...savedIds, item.id])
    setEditing(false); setDetails(false); setError('')
    setListPage(Math.floor((savedIds.includes(item.id) ? savedIds.indexOf(item.id) : savedIds.length) / 3) * 3)
  }
  function addItem() {
    if (savedItems.length >= 5) { setError("You can add up to 5 different products."); return }
    if (items.some(i => !savedIds.includes(i.id))) { setIndex(items.findIndex(i => !savedIds.includes(i.id))) }
    else { setItems([...items, freshItem()]); setIndex(items.length) }
    setEditing(true); setListPage(0); setDetails(false); setError(''); setQuote(null)
  }
  function cancelEditor() {
    if (!savedIds.includes(item.id)) {
      const remaining = items.filter(i => i.id !== item.id)
      setItems(remaining.length ? remaining : [freshItem()]); setIndex(0)
    }
    setEditing(false); setDetails(false); setError('')
  }
  function removeSaved(id: string) {
    const remaining = items.filter(i => i.id !== id)
    setItems(remaining.length ? remaining : [freshItem()]); setSavedIds(savedIds.filter(i => i !== id)); setIndex(Math.max(0, remaining.findIndex(i => i.id === item.id))); setReplacementIndex(0); setListPage(0); setQuote(null); if (item.id === id) { setEditing(false); setDetails(false) }
  }
  return <div ref={frame} className={styles.overlay} onKeyDown={e => {
    if (e.key === 'Escape' && !loading && !uploading) onClose()
    if (e.key === 'Tab') { const all = Array.from(frame.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)') ?? []).filter(el => el.getClientRects().length); const first = all[0], last = all[all.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }; if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } }
  }}>
    <div className={styles.backdrop} />
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="shopping-title">
      <header><div><strong>Buy for Me</strong><small>{success ? 'Booking confirmed' : `Step ${step} of 4 · ${['Shopping items','Shop & delivery','Replacement choice','Review & Pay'][step - 1]}`}</small></div><button aria-label="Close shopping form" disabled={loading || uploading} onClick={onClose}>×</button></header>
      {!success && <div className={styles.progress}><div style={{width: `${step * 25}%`}} /></div>}
      <main className={styles.body}>
        <h2 id="shopping-title">{success ? 'Thank you!' : ['What should we buy?','Choose your shop','If an item is unavailable','Review your shopping'][step - 1]}</h2>
        {success ? <div className={styles.success}><span aria-hidden="true">✓</span><p>Your shopping request is booked.</p><div className={styles.card}><small>Tracking code</small><strong>{success.tracking_number}</strong></div><p>We’ll let you know when a driver accepts your order.</p></div> : <>
          {step === 1 && <div className={styles.itemsStep}>
            {savedItems.length > 0 && !details && <section className={styles.savedList} aria-label="Added shopping items">
              <div className={styles.listHeading}><strong>Added items ({savedItems.length})</strong><span>{money(savedItems.reduce((sum,i) => sum + (i.estimated_price ?? 0) * i.quantity,0))}</span></div>
              {savedItems.slice(listPage,listPage + listPageSize).map(i => <div className={styles.savedItem} key={i.id}>
                <div><strong>{i.name}</strong><small>Qty {i.quantity} · {i.estimated_price == null ? 'Price not entered' : money(i.estimated_price * i.quantity)}</small></div>
                <button disabled={uploading} aria-label={`Edit ${i.name}`} onClick={() => { setIndex(items.findIndex(x => x.id === i.id)); setEditing(true); setDetails(false); setError('') }}>Edit</button>
                <button disabled={uploading} aria-label={`Remove ${i.name}`} onClick={() => removeSaved(i.id)}>×</button>
              </div>)}
              {savedItems.length > listPageSize && <div className={styles.itemNav}><button disabled={listPage === 0} onClick={() => setListPage(Math.max(0,listPage - listPageSize))}>Previous items</button><span>{listPage + 1}–{Math.min(listPage + listPageSize,savedItems.length)}</span><button disabled={listPage + listPageSize >= savedItems.length} onClick={() => setListPage(listPage + listPageSize)}>Next items</button></div>}
            </section>}
            {editing ? <section className={`${styles.stack} ${styles.itemEditor}`} aria-label="Item editor">
              <strong className={styles.editorTitle}>{savedIds.includes(item.id) ? 'Edit item' : 'Add an item'}</strong>
            {details ? <>
              <button className={styles.link} onClick={() => setDetails(false)}>← Back to item {index + 1}</button>
              <label>Brand, size or variant (optional)<input value={item.brand_size_variant ?? ''} onChange={e => update('brand_size_variant',e.target.value)} /></label>
              <label>Notes (optional)<textarea rows={2} value={item.notes ?? ''} onChange={e => update('notes',e.target.value)} /></label>
              <label>Photo (optional)<input type="file" accept="image/*" disabled={uploading} onChange={e => { if (e.target.files?.[0]) void photo(e.target.files[0]) }} /></label>
              {item.photo_url && <div className={styles.photo}>{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.photo_url} alt="Shopping item" /><button onClick={() => update('photo_url',null)}>Remove photo</button></div>}
            </> : <>
              <label>Item name<input value={item.name} onChange={e => update('name',e.target.value)} placeholder="e.g. Whole milk 2L" /></label>
              <div className={styles.columns}><label>Quantity<div className={styles.quantity}><button aria-label="Reduce quantity" disabled={item.quantity <= 1} onClick={() => update('quantity',item.quantity - 1)}>−</button><strong>{item.quantity}</strong><button aria-label="Increase quantity" onClick={() => update('quantity',item.quantity + 1)}>+</button></div></label><label>Est. price per item (£)<input type="number" min="0" step="0.01" value={item.estimated_price ?? ''} onChange={e => update('estimated_price',e.target.value === '' ? null : Number(e.target.value))} placeholder="Optional" /></label></div>
              <button className={styles.cardButton} onClick={() => setDetails(true)}>More details (optional) <span>Brand, size, notes and photo →</span></button>
            </>}

            </section> : <button className={styles.outline} onClick={addItem}>+ Add another item</button>}
            {!editing && savedItems.length === 0 && <p className={styles.hint}>Add your first item to start your shopping list.</p>}
          </div>}
          {step === 2 && <div className={styles.stack}>
            {instructions ? <><button className={styles.link} onClick={() => setInstructions(false)}>← Back to addresses</button><label>Shop instructions (optional)<textarea rows={3} value={shopInstructions} onChange={e => setShopInstructions(e.target.value)} /></label></> : <>
              <label>Shop name<input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Tesco" /></label>
              <AddressField label="Shop address" value={shopInput} onChange={v => { setShopInput(v); setShop(null); setQuote(null) }} onSelect={p => { setShop(p); setShopInput(p.address); setQuote(null) }} />
              <AddressField label="Delivery address" value={deliveryInput} onChange={v => { setDeliveryInput(v); setDelivery(null); setQuote(null) }} onSelect={p => { setDelivery(p); setDeliveryInput(p.address); setQuote(null) }} />
              <button className={styles.link} disabled={locating} onClick={gps}>{locating ? 'Finding your location…' : 'Use my location for delivery'}</button>
              <button className={styles.cardButton} onClick={() => setInstructions(true)}>Shop instructions (optional) →</button>
            </>}
          </div>}
          {step === 3 && <div className={styles.stack}>
            {individual && <div className={styles.itemNav}><button disabled={!replacementIndex} onClick={() => setReplacementIndex(replacementIndex - 1)}>Previous</button><span>{items[replacementIndex].name}</span><button disabled={replacementIndex === items.length - 1} onClick={() => setReplacementIndex(replacementIndex + 1)}>Next</button></div>}
            {choices.map(c => <button key={c.value} className={styles.choice} aria-pressed={individual ? items[replacementIndex].substitution_preference === c.value : items.every(i => i.substitution_preference === c.value)} onClick={() => setItems(prev => prev.map((i,n) => !individual || n === replacementIndex ? {...i,substitution_preference:c.value} : i))}><strong>{c.label}</strong><span>{c.description}</span></button>)}
            <p className={styles.hint}>{individual ? 'Change the choice for this item.' : 'Selecting a choice applies it to all items.'}</p>
            <button className={styles.link} onClick={() => { setIndividual(!individual); setReplacementIndex(0) }}>{individual ? 'Apply a choice to all items' : 'Change a specific item'}</button>
          </div>}
          {step === 4 && <div className={styles.review}>
            <div className={styles.card}><button className={styles.edit} onClick={() => go(2)}>Edit</button><small>Shop</small><p>{shopName} · {shop?.address}</p><small>Delivery</small><p>{delivery?.address}</p></div>
            <div className={styles.card}><button className={styles.edit} onClick={() => go(1)}>Edit items</button><small>Shopping list · {items.length} items</small>{items.slice(reviewIndex,reviewIndex + 2).map(i => <p key={i.id}>{i.name} ×{i.quantity}<span>{i.estimated_price == null ? '—' : money(i.estimated_price * i.quantity)}</span></p>)}{items.length > 2 && <div className={styles.itemNav}><button disabled={reviewIndex === 0} onClick={() => setReviewIndex(reviewIndex - 2)}>Previous</button><span>{reviewIndex + 1}–{Math.min(reviewIndex + 2,items.length)}</span><button disabled={reviewIndex + 2 >= items.length} onClick={() => setReviewIndex(reviewIndex + 2)}>Next</button></div>}</div>
            <button className={styles.link} onClick={() => go(3)}>Replacement: {items.every(i => i.substitution_preference === items[0].substitution_preference) ? choices.find(c => c.value === items[0].substitution_preference)?.label : 'Per item'} · Edit</button>
            <div className={styles.card}>{loading ? <p>Calculating price…</p> : quote ? <><p>Shopping funds (held)<span>{money(quote.itemsHold)}</span></p><p>Delivery fee<span>{money(quote.deliveryFee)}</span></p>{quote.serviceFee > 0 && <p>Service fee<span>{money(quote.serviceFee)}</span></p>}<p><strong>Total charged now</strong><strong>{money(quote.totalCharge)}</strong></p><small>Shopping funds up to {money(quote.maxSpendLimit)} are held. Unused funds return to your wallet.</small></> : <p>Price unavailable. Go back and retry.</p>}</div>
            <p className={styles.hint}>Wallet balance: {wallet == null ? 'Loading…' : money(wallet)}</p>
          </div>}
        </>}
      </main>
      <footer>{error && <p role="alert">{error}</p>}<div className={styles.actions}>
        {success ? <><button onClick={onClose}>Done</button><button className={styles.primary} onClick={() => { onClose(); router.push(`/dashboard/customer/tracking?id=${encodeURIComponent(success.id)}`) }}>Track order</button></> : <><button disabled={loading || uploading} onClick={() => { if (details) setDetails(false); else if (instructions) setInstructions(false); else if (step === 1 && editing) cancelEditor(); else if (step === 1) onClose(); else go(step - 1) }}>{step === 1 && editing && !details ? 'Cancel item' : details || instructions || step > 1 ? 'Back' : 'Cancel'}</button><button className={styles.primary} disabled={loading || uploading || (step === 4 && !quote)} onClick={() => { if (details) setDetails(false); else if (instructions) setInstructions(false); else if (step === 1 && editing) saveItem(); else if (step === 4) void submit(); else void next() }}>{uploading ? 'Uploading…' : loading ? 'Please wait…' : details || instructions ? 'Save details' : step === 1 && editing ? 'Save item' : step === 4 ? `Confirm & Pay ${quote ? money(quote.totalCharge) : ''}` : 'Continue'}</button></>}
      </div></footer>
    </section>
  </div>
}
