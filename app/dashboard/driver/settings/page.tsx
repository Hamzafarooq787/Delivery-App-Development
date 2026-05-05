import { createClient } from "@/lib/supabase/server"
import { DriverSettingsForm } from "@/components/driver/driver-settings-form"

export default async function DriverSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = { full_name: "", phone: "", email: "" }
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("full_name, phone, email")
      .eq("id", user.id)
      .single()
    if (data) profile = { full_name: data.full_name ?? "", phone: data.phone ?? "", email: data.email ?? "" }
  }

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tighter font-headline text-white">
            Account Settings
          </h2>
          <p className="text-[#adaaaa] mt-2">
            Manage your profile, vehicle status, and operational availability.
          </p>
        </div>
        <div className="flex gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {}}
            className="px-4 md:px-6 py-2.5 rounded-lg font-headline font-bold text-sm bg-[#262626] text-white hover:bg-[#2c2c2c] transition-all"
          >
            Discard
          </button>
          <button
            type="submit"
            form="driver-settings-form"
            className="px-4 md:px-6 py-2.5 rounded-lg font-headline font-bold text-sm bg-[#a3a6ff] text-[#0f00a4] transition-all"
            style={{ boxShadow: "0px 0px 15px rgba(163,166,255,0.2)" }}
          >
            Save Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Profile Section (8 cols) */}
        <section className="lg:col-span-8 space-y-6 md:space-y-8">
          {/* Profile Information */}
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-[#a3a6ff]/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-[#a3a6ff]">person</span>
              </div>
              <h3 className="text-xl font-bold font-headline text-white">Profile Information</h3>
            </div>
            <DriverSettingsForm fullName={profile.full_name} phone={profile.phone} email={profile.email} />
          </div>

          {/* Vehicle Details */}
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-[#c180ff]/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-[#c180ff]">local_shipping</span>
              </div>
              <h3 className="text-xl font-bold font-headline text-white">Vehicle Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Model &amp; Year</label>
                <input
                  className="w-full bg-[#262626] border border-[#494847]/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-[#a3a6ff]/30 focus:border-[#a3a6ff] transition-all outline-none"
                  type="text"
                  placeholder="e.g. 2024 Toyota Corolla"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">License Plate</label>
                <input
                  className="w-full bg-[#262626] border border-[#494847]/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-[#a3a6ff]/30 focus:border-[#a3a6ff] transition-all outline-none"
                  type="text"
                  placeholder="e.g. ABC-1234"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Sidebar (4 cols) */}
        <aside className="lg:col-span-4 space-y-6 md:space-y-8">
          {/* Availability Toggle */}
          <div className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-2xl p-5 md:p-8 flex flex-col items-center text-center border border-[#494847]/15">
            <div className="mb-6 relative">
              <div className="w-24 h-24 rounded-full border-4 border-[#a3a6ff]/20 flex items-center justify-center bg-[#a3a6ff]/5">
                <span className="material-symbols-outlined text-4xl text-[#a3a6ff]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  sensors
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#a3a6ff] rounded-full border-4 border-[#0e0e0e]" style={{ boxShadow: "0px 0px 10px rgba(163,166,255,0.3)" }} />
            </div>
            <h3 className="text-2xl font-black font-headline text-white mb-2">Driver Status</h3>
            <p className="text-sm text-[#adaaaa] mb-8 px-4 leading-relaxed">Toggle your visibility to the dispatch network.</p>
            <div className="w-full bg-[#0e0e0e] rounded-full p-1.5 flex items-center cursor-pointer">
              <div className="w-1/2 py-3 rounded-full bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm" style={{ boxShadow: "0px 0px 10px rgba(163,166,255,0.2)" }}>
                Online
              </div>
              <div className="w-1/2 py-3 rounded-full text-[#adaaaa] font-bold text-sm hover:text-white transition-colors">
                Offline
              </div>
            </div>
            <p className="mt-4 text-[11px] text-[#a3a6ff]/60 font-semibold tracking-wider uppercase">Receiving High Priority Jobs</p>
          </div>

          {/* Safety & Support */}
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-8 border border-[#494847]/5">
            <h3 className="text-lg font-bold font-headline text-white mb-6">Safety &amp; Support</h3>
            <div className="space-y-4">
              {[
                { icon: "cancel", label: "Cancel Active Job", color: "text-[#ff6e84]", hover: "hover:bg-[#a70138]/20", href: "/dashboard/driver/active-jobs" },
                { icon: "report", label: "Report Incident", color: "text-[#c180ff]", hover: "hover:bg-[#c180ff]/10", href: "/dashboard/driver/support" },
                { icon: "contact_support", label: "Live Dispatch Chat", color: "text-[#a3a6ff]", hover: "hover:bg-[#a3a6ff]/10", href: "/dashboard/driver/support" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`w-full flex items-center justify-between p-4 bg-[#262626] ${item.hover} group transition-all rounded-lg border border-[#494847]/5`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${item.color} group-hover:scale-110 transition-transform`}>{item.icon}</span>
                    <span className="font-semibold text-sm text-white">{item.label}</span>
                  </div>
                  <span className="material-symbols-outlined text-[#adaaaa] text-sm">chevron_right</span>
                </a>
              ))}
            </div>
          </div>

          {/* Driver Stats */}
          <div className="p-6 rounded-xl border border-[#a3a6ff]/10" style={{ background: "linear-gradient(to bottom right, rgba(163,166,255,0.1), transparent)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-[#a3a6ff] tracking-widest uppercase">Account</p>
            </div>
            <p className="text-sm text-[#adaaaa] leading-relaxed">{profile.email}</p>
            <div className="mt-4 pt-4 border-t border-[#494847]/10">
              <p className="text-[11px] text-[#adaaaa] font-semibold tracking-wider uppercase">Role: Driver</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
