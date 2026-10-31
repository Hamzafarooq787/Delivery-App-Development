import "server-only"
import {randomUUID} from "node:crypto"
import {recordDispatchFailure} from "@/lib/dispatch-failures"
import {recordHealth} from "@/lib/integration-health"
/**
 * lib/email/send.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Email sending via Resend.
 *
 * ⚠️  SERVER-SIDE ONLY — never import in client components.
 *
 * Required environment variables (add to Vercel project settings):
 *   RESEND_API_KEY   — re_...            (Resend Dashboard → API Keys)
 *   EMAIL_FROM        — "Go Drop <hello@yourdomain.com>" (must be a domain
 *                        verified in Resend — Dashboard → Domains)
 *
 * Until these are configured, isEmailConfigured() returns false and
 * sendEmail() returns a { error } result instead of throwing — callers
 * (marketing sends, cron) treat this the same as any other per-recipient
 * failure rather than crashing the whole run.
 */

import { Resend } from "resend"

let resendInstance: Resend | null = null

/** True when RESEND_API_KEY and EMAIL_FROM are both present. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

function getResend(): Resend {
  if (!resendInstance) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error("[Email] RESEND_API_KEY is not set — add it to the environment before sending email.")
    }
    resendInstance = new Resend(key)
  }
  return resendInstance
}

/**
 * Send a single email. Never throws — returns { error } on failure
 * (missing config, invalid recipient, Resend API error) so bulk-send
 * callers can log a per-recipient failure and keep going.
 */
export async function retryEmailDelivery({
  to,
  subject,
  html,
  text, deliveryKey,
}: {
  deliveryKey:string
  to: string
  subject: string
  html: string
  text?: string
}): Promise<{ success: true } | { error: string }> {
  if (!isEmailConfigured()) {
    return { error: "Email is not configured — set RESEND_API_KEY and EMAIL_FROM." }
  }

  try {
    const resend = getResend()
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject,
      html,
      text,
    },{idempotencyKey:deliveryKey})
    if (error) {
      console.error("[Email] sendEmail failed:", error)
      return { error: error.message ?? "Failed to send email." }
    }
    return { success: true }
  } catch (error) {
    console.error("[Email] sendEmail threw:", error)
    return { error: error instanceof Error ? error.message : "Failed to send email." }
  }
}

/** Wraps marketing copy in a minimal branded HTML shell. */
export function marketingEmailHtml({
  heading,
  message,
  promoCode,
}: {
  heading: string
  message: string
  promoCode?: string | null
}): string {
  const promoBlock = promoCode
    ? `<div style="margin:24px 0;padding:16px;background:#f4f4ff;border:1px dashed #a3a6ff;border-radius:8px;text-align:center;">
         <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#6b6f9e;">Your code</p>
         <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:0.05em;color:#0f00a4;">${promoCode}</p>
       </div>`
    : ""

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#8387ff;font-weight:700;margin:0 0 24px;">Go Drop</p>
      <h1 style="font-size:22px;margin:0 0 16px;">${heading}</h1>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;margin:0 0 8px;">${message}</p>
      ${promoBlock}
      <p style="font-size:11px;color:#999;margin-top:32px;">
        You're receiving this because you opted in to marketing emails from Go Drop.
        You can unsubscribe anytime from your account settings.
      </p>
    </div>
  `
}

export async function sendEmail(input:{to:string;subject:string;html:string;text?:string}){const deliveryKey=randomUUID();const result=await retryEmailDelivery({...input,deliveryKey});if('error' in result){await recordDispatchFailure('email',null,{...input,deliveryKey},deliveryKey);await recordHealth('email',false,'Email provider did not confirm delivery')}else await recordHealth('email',true,'Email provider accepted delivery');return result}
