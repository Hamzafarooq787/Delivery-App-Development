'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard/customer', icon: 'dashboard', label: 'Command Center' },
  { href: '/dashboard/customer/active-deliveries', icon: 'local_shipping', label: 'Shipments' },
  { href: '/dashboard/customer/tracking', icon: 'map', label: 'Live Tracking' },
  { href: '/dashboard/customer/history', icon: 'history', label: 'History' },
  { href: '/dashboard/customer/payments', icon: 'payments', label: 'Payments' },
  { href: '/dashboard/customer/addresses', icon: 'location_on', label: 'Addresses' },
  { href: '/dashboard/customer/settings', icon: 'settings', label: 'Settings' },
]

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name && name.trim()) || (email && email.split('@')[0]) || ''
  if (!source) return 'U'
  const parts = source.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return source.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState<string>('')
  const [role, setRole] = useState<string>('CUSTOMER')
  const [email, setEmail] = useState<string>('')

  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setEmail(user.email ?? '')
      setUserId(user.id)
      const { data, error } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) { console.error('[v0] sidebar user fetch error', error); return }
      if (data?.full_name) setName(data.full_name)
      if (data?.role) setRole(String(data.role).toUpperCase())
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  // Realtime: re-fetch name whenever the user's row changes (e.g. after Settings saves)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`sidebar-user-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { full_name?: string | null; role?: string | null }
          if (row.full_name !== undefined) setName(row.full_name ?? '')
          if (row.role) setRole(String(row.role).toUpperCase())
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId])

  const displayName = name || (email ? email.split('@')[0] : 'Account')

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-[#0e0e0e] flex flex-col py-6 hidden md:flex z-50">
      <div className="px-6 mb-10">
        <h1 className="text-xl font-black text-white tracking-tighter font-headline">Kinetic Void</h1>
        <p className="text-xs text-on-surface-variant font-label uppercase tracking-[0.2em] mt-1">Logistics HQ</p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center px-6 py-3 transition-colors duration-200 ${
                isActive
                  ? 'border-l-4 border-primary bg-surface-container-low text-white'
                  : 'text-on-surface-variant hover:text-white hover:bg-surface-container'
              }`}
            >
              <span
                className="material-symbols-outlined mr-4"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-headline text-sm font-medium tracking-wide">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-6 mt-auto space-y-3">
        <div className="flex items-center p-3 rounded-xl bg-surface-container">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary font-bold font-headline">
            {initials(name, email)}
          </div>
          <div className="ml-3 min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">{displayName}</p>
            <p className="text-[10px] text-on-surface-variant font-label">{role}</p>
          </div>
        </div>
        <LogoutButton className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-on-surface-variant hover:text-white hover:bg-surface-container rounded-lg transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-base">logout</span>
          <span className="font-headline tracking-tight">Sign Out</span>
        </LogoutButton>
      </div>
    </aside>
  )
}
