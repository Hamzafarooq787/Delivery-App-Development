import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect }          from "next/navigation"
import { getMyVehicles }     from "@/app/actions/vehicles"
import {
  DriverSettingsPanel,
  type DriverSettingsPanelProps,
} from "@/components/driver/driver-settings-panel"

export const dynamic = "force-dynamic"

export default async function DriverSettingsPage() {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const admin = createAdminClient()

  // ── Load user row + driver_profiles + vehicles in parallel ─────────────────
  const [userRes, profileRes, vehiclesRes] = await Promise.all([
    admin
      .from("users")
      .select("full_name, phone, email, role")
      .eq("id", user.id)
      .single(),
    admin
      .from("driver_profiles")
      .select("is_online, notifications_enabled, delivery_alerts")
      .eq("id", user.id)
      .single(),
    getMyVehicles(),
  ])

  // ── Defaults ───────────────────────────────────────────────────────────────
  const u = userRes.data
  const p = profileRes.data

  const props: DriverSettingsPanelProps = {
    fullName:             u?.full_name              ?? "",
    phone:                u?.phone                  ?? "",
    email:                u?.email ?? user.email    ?? "",
    role:                 u?.role                   ?? "driver",
    vehicles:             vehiclesRes.data,
    isOnline:             p?.is_online              ?? false,
    // notification columns added by scripts/014_driver_settings.sql
    // default to true if columns don't exist yet
    notificationsEnabled: (p as any)?.notifications_enabled ?? true,
    deliveryAlerts:       (p as any)?.delivery_alerts       ?? true,
  }

  const initials = props.fullName
    ? props.fullName.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()
    : "DR"

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-[#a3a6ff]">{initials}</span>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter font-headline text-white">
              Account Settings
            </h2>
            <p className="text-[#adaaaa] text-sm mt-0.5">
              {props.fullName || "Driver"} · {props.email}
            </p>
          </div>
        </div>
      </div>

      {/* Settings panel (client component — handles all state & actions) */}
      <DriverSettingsPanel {...props} />
    </div>
  )
}
