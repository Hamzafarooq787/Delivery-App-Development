'use client'
import { useEffect, useRef, useState, useId, type ReactNode } from 'react'
import { createAddressRequest } from '@/lib/address-request'
import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import { googlePlacesAutocomplete, googlePlaceCoords, googleReverseGeocode, type PlaceSuggestion } from '@/lib/google'
import styles from './ShoppingSteps.module.css'
const PinMap = dynamic(() => import('@/components/maps/google-live-map').then(m => m.GoogleLiveMap), { ssr: false })
export type ShoppingPlace = { address: string; lat: number; lng: number }
export function ShoppingAddressField({ label, value, onChange, onSelect, locationControl }: { label: string; value: string; onChange: (v: string) => void; onSelect: (p: ShoppingPlace) => void; locationControl?: ReactNode }) {
  const fieldId = useId()
  const pinDialog = useRef<HTMLDialogElement>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState<ShoppingPlace | null>(null)
  const pinSequence = useRef(0)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dropdownHeight, setDropdownHeight] = useState(160)
  const input = useRef<HTMLInputElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const requests = useRef(createAddressRequest()).current
  const lastTyped = useRef(value)
  useEffect(() => {
    if (value === lastTyped.current) return
    lastTyped.current = value; requests.cancel()
    setSuggestions([]); setBusy(false)
  }, [value, requests])
  useEffect(() => () => { pinSequence.current++; requests.cancel() }, [requests])
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setSuggestions([]) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  useEffect(() => { if (pinOpen) pinDialog.current?.showModal() }, [pinOpen])
  function closePin() { pinSequence.current++; setBusy(false); setPinOpen(false); input.current?.focus() }
  function change(v: string) {
    lastTyped.current = v; onChange(v); setError(''); setBusy(false); setSuggestions([])
    requests.cancel()
    if (v.trim().length < 2) return
    requests.search(async signal => {
      try {
        const list = await googlePlacesAutocomplete(v.trim(), {signal})
        if (signal.aborted || document.activeElement !== input.current) return
        setDropdownHeight(Math.max(44, (window.visualViewport?.height ?? window.innerHeight) - (input.current?.getBoundingClientRect().bottom ?? 0) - 90))
        setSuggestions(list)
        setError(list.length ? '' : 'No addresses found. Try a postcode and building number.')
      } catch (e) {
        if (!signal.aborted) setError(e instanceof Error ? e.message : 'Address search failed. Please try again.')
      }
    })
  }
  async function choose(s: PlaceSuggestion) {
    const signal = requests.start()
    setBusy(true); setSuggestions([]); setError('')
    try {
      const coords = await googlePlaceCoords(s.placeId, signal)
      if (signal.aborted) return
      if (!coords) { setError('Could not find this address. Try another suggestion.'); return }
      onSelect({ address: s.text, ...coords }); input.current?.blur()
    } catch { if (!signal.aborted) setError('Could not select this address. Please try again.') }
    finally { if (!signal.aborted) setBusy(false) }
  }
  return <div ref={wrapper} className={styles.field} onKeyDown={e => { if (e.key === 'Escape' && suggestions.length) { e.stopPropagation(); setSuggestions([]) } }}>
    <div className={styles.addressLabel}><label htmlFor={fieldId}>{label}</label>{locationControl}</div>
    <div className={styles.addressInputWrap}><input id={fieldId} ref={input} aria-label={label} value={value} onChange={e => change(e.target.value)} placeholder="Start typing an address…" autoComplete="off" />
    <button type="button" aria-label={`Choose ${label.toLowerCase()} on map`} title="Choose on map" className={styles.mapPinButton} onClick={() => { requests.cancel(); setSuggestions([]); setPin(null); setPinOpen(true); setError('') }}><MapPin size={20} /></button></div>
    {pinOpen && <dialog ref={pinDialog} className={styles.pinDialog} aria-label={`Choose ${label} on map`} onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); closePin() }}>
      <p>Tap the exact entrance, then confirm the address.</p>
      <PinMap height="60dvh" pickup={pin ?? { lat: 53.4808, lng: -2.2426 }} showUserLocation={false} onPick={async point => {
        const current = ++pinSequence.current
        setPin(null); setBusy(true); setError('')
        try { const address = await googleReverseGeocode(point.lat, point.lng); if (current !== pinSequence.current) return; if (!address) throw new Error('No address found at this pin.'); setPin({ ...point, address }) }
        catch (e) { if (current === pinSequence.current) setError(e instanceof Error ? e.message : 'Could not verify the pin.') }
        finally { if (current === pinSequence.current) setBusy(false) }
      }} />
      <p>{busy ? 'Checking address…' : pin?.address ?? 'Select a point on the map.'}</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={!pin || busy} onClick={() => { if (pin) { requests.cancel(); onSelect(pin); closePin() } }}>Use this address</button>
      <button type="button" onClick={closePin}>Back to address search</button>
    </dialog>}
    {busy && <small>Finding address…</small>}{error && <small role="alert">{error}</small>}
    {suggestions.length > 0 && <div className={styles.suggestions} style={{ maxHeight: dropdownHeight }}>{suggestions.map(s => <button key={s.placeId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(s)}>{s.text}</button>)}</div>}
  </div>
}
