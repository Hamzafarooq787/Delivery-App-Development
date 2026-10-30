"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { notifyMultipleUsers } from "@/lib/notifications/internal";
import { revalidatePath } from "next/cache";
export async function fundShoppingCard(deliveryId: string, cardId: string) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "admin") return { error: "Not authorized" };
  if (!/^ic_[a-zA-Z0-9]+$/.test(cardId))
    return {
      error: "Enter a Stripe Issuing card reference, never a card number.",
    };
  const { data: job } = await admin
    .from("delivery_requests")
    .select("*")
    .eq("id", deliveryId)
    .single();
  if (
    !job ||
    job.service_type !== "buy_for_me" ||
    !["accepted", "collected"].includes(job.status) ||
    ["purchase_completed", "heading_to_customer"].includes(job.bfm_stage) ||
    !job.driver_id
  )
    return {
      error: "Assign an approved driver before enabling a shopping card.",
    };
  if (job.company_card_reference && job.company_card_reference !== cardId)
    return {
      error:
        "This order already has a dedicated card. Contact support before replacing it.",
    };
  try {
    const stripe = getStripe();
    const card = await stripe.issuing.cards.retrieve(cardId);
    if (
      card.currency !== "gbp" ||
      card.status === "canceled" ||
      (card.metadata?.godrop_job_id &&
        card.metadata.godrop_job_id !== deliveryId)
    )
      return { error: "Use a dedicated GBP company card for this order." };
    const previous = await stripe.issuing.transactions.list({
      card: cardId,
      limit: 1,
    });
    const holds = await stripe.issuing.authorizations.list({
      card: cardId,
      limit: 1,
    });
    if (
      (previous.data.length || holds.data.length) &&
      card.metadata?.godrop_job_id !== deliveryId
    )
      return {
        error: "This card has previous spending. Use a new dedicated card.",
      };
    const balance = await stripe.balance.retrieve();
    const available =
      balance.issuing?.available.find((b) => b.currency === "gbp")?.amount ?? 0;
    if (available < Math.round(Number(job.max_spend_approved) * 100))
      return {
        error:
          "Company Issuing balance is insufficient. Fund it from the business bank account first.",
      };
    const { data: reserved, error: reserveError } = await admin
      .from("delivery_requests")
      .update({ company_card_reference: cardId })
      .eq("id", deliveryId)
      .eq("status", job.status)
      .eq("driver_id", job.driver_id)
      .or(`company_card_reference.is.null,company_card_reference.eq.${cardId}`)
      .select("id")
      .maybeSingle();
    if (reserveError || !reserved)
      return {
        error:
          "Card is assigned to another order, or this order changed. Refresh and retry.",
      };
    await stripe.issuing.cards.update(cardId, {
      status: "inactive",
      metadata: { godrop_job_id: deliveryId, driver_id: job.driver_id },
      spending_controls: {
        spending_limits: [
          {
            amount: Math.round(Number(job.max_spend_approved) * 100),
            interval: "all_time",
          },
        ],
        allowed_merchant_countries: ["GB"],
      },
    });
    const { data, error } = await admin
      .from("delivery_requests")
      .update({
        company_card_reference: cardId,
        company_card_verified_at: new Date().toISOString(),
      })
      .eq("id", deliveryId)
      .eq("status", job.status)
      .eq("driver_id", job.driver_id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      await stripe.issuing.cards.update(cardId, { status: "inactive" });
      return {
        error: "Order changed. Card disabled; refresh before trying again.",
      };
    }
    revalidatePath(`/dashboard/admin/orders/${deliveryId}`);
    revalidatePath(`/dashboard/driver/jobs/${deliveryId}`);
    return { success: true };
  } catch {
    return {
      error:
        "Company card could not be verified. Stripe Issuing must be enabled and funded; the driver must not use personal money.",
    };
  }
}
export async function reportShoppingProblem(
  deliveryId: string,
  message: string,
) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!message.trim() || message.length > 1000)
    return { error: "Describe the problem in 1–1000 characters." };
  const { data, error } = await createAdminClient()
    .from("delivery_requests")
    .update({ shopping_problem: message.trim() })
    .eq("id", deliveryId)
    .eq("driver_id", user.id)
    .eq("service_type", "buy_for_me")
    .in("status", ["accepted", "collected"])
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not report this problem." };
  const { data: admins } = await createAdminClient()
    .from("users")
    .select("id")
    .eq("role", "admin");
  await notifyMultipleUsers({
    userIds: (admins ?? []).map((a) => a.id),
    title: "Shopping problem reported",
    body: message.trim().slice(0, 180),
    url: `/dashboard/admin/orders/${deliveryId}`,
    tag: `shopping-problem-${deliveryId}`,
  }).catch(() => {});
  revalidatePath(`/dashboard/admin/orders/${deliveryId}`);
  return { success: true };
}

export async function enableApprovedPurchase(deliveryId: string) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("delivery_requests")
    .select("company_card_reference,driver_id")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!job || job.driver_id !== user.id || !job.company_card_reference)
    return { error: "A verified company card is required." };
  const { data: total, error } = await admin.rpc("prepare_company_purchase", {
    p_id: deliveryId,
    p_driver: user.id,
  });
  if (error)
    return {
      error:
        "Confirm all shelf prices and resolve customer approvals first. The basket must be within the prepaid budget.",
    };
  try {
    if (Number(total) === 0) {
      await getStripe().issuing.cards.update(job.company_card_reference, {
        status: "inactive",
      });
      return { success: true, total: 0 };
    }
    await getStripe().issuing.cards.update(job.company_card_reference, {
      status: "active",
      spending_controls: {
        spending_limits: [
          { amount: Math.round(Number(total) * 100), interval: "all_time" },
        ],
        allowed_merchant_countries: ["GB"],
      },
    });
    return { success: true, total: Number(total) };
  } catch {
    return {
      error:
        "Card activation failed. Retry here; do not pay with personal money.",
    };
  }
}
