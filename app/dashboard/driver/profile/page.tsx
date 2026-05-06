import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ProfileForm } from "@/components/driver/profile-form"
import { VehicleForm } from "@/components/driver/vehicle-form"

export const dynamic = "force-dynamic"

export default async function DriverProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = { full_name: "", phone: "", email: user?.email ?? "" }
  let vehicleType = ""
  let vehicleNumber = ""

  if (user) {
    const admin = createAdminClient()
    const [usersRes, profileRes] = await Promise.all([
      supabase.from("users").select("full_name, phone, email").eq("id", user.id).single(),
      admin.from("driver_profiles").select("vehicle_type, vehicle_number").eq("id", user.id).single(),
    ])
    if (usersRes.data) {
      profile = {
        full_name: usersRes.data.full_name ?? "",
        phone: usersRes.data.phone ?? "",
        email: usersRes.data.email ?? user.email ?? "",
      }
    }
    if (profileRes.data) {
      vehicleType = profileRes.data.vehicle_type ?? ""
      vehicleNumber = profileRes.data.vehicle_number ?? ""
    }
  }

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
    : "DR"

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">My Profile</h1>
        <p className="text-[#adaaaa] mt-1">Manage your personal and vehicle information.</p>
      </div>

      <div className="max-w-xl flex flex-col gap-5">
        {/* Personal info card */}
        <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-[#a3a6ff]">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate">{profile.full_name || "Driver"}</p>
              <p className="text-xs text-[#adaaaa] mt-0.5 truncate">{profile.email}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest mb-4">Personal Info</p>
          <ProfileForm fullName={profile.full_name} phone={profile.phone} />
        </div>

        {/* Vehicle info card */}
        <div className="bg-[#1a1919] border border-[#494847]/15 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#a3a6ff]">directions_car</span>
            <p className="text-sm font-bold text-white">Vehicle Information</p>
          </div>
          <VehicleForm vehicleType={vehicleType} vehicleNumber={vehicleNumber} />
        </div>
      </div>
    </div>
  )
}
