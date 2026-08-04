/**
 * app/actions/marketing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer Database & Marketing:
 *  - Customer-facing marketing consent (opt-in/opt-out, UK PECR compliant —
 *    both channels default to opted-out and require an explicit action).
 *  - Admin manual broadcast campaigns (promotional offers, discount codes,
 *    service updates) sent via push and/or email, always gated on consent.
 *  - Admin configuration for the automatic re-engagement reminder cron.
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { resolveMarketingRecipients, type MarketingSegment } from "@/lib/marketing/segments"
import { sendCampaignToRecipients, type CampaignChannel } from "@/lib/marketing/send-campaign"

// ── Customer: marketing consent ─────────────────────────────────────────────────

export type MarketingConsent = {
  marketing_email_opt_in: boolean
  marketing_push_opt_in: boolean
}

export async function getMarketingConsent(): Promise<{ data: MarketingConsent | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("users")
    .select("marketing_email_opt_in, marketing_push_opt_in")
    .eq("id", user.id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as MarketingConsent | null }
}

export async function updateMarketingConsent(input: {
  emailOptIn: boolean
  pushOptIn: boolean
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("users")
    .update({
      marketing_email_opt_in: input.emailOptIn,
      marketing_push_opt_in: input.pushOptIn,
      marketing_consent_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/customer/settings")
  return { success: true }
}

// ── Admin guard ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  return data?.role === "admin"
}

// ── Admin: audience ──────────────────────────────────────────────────────────

export type MarketingCustomerRow = {
  id: string
  full_name: string
  email: string | null
  marketing_email_opt_in: boolean
  marketing_push_opt_in: boolean
  last_activity_at: string
}

export async function adminGetCustomersForMarketing(): Promise<{ data: MarketingCustomerRow[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }
  const admin = createAdminClient()
  const recipients = await resolveMarketingRecipients(admin, "all")
  return { data: recipients }
}

/** Recipient counts for a segment/channel combo, shown before sending. */
export async function adminPreviewSegment(
  segment: MarketingSegment,
  inactiveDays: number | null,
  channel: CampaignChannel
): Promise<{ data: { total: number; willReceive: number; skippedOptedOut: number; skippedNoContact: number } }> {
  if (!(await requireAdmin())) return { data: { total: 0, willReceive: 0, skippedOptedOut: 0, skippedNoContact: 0 } }
  const admin = createAdminClient()
  const recipients = await resolveMarketingRecipients(admin, segment, inactiveDays)

  const wantsPush = channel === "push" || channel === "both"
  const wantsEmail = channel === "email" || channel === "both"

  let willReceive = 0
  let skippedOptedOut = 0
  let skippedNoContact = 0
  for (const r of recipients) {
    let receivesAny = false
    if (wantsPush) {
      if (r.marketing_push_opt_in) receivesAny = true
      else skippedOptedOut++
    }
    if (wantsEmail) {
      if (r.marketing_email_opt_in && r.email) receivesAny = true
      else if (r.marketing_email_opt_in && !r.email) skippedNoContact++
      else skippedOptedOut++
    }
    if (receivesAny) willReceive++
  }

  return { data: { total: recipients.length, willReceive, skippedOptedOut, skippedNoContact } }
}

// ── Admin: campaigns ─────────────────────────────────────────────────────────

export type MarketingCampaign = {
  id: string
  type: "manual" | "auto_reengagement"
  title: string
  subject: string
  message: string
  channel: CampaignChannel
  segment: MarketingSegment
  inactive_days: number | null
  promo_code_id: string | null
  status: "sending" | "sent" | "failed"
  recipient_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  created_at: string
  completed_at: string | null
}

export async function adminGetCampaigns(): Promise<{ data: MarketingCampaign[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as MarketingCampaign[] }
}

export type CreateCampaignInput = {
  title: string
  subject: string
  message: string
  channel: CampaignChannel
  segment: MarketingSegment
  inactiveDays: number | null
  promoCodeId: string | null
}

export async function adminCreateAndSendCampaign(
  input: CreateCampaignInput
): Promise<{ success?: boolean; error?: string; campaignId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await requireAdmin())) return { error: "Not authorized" }

  if (!input.title.trim()) return { error: "Title is required" }
  if (!input.subject.trim()) return { error: "Subject is required" }
  if (!input.message.trim()) return { error: "Message is required" }
  if (input.segment === "inactive" && (!input.inactiveDays || input.inactiveDays <= 0)) {
    return { error: "Inactive-days threshold must be greater than 0" }
  }

  const admin = createAdminClient()

  let promoCodeText: string | null = null
  if (input.promoCodeId) {
    const { data: promo } = await admin.from("promo_codes").select("code").eq("id", input.promoCodeId).maybeSingle()
    promoCodeText = promo?.code ?? null
  }

  const recipients = await resolveMarketingRecipients(admin, input.segment, input.inactiveDays)

  const { data: campaign, error: insertError } = await admin
    .from("marketing_campaigns")
    .insert({
      type: "manual",
      title: input.title.trim(),
      subject: input.subject.trim(),
      message: input.message.trim(),
      channel: input.channel,
      segment: input.segment,
      inactive_days: input.segment === "inactive" ? input.inactiveDays : null,
      promo_code_id: input.promoCodeId,
      status: "sending",
      recipient_count: recipients.length,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (insertError || !campaign) return { error: insertError?.message ?? "Failed to create campaign" }

  try {
    const result = await sendCampaignToRecipients({
      admin,
      campaignId: campaign.id,
      channel: input.channel,
      subject: input.subject.trim(),
      message: input.message.trim(),
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
  } catch (error) {
    console.error("[Marketing] adminCreateAndSendCampaign send failed:", error)
    await admin.from("marketing_campaigns").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", campaign.id)
    return { error: "Campaign created but sending failed partway through — check Campaign History for details." }
  }

  revalidatePath("/dashboard/admin/marketing")
  return { success: true, campaignId: campaign.id }
}

// ── Admin: re-engagement settings ───────────────────────────────────────────

export type ReengagementSettings = {
  enabled: boolean
  inactive_days: number
  channel: CampaignChannel
  subject: string
  message: string
  promo_code_id: string | null
}

export async function adminGetReengagementSettings(): Promise<{ data: ReengagementSettings | null; error?: string }> {
  if (!(await requireAdmin())) return { data: null, error: "Not authorized" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("reengagement_settings").select("*").eq("id", true).maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data: data as ReengagementSettings | null }
}

export async function adminUpdateReengagementSettings(
  input: ReengagementSettings
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await requireAdmin())) return { error: "Not authorized" }

  if (!input.inactive_days || input.inactive_days <= 0) return { error: "Inactive-days threshold must be greater than 0" }
  if (!input.subject.trim()) return { error: "Subject is required" }
  if (!input.message.trim()) return { error: "Message is required" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("reengagement_settings")
    .update({
      enabled: input.enabled,
      inactive_days: input.inactive_days,
      channel: input.channel,
      subject: input.subject.trim(),
      message: input.message.trim(),
      promo_code_id: input.promo_code_id,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", true)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/marketing")
  return { success: true }
}
