"use server";
import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { notifyMultipleUsers } from "@/lib/notifications/internal";
import { revalidatePath } from "next/cache";
export async function fundShoppingCard(deliveryId: string, cardId: string) {
 return runAdminMutation("finance","fundShoppingCard",deliveryId,async()=>{
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
  if (!(await getAdminActor("finance"))) return { error: "Not authorized" };
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
    // Customer checkout is independent of company liquidity. Reserve actual
    // purchase-card capacity here, under a database lock, before enabling it.
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_company_shopping_card", {
      p_id: deliveryId, p_actor: user.id, p_card: cardId, p_available: available / 100,
    });
    if (reserveError || !reserved)
      return {
        error:
          reserveError?.message?.includes("company_purchase_capacity")
            ? "Other company cards have reserved these funds. Add funds to the business Issuing balance, then retry. The customer booking is retained."
            : "Card is assigned to another order, or this order changed. Refresh and retry.",
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

 })
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

/** Creates a real Stripe test card; never bypasses funding or purchase checks. */
export async function createSandboxShoppingCard(deliveryId:string){
 return runAdminMutation("finance","createSandboxShoppingCard",deliveryId,async()=>{
  if(!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY??""))return {error:"Sandbox card creation is disabled outside Stripe test mode."}
  const actor=await getAdminActor("finance");if(!actor)return {error:"Finance permission is required."}
  const admin=createAdminClient()
  const {data:job}=await admin.from("delivery_requests").select("id,driver_id,status,service_type,company_card_reference,max_spend_approved").eq("id",deliveryId).maybeSingle()
  if(!job || !job.driver_id || job.service_type!=="buy_for_me" || !["accepted","collected"].includes(job.status))return {error:"Assign a driver to an active Buy for Me test order first."}
  if(job.company_card_reference)return {cardId:job.company_card_reference}
  const {data:payment}=await admin.from("payments").select("stripe_payment_intent").eq("delivery_id",deliveryId).eq("purpose","booking").eq("status","paid").maybeSingle()
  if(!payment?.stripe_payment_intent)return {error:"A paid Stripe test booking is required."}
  try{
   const stripe=getStripe()
   const [balance,intent]=await Promise.all([stripe.balance.retrieve(),stripe.paymentIntents.retrieve(payment.stripe_payment_intent)])
   if(balance.livemode || intent.livemode)return {error:"Live funds cannot use the sandbox card tool."}
   const holder=await stripe.issuing.cardholders.create({type:"individual",name:"GoDrop Sandbox Driver",billing:{address:{line1:"1 Test Street",city:"Manchester",postal_code:"M1 1AE",country:"GB"}},metadata:{godrop_sandbox:"true"}},{idempotencyKey:`godrop-test-holder-${deliveryId}`})
   const card=await stripe.issuing.cards.create({cardholder:holder.id,currency:"gbp",type:"virtual",status:"inactive",metadata:{godrop_job_id:deliveryId,driver_id:job.driver_id,godrop_sandbox:"true"},spending_controls:{allowed_merchant_countries:["GB"],spending_limits:[{amount:Math.round(Number(job.max_spend_approved)*100),interval:"all_time"}]}},{idempotencyKey:`godrop-test-card-${deliveryId}`})
   if(card.livemode)return {error:"Unexpected live card response. Contact support."}
   return {cardId:card.id}
  }catch{return {error:"Stripe could not create the test card. Enable Issuing in this same sandbox and complete its test setup first. No funding bypass was applied."}}
 })
}
