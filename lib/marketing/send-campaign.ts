/**
 * lib/marketing/send-campaign.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core "send a campaign to a list of recipients" logic, shared by the admin
 * manual-broadcast action and the automatic re-engagement cron route.
 *
 * Every send is gated server-side on the recipient's actual opt-in flag for
 * that channel — a campaign's `channel` setting only determines which
 * channels are ATTEMPTED, never bypasses consent.
 *
 * ⚠️  SERVER-SIDE ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendPushNotificationToMultipleUsers } from "@/lib/notifications/send"
import { sendEmail, marketingEmailHtml } from "@/lib/email/send"
import type { MarketingRecipient } from "./segments"

export type CampaignChannel = "push" | "email" | "both"

export type SendCampaignResult = {
  sent: number
  failed: number
  skipped: number
}

/**
 * Sends the campaign message to every recipient over the requested
 * channel(s), logging one row per (recipient, channel) attempt to
 * marketing_campaign_recipients, and returns aggregate counts.
 */
export async function sendCampaignToRecipients({
  admin,
  campaignId,
  channel,
  subject,
  message,
  promoCodeText,
  recipients,
}: {
  admin: SupabaseClient
  campaignId: string
  channel: CampaignChannel
  subject: string
  message: string
  promoCodeText?: string | null
  recipients: MarketingRecipient[]
}): Promise<SendCampaignResult> {
  const result: SendCampaignResult = { sent: 0, failed: 0, skipped: 0 }
  const recipientRows: {
    campaign_id: string
    user_id: string
    channel: "push" | "email"
    status: "sent" | "failed" | "skipped_opted_out" | "skipped_no_contact"
    error: string | null
  }[] = []

  const wantsPush = channel === "push" || channel === "both"
  const wantsEmail = channel === "email" || channel === "both"

  // ── Push: batch-send to everyone opted in at once ──────────────────────────
  if (wantsPush) {
    const pushOptedIn = recipients.filter((r) => r.marketing_push_opt_in)
    const pushSkipped = recipients.filter((r) => !r.marketing_push_opt_in)

    if (pushOptedIn.length > 0) {
      const results = await sendPushNotificationToMultipleUsers({
        userIds: pushOptedIn.map((r) => r.id),
        notification: { title: subject, body: message, url: "/dashboard/customer", tag: `marketing-${campaignId}` },
      })
      const resultByUser = new Map(results.map((r) => [r.userId, r.result]))
      for (const r of pushOptedIn) {
        const sendResult = resultByUser.get(r.id)
        const ok = sendResult && sendResult.successCount > 0
        recipientRows.push({
          campaign_id: campaignId,
          user_id: r.id,
          channel: "push",
          status: ok ? "sent" : "failed",
          error: ok ? null : "No push delivered (no registered device or send failed)",
        })
        ok ? result.sent++ : result.failed++
      }
    }
    for (const r of pushSkipped) {
      recipientRows.push({ campaign_id: campaignId, user_id: r.id, channel: "push", status: "skipped_opted_out", error: null })
      result.skipped++
    }
  }

  // ── Email: send individually (Resend has no native bulk-personalized send here) ──
  if (wantsEmail) {
    for (const r of recipients) {
      if (!r.marketing_email_opt_in) {
        recipientRows.push({ campaign_id: campaignId, user_id: r.id, channel: "email", status: "skipped_opted_out", error: null })
        result.skipped++
        continue
      }
      if (!r.email) {
        recipientRows.push({ campaign_id: campaignId, user_id: r.id, channel: "email", status: "skipped_no_contact", error: null })
        result.skipped++
        continue
      }

      const sendResult = await sendEmail({
        to: r.email,
        subject,
        html: marketingEmailHtml({ heading: subject, message, promoCode: promoCodeText }),
        text: promoCodeText ? `${message}\n\nYour code: ${promoCodeText}` : message,
      })
      const ok = "success" in sendResult
      recipientRows.push({
        campaign_id: campaignId,
        user_id: r.id,
        channel: "email",
        status: ok ? "sent" : "failed",
        error: ok ? null : sendResult.error,
      })
      ok ? result.sent++ : result.failed++
    }
  }

  if (recipientRows.length > 0) {
    await admin.from("marketing_campaign_recipients").insert(recipientRows)
  }

  return result
}
