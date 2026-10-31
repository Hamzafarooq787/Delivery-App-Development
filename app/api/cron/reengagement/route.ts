import {recordHealth} from "@/lib/integration-health"
/**
 * app/api/cron/reengagement/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatic re-engagement reminders — triggered daily by Vercel Cron (see
 * vercel.json). Sends "come back to Go Drop" reminders to customers who've
 * been inactive for `reengagement_settings.inactive_days`, over whichever
 * channel(s) are configured, always gated on each customer's marketing
 * consent. Skips anyone already reminded within the current inactivity
 * window (tracked in reengagement_sends) so it's a one-shot nudge, not a
 * daily spam loop.
 *
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
 * cron-triggered requests when CRON_SECRET is set as an env var — this
 * route rejects any request without a matching header, so it can't be
 * triggered by an outside caller.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveMarketingRecipients } from "@/lib/marketing/segments"
import { sendCampaignToRecipients } from "@/lib/marketing/send-campaign"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function run(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  const auth = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const compliance=await admin.rpc("driver_compliance_reminders")
  if(compliance.error)return NextResponse.json({error:"Driver compliance check failed"},{status:500})

  const { data: settings } = await admin.from("reengagement_settings").select("*").eq("id", true).maybeSingle()
  if (!settings || !settings.enabled) {
    return NextResponse.json({ skipped: true, reason: "Re-engagement reminders are disabled" })
  }

  let promoCodeText: string | null = null
  if (settings.promo_code_id) {
    const { data: promo } = await admin.from("promo_codes").select("code").eq("id", settings.promo_code_id).maybeSingle()
    promoCodeText = promo?.code ?? null
  }

  const inactiveDays: number = settings.inactive_days
  const candidates = await resolveMarketingRecipients(admin, "inactive", inactiveDays)
  if (candidates.length === 0) {
    return NextResponse.json({ sent: 0, reason: "No inactive customers found" })
  }

  // Skip anyone already sent a reminder within the current inactivity window.
  const { data: alreadySent } = await admin
    .from("reengagement_sends")
    .select("user_id, last_sent_at")
    .in("user_id", candidates.map((c) => c.id))

  const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000
  const recentlySentIds = new Set(
    (alreadySent ?? []).filter((s) => new Date(s.last_sent_at).getTime() > cutoff).map((s) => s.user_id)
  )
  const recipients = candidates.filter((c) => !recentlySentIds.has(c.id))

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, reason: "All inactive customers already reminded this window" })
  }

  const { data: campaign, error: insertError } = await admin
    .from("marketing_campaigns")
    .insert({
      type: "auto_reengagement",
      title: `Automatic re-engagement — ${new Date().toISOString().slice(0, 10)}`,
      subject: settings.subject,
      message: settings.message,
      channel: settings.channel,
      segment: "inactive",
      inactive_days: inactiveDays,
      promo_code_id: settings.promo_code_id,
      status: "sending",
      recipient_count: recipients.length,
    })
    .select("id")
    .single()

  if (insertError || !campaign) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create campaign" }, { status: 500 })
  }

  const result = await sendCampaignToRecipients({
    admin,
    campaignId: campaign.id,
    channel: settings.channel,
    subject: settings.subject,
    message: settings.message,
    promoCodeText,
    recipients,
  })

  await admin
    .from("marketing_campaigns")
    .update({
      status: "sent",
      sent_count: result.sent,
      failed_count: result.failed,
      skipped_count: result.skipped,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)

  const sentUserIds = recipients.map((r) => r.id)
  if (sentUserIds.length > 0) {
    await admin.from("reengagement_sends").upsert(
      sentUserIds.map((id) => ({ user_id: id, last_sent_at: new Date().toISOString() })),
      { onConflict: "user_id" }
    )
  }

  return NextResponse.json({ campaignId: campaign.id, ...result })
}

export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return new Response('Unauthorized',{status:401})
 try{const response=await run(request);await recordHealth("cron_reengagement",response.ok,`HTTP ${response.status}`);return response}catch{await recordHealth("cron_reengagement",false,'Run failed; check the operational queue and logs');return Response.json({error:'Scheduled processing failed'},{status:500})}
}
