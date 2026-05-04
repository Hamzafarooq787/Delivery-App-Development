'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

const staticAddresses = [
  {
    id: 'hq',
    title: 'Main Headquarters',
    tag: 'PRIMARY HUB',
    tagColor: 'text-primary',
    icon: 'home',
    iconBg: 'bg-primary/20',
    iconColor: 'text-primary',
    address: '4820 Kinetic Way, Suite 900\nNeo-Tokyo Logistics District\nJP-100-0005',
    footer: (
      <div className="flex items-center justify-between pt-2">
        <div className="flex -space-x-2">
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-white border-2 border-surface-container">A</div>
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white border-2 border-surface-container">B</div>
        </div>
        <span className="text-[10px] text-on-surface-variant font-medium">12 active dispatches</span>
      </div>
    ),
    span: '',
  },
  {
    id: 'central',
    title: 'Central Office',
    tag: 'Corporate',
    tagColor: 'text-on-surface-variant',
    icon: 'business',
    iconBg: 'bg-tertiary-fixed-dim/20',
    iconColor: 'text-tertiary-fixed-dim',
    address: '12 Tech Plaza, Floor 42\nSilicon Forest, OR\nUS-97035',
    footer: (
      <div className="flex items-center justify-between pt-2">
        <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tight">
          Last used: 2 hours ago
        </span>
      </div>
    ),
    span: '',
  },
  {
    id: 'satellite',
    title: 'Satellite Hub Delta',
    tag: 'Temporary',
    tagColor: 'text-on-surface-variant',
    icon: 'warehouse',
    iconBg: 'bg-outline-variant/20',
    iconColor: 'text-outline-variant',
    address: 'Pier 15, Hangar B\nPort of Seattle, WA\nUS-98101',
    footer: null,
    span: '',
  },
]

