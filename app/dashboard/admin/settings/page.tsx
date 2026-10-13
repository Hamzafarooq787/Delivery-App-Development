import { createClient } from "@/lib/supabase/server"
import { GeneralSettingsForm } from "@/components/admin/general-settings-form"
import { SettingsTabsClient } from "./settings-tabs-client"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let adminProfile = { full_name: "", email: "", phone: "" }
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .single()
    if (data) adminProfile = { full_name: data.full_name ?? "", email: data.email ?? "", phone: data.phone ?? "" }
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Platform Config</h1>
        <p className="text-[#adaaaa] mt-2 text-sm">
          Global controls — pricing, operations, integrations, and notifications.
        </p>
      </div>

      <SettingsTabsClient adminProfile={adminProfile} />
    </div>
  )
}
