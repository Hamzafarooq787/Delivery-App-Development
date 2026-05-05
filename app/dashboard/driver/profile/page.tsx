import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { User, Car } from "lucide-react"
import { ProfileForm } from "@/components/driver/profile-form"

export default async function DriverProfilePage() {
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
    <div className="flex flex-col gap-6">
      <PageHeader title="My Profile" description="Manage your driver profile and vehicle information." />

      <div className="max-w-xl flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{profile.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">{profile.email}</p>
            </div>
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Info</h3>
          <ProfileForm fullName={profile.full_name} phone={profile.phone} />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Car className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Vehicle Information</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Make</label>
                <input type="text" placeholder="e.g. Toyota" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Model</label>
                <input type="text" placeholder="e.g. Corolla" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Year</label>
                <input type="text" placeholder="e.g. 2020" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Plate Number</label>
                <input type="text" placeholder="e.g. ABC-1234" className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
