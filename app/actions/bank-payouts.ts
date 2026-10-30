"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { canRetryCreate } from "@/lib/payouts/engine";
import { revalidatePath } from "next/cache";

export async function connectDriverBank() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user?.email) return { error: "Please sign in again." };
  const db = createAdminClient();
  const begin = await db.rpc("begin_driver_connect", { p_driver: user.id });
  if (begin.error) return { error: "Bank setup is available after driver approval." };
  try {
    const stripe = getStripe();
    let account: string | null = begin.data.account;
    if (!account) {
      if (!canRetryCreate(begin.data.started_at, Date.now()))
        return { error: "Your earlier bank setup needs support to reconcile it. No second account has been created." };
      const created = await stripe.v2.core.accounts.create({
        contact_email: user.email,
        identity: { country: "GB" },
        dashboard: "express",
        defaults: { currency: "gbp", locales: ["en-GB"] },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { godrop_driver: user.id },
      }, { idempotencyKey: `godrop:driver:${user.id}` });
      account = created.id;
      const saved = await db.from("driver_profiles").update({ stripe_connect_account_id: account }).eq("id", user.id).is("stripe_connect_account_id", null);
      if (saved.error) throw saved.error;
    }
    // Never build financial-provider return URLs from user-supplied Host headers.
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://godrop.uk").origin;
    if (!origin.startsWith("https://")) throw new Error("HTTPS app URL required");
    const link = await stripe.v2.core.accountLinks.create({ account, use_case: {
      type: "account_onboarding", account_onboarding: {
        configurations: ["recipient"],
        refresh_url: `${origin}/dashboard/driver/payouts?bank=retry`,
        return_url: `${origin}/dashboard/driver/payouts?bank=returned`,
      },
    } });
    return { url: link.url };
  } catch {
    return { error: "Stripe bank setup is unavailable. Please retry or contact support; your earnings remain reserved." };
  }
}

export async function setAutomaticPayouts(enabled: boolean) {
  if (typeof enabled !== "boolean") return { error: "Invalid setting." };
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const role = await session.from("users").select("role").eq("id", user.id).single();
  if (role.data?.role !== "admin") return { error: "Not authorized." };
  try {
    if (enabled) await getStripe().balance.retrieve();
    const db = createAdminClient();
    const saved = await db.rpc("set_automatic_bank_payouts", { p_actor: user.id, p_enabled: enabled });
    if (saved.error) throw saved.error;
    revalidatePath("/dashboard/admin/payouts");
    return { success: true };
  } catch { return { error: "Unable to save payout setting. Check Stripe configuration and retry." }; }
}
