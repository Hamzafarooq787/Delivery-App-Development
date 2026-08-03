import { adminGetPromoCodes, adminGetAutomaticDiscounts } from "@/app/actions/promotions"
import { adminGetSurgeSettings, adminGetBusyPeriodRules } from "@/app/actions/pricing"
import { PromotionsPanel } from "@/components/admin/promotions-panel"

export const dynamic = "force-dynamic"

export default async function AdminPromotionsPage() {
  const [promoCodesRes, autoDiscountsRes, surgeSettingsRes, busyRulesRes] = await Promise.all([
    adminGetPromoCodes(),
    adminGetAutomaticDiscounts(),
    adminGetSurgeSettings(),
    adminGetBusyPeriodRules(),
  ])

  return (
    <PromotionsPanel
      initialPromoCodes={promoCodesRes.data}
      initialAutomaticDiscounts={autoDiscountsRes.data}
      initialSurgeSettings={surgeSettingsRes.data}
      initialBusyPeriodRules={busyRulesRes.data}
    />
  )
}
