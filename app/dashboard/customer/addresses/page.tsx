'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { ShoppingAddressField } from '@/components/customer/ShoppingAddressField'
import { validCoordinates } from '@/lib/customer-validation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Plus, Pencil, Trash2, Navigation, Home } from 'lucide-react'
import {
  CustomerPage,
  CustomerDialog,
  CustomerEmpty,
  CustomerPagination,
  shortDate,
  useCustomerPageSize,
} from '@/components/customer/CustomerPage'
import styles from '@/components/customer/CustomerPages.module.css'

type AddressRow = {
  id: string
  address: string
  lat: number | null
  lng: number | null
  created_at: string | null
}

export default function AddressesPage() {
  const gpsVersion=useRef(0)
  const [coords,setCoords]=useState<{lat:number;lng:number}|null>(null)
  const [revision,setRevision]=useState(0)
  const [deleting,setDeleting]=useState<string|null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const size = useCustomerPageSize(2, 2)
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Form state for add / edit
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setAddresses([])
          setLoading(false)
        }
        return
      }
      if (cancelled) return
      setUserId(user.id)
      const { data, error } = await supabase
        .from('addresses')
        .select('id,address,lat,lng,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('[v0] addresses fetch error', error)
        setAddresses([])
        setErrorMsg(
          'Could not load your addresses. Please refresh and try again.',
        )
      } else {
        setAddresses((data ?? []) as AddressRow[]);setErrorMsg(null)
      }
      } catch { if (!cancelled) setErrorMsg('Could not load your addresses. Please try again.') } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => {
      cancelled = true; gpsVersion.current++
    }
  }, [supabase, revision])

  function openAddForm() {
    gpsVersion.current++; setLocating(false); setCoords(null)
    setEditingId(null)
    setAddressInput('')
    setErrorMsg(null)
    setFormOpen(true)
  }

  function openEditForm(addr: AddressRow) {
    gpsVersion.current++; setLocating(false); setCoords(addr.lat!=null&&addr.lng!=null?{lat:Number(addr.lat),lng:Number(addr.lng)}:null)
    setEditingId(addr.id)
    setAddressInput(addr.address ?? '')
    setErrorMsg(null)
    setFormOpen(true)
  }

  function closeForm() {
    gpsVersion.current++; setLocating(false); setCoords(null)
    setFormOpen(false)
    setEditingId(null)
    setAddressInput('')
    setErrorMsg(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || saving) return
    const trimmed = addressInput.trim()
    if (!trimmed) {
      setErrorMsg('Address cannot be empty.')
      return
    }
    if (!coords || !validCoordinates(coords.lat,coords.lng)) { setErrorMsg('Select an address suggestion or confirm its map pin before saving.'); return }
    setSaving(true)
    setErrorMsg(null)
    try {

    if (editingId) {
      const { data, error } = await supabase
        .from('addresses')
        .update({ address: trimmed, ...coords })
        .eq('id', editingId)
        .eq('user_id', userId)
        .select('id,address,lat,lng,created_at')
        .single()
      setSaving(false)
      if (error) {
        console.error('[v0] update address error', error)
        setErrorMsg(error.message || 'Failed to update address.')
        return
      }
      setAddresses((prev) =>
        prev.map((a) => (a.id === editingId ? (data as AddressRow) : a)),
      )
      closeForm()
    } else {
      const { data, error } = await supabase
        .from('addresses')
        .insert({ user_id: userId, address: trimmed, ...coords })
        .select('id,address,lat,lng,created_at')
        .single()
      setSaving(false)
      if (error) {
        console.error('[v0] add address error', error)
        setErrorMsg(error.message || 'Failed to save address.')
        return
      }
      setAddresses((prev) => [data as AddressRow, ...prev])
      closeForm()
    }
    } catch { setErrorMsg('Could not save your address. Please try again.') } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!userId) return
    const ok = window.confirm('Delete this address?')
    if (!ok) return
    if(deleting)return
    setDeleting(id);setErrorMsg(null)
    try {
      const {data,error}=await supabase.from('addresses').delete().eq('id',id).eq('user_id',userId).select('id').single()
      if(error||!data)throw new Error('Delete not confirmed')
      setAddresses(prev=>prev.filter(a=>a.id!==id));if(editingId===id)closeForm()
    }catch{setErrorMsg('Could not confirm address deletion. Please try again or reload your addresses.')}finally{setDeleting(null)}
  }

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(addresses.length / size)),
  )
  const visible = addresses.slice((current - 1) * size, current * size)
  const focusedAddress = addresses.find((a) => a.id === selected) ?? visible[0]
  async function useLocation() {
    const version=++gpsVersion.current
    if (!navigator.geolocation) {
      setErrorMsg(
        'Location is unavailable on this device. Please enter an address.',
      )
      return
    }
    setLocating(true)
    setErrorMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `/api/google/geocode?latlng=${position.coords.latitude},${position.coords.longitude}`,
          )
          const result = await response.json()
          const address = result.results?.[0]?.formatted_address
          if (!response.ok || !address)
            throw new Error(
              'Could not find your address. Please enter it manually.',
            )
          if(version!==gpsVersion.current)return
          setCoords({lat:position.coords.latitude,lng:position.coords.longitude})
          setEditingId(null)
          setAddressInput(address)
          setFormOpen(true)
        } catch {
          if(version!==gpsVersion.current)return
          setErrorMsg('Could not find your address. Please enter it manually.')
        } finally {
          if(version===gpsVersion.current)setLocating(false)
        }
      },
      () => {
        if(version!==gpsVersion.current)return
        setLocating(false)
        setErrorMsg(
          'Location access was unavailable. You can still add an address manually.',
        )
      },
      { timeout: 10000 },
    )
  }
  return (
    <CustomerPage
      title="Saved addresses"
      subtitle="Manage your pickup and delivery addresses."
      action={
        <button
          className={`${styles.primary} ${styles.desktopOnly}`}
          onClick={openAddForm}
        >
          <Plus size={17} />
          Add address
        </button>
      }
    >
      {errorMsg && !formOpen && (
        <p className={styles.error} role="alert">
          {errorMsg} <button type="button" className={styles.textButton} onClick={()=>setRevision(v=>v+1)}>Try again</button>
        </p>
      )}
      <div className={styles.addressLayout}>
        <div className={styles.content}>
          {loading ? (
            <CustomerEmpty loading>Loading addresses</CustomerEmpty>
          ) : !addresses.length ? (
            <CustomerEmpty>
              Add your first address for faster bookings.
            </CustomerEmpty>
          ) : (
            <div className={styles.addressCards}>
              {visible.map((addr) => (
                <article
                  key={addr.id}
                  className={`${styles.panel} ${styles.addressCard}`}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.iconTile}>
                      <Home size={23} aria-hidden />
                    </span>
                    <div>
                      <h2>Saved address</h2>
                      <p>{shortDate(addr.created_at)}</p>
                    </div>
                  </div>
                  <address>{addr.address}</address>
                  <div className={styles.addressButtons}>
                    <button
                      className={styles.secondary}
                      onClick={() => openEditForm(addr)}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button
                      className={`${styles.secondary} ${styles.desktopOnly}`}
                      aria-label={`Show ${addr.address} on map`}
                      onClick={() => setSelected(addr.id)}
                    >
                      <MapPin size={17} />
                    </button>
                    <button
                      className={styles.secondary}
                      disabled={!!deleting}
                      aria-label={`Delete ${addr.address}`}
                      onClick={() => handleDelete(addr.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <CustomerPagination
            page={current}
            size={size}
            count={addresses.length}
            onChange={setPage}
          />
          <div className={styles.addressMobileActions}>
            <button className={styles.primary} onClick={openAddForm}>
              <Plus size={20} />
              Add address
            </button>
            <button
              className={styles.secondary}
              disabled={locating}
              onClick={useLocation}
            >
              <Navigation size={17} />
              {locating ? 'Finding your address…' : 'Use current location'}
            </button>
          </div>
        </div>
        <aside className={`${styles.panel} ${styles.addressMap}`}>
          {focusedAddress ? (
            <>
              <iframe
                key={focusedAddress.id}
                title="Selected saved address on map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(focusedAddress.address)}&output=embed`}
              />
              <p>
                <MapPin
                  size={15}
                  style={{ display: 'inline', marginRight: 6 }}
                />
                {focusedAddress.address}
              </p>
            </>
          ) : (
            <CustomerEmpty>
              Your saved locations will appear here.
            </CustomerEmpty>
          )}
        </aside>
      </div>
      {formOpen && (
        <CustomerDialog
          title={editingId ? 'Edit address' : 'Add address'}
          onClose={() => {
            if (!saving) closeForm()
          }}
        >
          <form onSubmit={handleSubmit}>
            <ShoppingAddressField label="Saved address" value={addressInput} onChange={v=>{gpsVersion.current++;setLocating(false);setAddressInput(v);setCoords(null)}} onSelect={p=>{gpsVersion.current++;setLocating(false);setAddressInput(p.address);setCoords({lat:p.lat,lng:p.lng})}} />
            {errorMsg && (
              <p className={styles.error} role="alert">
                {errorMsg}
              </p>
            )}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving}
                onClick={closeForm}
              >
                Cancel
              </button>
              <button
                className={styles.primary}
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save address'}
              </button>
            </div>
          </form>
        </CustomerDialog>
      )}
    </CustomerPage>
  )
}
