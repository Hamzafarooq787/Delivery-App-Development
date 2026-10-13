import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/driver/profile-form"

export const dynamic = "force-dynamic"

export default async function DriverProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = { full_name: "", phone: "", email: user?.email ?? "" }

  if (user) {
    const usersRes = await supabase.from("users").select("full_name, phone, email").eq("id", user.id).single()
    if (usersRes.data) {
      profile = {
        full_name: usersRes.data.full_name ?? "",
        phone: usersRes.data.phone ?? "",
        email: usersRes.data.email ?? user.email ?? "",
      }
    }
  }

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
    : "DR"

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">My Profile</h1>
        <p className="text-[#adaaaa] mt-1">Manage your personal information.</p>
      </div>

      <div className="max-w-xl flex flex-col gap-5">
        {/* Personal info card */}
        <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-[var(--color-primary)]">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate">{profile.full_name || "Driver"}</p>
              <p className="text-xs text-[#adaaaa] mt-0.5 truncate">{profile.email}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest mb-4">Personal Info</p>
          <ProfileForm fullName={profile.full_name} phone={profile.phone} />
        </div>

        {/* Vehicle management moved to Settings — supports multiple vehicles */}
        <Link
          href="/dashboard/driver/settings"
          className="flex items-center gap-4 bg-[#1a1919] border border-[#494847]/15 rounded-xl p-6 hover:border-[var(--color-primary)]/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[var(--color-primary)]">directions_car</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Manage Vehicles</p>
            <p className="text-xs text-[#adaaaa] mt-0.5">Add, edit, or remove vehicles in Settings.</p>
          </div>
          <span className="material-symbols-outlined text-[#adaaaa]">chevron_right</span>
        </Link>
      </div>
    </div>
  )
}

