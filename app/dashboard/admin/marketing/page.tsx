import { adminGetCampaigns, adminGetReengagementSettings } from "@/app/actions/marketing"
import { adminGetPromoCodes } from "@/app/actions/promotions"
import { MarketingPanel } from "@/components/admin/marketing-panel"

export const dynamic = "force-dynamic"

export default async function AdminMarketingPage() {
  const [campaignsRes, settingsRes, promoCodesRes] = await Promise.all([
    adminGetCampaigns(),
    adminGetReengagementSettings(),
    adminGetPromoCodes(),
  ])

  return (
    <MarketingPanel
      initialCampaigns={campaignsRes.data}
      initialSettings={settingsRes.data}
      promoCodes={promoCodesRes.data}
    />
  )
}
