import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { SettingsTabsClient } from "./settings-tabs-client"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const {data:settings,error:settingsError}=await admin.from("surge_pricing_settings").select("platform_settings").eq("id",1).single()
  if(settingsError)throw new Error("Platform settings could not load. Please retry.")
  const p=settings.platform_settings
  const adminProfile={full_name:p.name??"GoDrop",email:p.email??"",phone:p.phone??""}

  const { data: bfmRow, error: bfmError } = await admin
    .from("bfm_settings")
    .select("*")
    .eq("id", 1)
    .single()

  if(bfmError||!bfmRow)throw new Error("Shopping settings could not load. Please retry.")
  const initialBfmSettings = bfmRow
    ? { service_enabled: bfmRow.enabled ?? bfmRow.service_enabled ?? false, max_purchase_amount: Number(bfmRow.max_purchase_amount ?? 50) }
    : { service_enabled: false, max_purchase_amount: 50 }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[var(--brand-bg)]">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Platform Config</h1>
        <p className="text-[var(--color-on-surface-variant)] mt-2 text-sm">
          Global controls — pricing, operations, integrations, and notifications.
        </p>
      </div>

      <SettingsTabsClient adminProfile={adminProfile} initialBfmSettings={initialBfmSettings} />
    </div>
  )
}