export default function AddressesPage() {
  const [showModal, setShowModal] = useState(false)
  const [dbAddresses, setDbAddresses] = useState<{id:string,address:string,created_at:string|null}[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('addresses').select('id,address,created_at').eq('user_id', user.id).order('created_at', { ascending: false })
      if (error) { console.error('[v0] addresses fetch error', error); return }
      setDbAddresses((data ?? []) as any)
    }
    load()
  }, [supabase])

  async function handleAddAddress() {
    const value = window.prompt('Enter new address')
    if (!value?.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('addresses').insert({ user_id: user.id, address: value.trim() }).select('id,address,created_at').single()
    if (error) { console.error('[v0] add address error', error); return }
    setDbAddresses((prev) => [data as any, ...prev])
  }

  async function handleDeleteAddress(id: string) {
    const ok = window.confirm('Delete this address?')
    if (!ok) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id)
    if (error) { console.error('[v0] delete address error', error); return }
    setDbAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 md:ml-64 min-h-screen bg-surface-container-low">
        <div className="p-10 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex justify-between items-end mb-12">
            <div>
              <nav className="flex text-xs font-label text-on-surface-variant mb-2 gap-2">
                <span>Settings</span>
                <span>/</span>
                <span className="text-primary">Addresses</span>
              </nav>
              <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface">
                Manage Locations
              </h2>
              <p className="text-on-surface-variant mt-2 max-w-md text-sm">
                Precision logistics starts with accurate destination mapping. Control your primary fleet
                anchors here.
              </p>
            </div>
          </div>

          {/* Address Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Add New Card */}
            <div onClick={handleAddAddress}
              className="group relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-outline-variant/30 hover:border-primary/50 transition-all cursor-pointer bg-surface-container hover:bg-surface-container-high">
              <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-3xl">add_location_alt</span>
              </div>
              <span className="font-headline font-bold text-white">Add New Address</span>
              <p className="text-xs text-on-surface-variant mt-1">Register a new kinetic anchor</p>
            </div>

            {/* Address Cards */}
            {[...dbAddresses.map((a, idx) => ({
              id: a.id,
              title: `Saved Address ${idx + 1}`,
              tag: "Saved",
              tagColor: "text-primary",
              icon: "location_on",
              iconBg: "bg-primary/20",
              iconColor: "text-primary",
              address: a.address,
              footer: null,
              span: "",
              isSaved: true,
            })), ...staticAddresses.map((s) => ({ ...s, isSaved: false }))].map((addr) => (
              <div
                key={addr.id}
                className={`glass-card p-6 rounded-xl relative group overflow-hidden transition-all hover:-translate-y-1 border border-white/5 ${addr.span}`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`${addr.iconBg} p-2 rounded-lg`}>
                      <span className={`material-symbols-outlined ${addr.iconColor}`}>{addr.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-lg text-white">{addr.title}</h3>
                      <span className={`text-[10px] tracking-widest ${addr.tagColor} font-bold uppercase`}>
                        {addr.tag}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-white/10 rounded-lg text-on-surface-variant transition-colors">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addr.isSaved && handleDeleteAddress(addr.id)}
                      className="p-2 hover:bg-error/10 hover:text-error rounded-lg text-on-surface-variant transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-surface-container-lowest/50 rounded-lg">
                    <p className="text-sm font-medium leading-relaxed text-on-surface-variant whitespace-pre-line">
                      {addr.address}
                    </p>
                  </div>
                  {addr.footer}
                </div>
              </div>
            ))}

            {/* Featured Fulfillment Center (spans 2 cols) */}
            <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden flex flex-col md:flex-row border border-white/5">
              <div
                className="w-full md:w-1/2 h-48 md:h-auto bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA-7e7MVKBbtdMQsD0dn0M8YtFhb8cOdITZKTfC5xjwogLTXzSzDvKknBzXi_NnG7nmfZTOPsmNkNKbmtl4OfmLDO4LdGO9RVuA-rw0zp5SmcgI5P4wMvVE598K8HbNT2zUzrUDSPf25jiBl4cBx40MRvEkvxuC1AuHxfc2sWFrTSJRH9ZixvVs-zfjxckmarwwiy0xHv0w8oapMR6HP-PGivdAHDevcZFSyHLSQGgBhg9qgQPHffmxl6JlEdfbFNuMWB0LOmJ1lw')",
                }}
              >
                <div className="w-full h-full bg-gradient-to-r from-surface-container/80 to-transparent flex items-end p-6">
                  <div className="bg-primary/90 text-on-primary px-3 py-1 text-[10px] font-bold rounded-full">
                    LIVE TRACKING ACTIVE
                  </div>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-headline font-bold text-2xl text-white">
                        Fulfillment Center West
                      </h3>
                      <p className="text-primary text-sm font-medium">Strategic Expansion Zone 04</p>
                    </div>
                    <button className="p-2 hover:bg-white/10 rounded-lg text-on-surface-variant transition-colors">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                    800 Harbor Terminal Dr.
                    <br />
                    Long Beach, CA 90802
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-surface-container-high rounded-lg border border-white/5">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase">Efficiency</p>
                    <p className="text-xl font-headline font-extrabold text-white">98.4%</p>
                  </div>
                  <div className="p-3 bg-surface-container-high rounded-lg border border-white/5">
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase">Capacity</p>
                    <div className="w-full bg-surface-container-lowest h-1.5 rounded-full mt-2">
                      <div className="bg-secondary h-full rounded-full" style={{ width: '75%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map Section */}
          <section className="mt-12">
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5 h-[300px] relative">
              {/* Map placeholder with grid pattern */}
              <div
                className="w-full h-full bg-[#050505] opacity-80"
                style={{
                  backgroundImage: 'radial-gradient(#262626 1px, transparent 1px)',
                  backgroundSize: '30px 30px',
                }}
              />
              {/* Overlay Controls */}
              <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none">
                <div className="flex justify-between pointer-events-auto">
                  <div className="bg-surface/80 backdrop-blur-md p-4 rounded-xl border border-white/10">
                    <h4 className="text-sm font-bold font-headline mb-1">Global Anchor Network</h4>
                    <p className="text-xs text-on-surface-variant">
                      Visualizing 4 primary nodes across 2 continents
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-surface/80 backdrop-blur-md p-2 rounded-lg border border-white/10 text-on-surface">
                      <span className="material-symbols-outlined">layers</span>
                    </button>
                    <button className="bg-surface/80 backdrop-blur-md p-2 rounded-lg border border-white/10 text-on-surface">
                      <span className="material-symbols-outlined">my_location</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-center pointer-events-auto">
                  <div className="bg-primary/10 border border-primary/30 backdrop-blur-xl px-6 py-3 rounded-full flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs font-bold tracking-widest uppercase">System Nominal</span>
                    </div>
                    <div className="w-px h-4 bg-outline-variant/30" />
                    <p className="text-xs text-white">All anchors synchronized with Void-Mesh</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
