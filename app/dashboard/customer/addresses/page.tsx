'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

type AddressRow = {
  id: string
  address: string
  created_at: string | null
}

export default function AddressesPage() {
  const [showModal, setShowModal] = useState(false)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) { setAddresses([]); setLoading(false) }; return }
      if (cancelled) return
      setUserId(user.id)
      const { data, error } = await supabase
        .from('addresses')
        .select('id,address,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('[v0] addresses fetch error', error)
        setAddresses([])
      } else {
        setAddresses((data ?? []) as AddressRow[])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  function openAddForm() {
    setEditingId(null)
    setAddressInput('')
    setErrorMsg(null)
    setFormOpen(true)
  }

  function openEditForm(addr: AddressRow) {
    setEditingId(addr.id)
    setAddressInput(addr.address ?? '')
    setErrorMsg(null)
    setFormOpen(true)
  }

  function closeForm() {
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
    setSaving(true)
    setErrorMsg(null)

    if (editingId) {
      const { data, error } = await supabase
        .from('addresses')
        .update({ address: trimmed })
        .eq('id', editingId)
        .eq('user_id', userId)
        .select('id,address,created_at')
        .single()
      setSaving(false)
      if (error) {
        console.error('[v0] update address error', error)
        setErrorMsg(error.message || 'Failed to update address.')
        return
      }
      setAddresses((prev) => prev.map((a) => (a.id === editingId ? (data as AddressRow) : a)))
      closeForm()
    } else {
      const { data, error } = await supabase
        .from('addresses')
        .insert({ user_id: userId, address: trimmed })
        .select('id,address,created_at')
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
  }

  async function handleDelete(id: string) {
    if (!userId) return
    const ok = window.confirm('Delete this address?')
    if (!ok) return
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) {
      console.error('[v0] delete address error', error)
      window.alert(error.message || 'Failed to delete address.')
      return
    }
    setAddresses((prev) => prev.filter((a) => a.id !== id))
    if (editingId === id) closeForm()
  }

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 md:ml-64 min-h-screen bg-surface-container-low">
        <div className="p-10 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-12">
            <div>
              <nav className="flex text-xs font-label text-on-surface-variant mb-2 gap-2">
                <span>Settings</span>
                <span>/</span>
                <span className="text-primary">Addresses</span>
              </nav>
              <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface">
                Saved Addresses
              </h2>
              <p className="text-on-surface-variant mt-2 max-w-md text-sm">
                Save the locations you ship to and from for faster delivery requests.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddForm}
              className="self-start md:self-auto px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_location_alt</span>
              Add Address
            </button>
          </div>

          {/* Inline Add/Edit Form */}
          {formOpen && (
            <form
              onSubmit={handleSubmit}
              className="glass-card rounded-xl border border-outline-variant/15 p-6 mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline font-bold text-on-surface text-lg">
                  {editingId ? 'Edit Address' : 'New Address'}
                </h3>
                <button
                  type="button"
                  onClick={closeForm}
                  className="p-2 hover:bg-white/10 rounded-lg text-on-surface-variant transition-colors"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                  Address
                </label>
                <textarea
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface resize-none"
                  placeholder="Street, City, Postal code, Country"
                  autoFocus
                />
              </div>
              <div className="flex justify-end items-center gap-3 mt-4 flex-wrap">
                {errorMsg && (
                  <span className="text-xs text-error font-medium">{errorMsg}</span>
                )}
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="px-4 py-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors rounded-lg text-xs font-bold border border-outline-variant/15 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-primary text-on-primary hover:brightness-110 transition-colors rounded-lg text-xs font-bold disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Address'}
                </button>
              </div>
            </form>
          )}

          {/* Address List */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
                Loading addresses...
              </span>
            </div>
          ) : addresses.length === 0 ? (
            <div className="bg-surface-container rounded-xl border border-outline-variant/10 px-8 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined">location_off</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-on-surface">No saved addresses</h3>
              <p className="text-sm text-on-surface-variant mt-2 max-w-md">
                Add the locations you frequently ship to or from. They&apos;ll be ready to pick when you create a new delivery.
              </p>
              <button
                type="button"
                onClick={openAddForm}
                className="mt-6 bg-primary text-on-primary px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                Add Your First Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="glass-card p-6 rounded-xl relative group overflow-hidden transition-all hover:-translate-y-1 border border-white/5"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-primary/20 p-2 rounded-lg flex-shrink-0">
                        <span className="material-symbols-outlined text-primary">location_on</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-headline font-bold text-on-surface truncate">Saved Address</h3>
                        <span className="text-[10px] tracking-widest text-primary font-bold uppercase">
                          {addr.created_at
                            ? new Date(addr.created_at).toLocaleDateString()
                            : 'Saved'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(addr)}
                        className="p-2 hover:bg-white/10 rounded-lg text-on-surface-variant transition-colors"
                        aria-label="Edit address"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(addr.id)}
                        className="p-2 hover:bg-error/10 hover:text-error rounded-lg text-on-surface-variant transition-colors"
                        aria-label="Delete address"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-surface-container-lowest/50 rounded-lg">
                    <p className="text-sm font-medium leading-relaxed text-on-surface-variant whitespace-pre-line">
                      {addr.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
