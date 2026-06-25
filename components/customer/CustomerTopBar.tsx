"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ProfileDropdown } from "@/components/shared/profile-dropdown"
import { InstallButton } from "@/components/pwa/install-button"

export function CustomerTopBar() {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setEmail(user.email ?? "")
      setUserId(user.id)
      const { data } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
      if (!cancelled) setName(data?.full_name ?? "")
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <header className="fixed top-0 left-0 right-0 md:left-64 h-16 bg-[#0e0e0e]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 z-40 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
      {/* Logo — mobile only */}
      <div className="md:hidden">
        <p className="text-base font-black text-white tracking-tighter font-headline">Go Drop</p>
        <p className="text-[9px] text-[#adaaaa] uppercase tracking-[0.18em] font-headline -mt-0.5">Logistics</p>
      </div>

      {/* Spacer for desktop (sidebar takes left space) */}
      <div className="hidden md:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <InstallButton />
        <ProfileDropdown
          name={name}
          email={email}
          role="Customer"
          activeRole="customer"
          userId={userId}
          profileHref="/dashboard/customer/settings"
        />
      </div>
    </header>
  )
}
