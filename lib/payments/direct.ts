import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { notifyDriversOfNewDelivery, notifyMultipleUsers } from "@/lib/notifications/internal";
export async function fulfillDirectSession(session: Stripe.Checkout.Session) {
  if (
    session.metadata?.type !== "order_booking" ||
    session.payment_status !== "paid" ||
    session.currency !== "gbp"
  )
    throw new Error("Payment is not confirmed");
  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!intent || !session.metadata.payment_id || session.amount_total == null)
    throw new Error("Invalid payment reference");
  const admin = createAdminClient();
  // The session is created with immutable server-validated amount/draft.
  const { data: payment } = await admin
    .from("payments")
    .select("id,stripe_session_id")
    .eq("id", session.metadata.payment_id)
    .eq("customer_id", session.metadata.user_id)
    .maybeSingle();
  if (!payment) throw new Error("Booking payment not found");
  if (!payment.stripe_session_id) {
    const { error } = await admin
      .from("payments")
      .update({ stripe_session_id: session.id })
      .eq("id", payment.id)
      .is("stripe_session_id", null);
    if (error) throw error;
  }
  const { data, error } = await admin.rpc("finalize_direct_checkout", {
    p_payment_id: payment.id,
    p_session_id: session.id,
    p_intent: intent,
    p_amount: session.amount_total / 100,
  });
  if (error || !data?.id)
    throw error ?? new Error("Booking finalization failed");
  await reconcilePaymentProcessingFee(payment.id, intent).catch(() => false);
  if (!data.replayed) {
    const { data: order } = await admin
      .from("delivery_requests")
      .select("pickup_address,package_size,service_type")
      .eq("id", data.id)
      .single();
    if (order)
      await notifyDriversOfNewDelivery(
        data.id,
        order.pickup_address,
        order.package_size,
      ).catch(() => {});
    if (order?.service_type === 'buy_for_me') {
      const {data: admins} = await admin.from('users').select('id').eq('role','admin');
      if (admins?.length) await notifyMultipleUsers({userIds:admins.map(a=>a.id),title:'Paid shopping order needs company funding',body:'Assign a driver and verify a funded company purchase card before shopping starts.',url:`/dashboard/admin/orders/${data.id}`,tag:`shopping-funding-${data.id}`}).catch(()=>{});
    }
  }
  return data as {
    id: string;
    tracking_number: string;
    replayed: boolean;
    service_type?: string;
  };
}
export async function processOrderRefunds(deliveryId: string) {
  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("id,stripe_payment_intent,refund_jobs")
    .eq("delivery_id", deliveryId)
    .eq("payment_method", "stripe")
    .maybeSingle();
  if (error) throw error;
  if (!payment) return;
  const stripe = getStripe();
  for (const job of payment.refund_jobs ?? []) {
    if (
      job.state === "succeeded" ||
      job.state === "failed" ||
      job.state === "canceled"
    )
      continue;
    let refund: Stripe.Refund | undefined;
    if (job.stripe_refund_id)
      refund = await stripe.refunds.retrieve(job.stripe_refund_id);
    else {
      // Recover an API-success/database-failure even after Stripe's idempotency retention.
      for await (const existing of stripe.refunds.list({
        payment_intent: payment.stripe_payment_intent,
        limit: 100,
      })) {
        if (existing.metadata?.operation === `${payment.id}:${job.key}`) {
          refund = existing;
          break;
        }
      }
      refund ??= await stripe.refunds.create(
        {
          payment_intent: payment.stripe_payment_intent,
          amount: Math.round(Number(job.amount) * 100),
          metadata: { operation: `${payment.id}:${job.key}` },
        },
        { idempotencyKey: `refund:${payment.id}:${job.key}` },
      );
    }
    const { error: recordError } = await admin.rpc("record_order_refund", {
      p_payment_id: payment.id,
      p_key: job.key,
      p_refund_id: refund.id,
      p_state: refund.status ?? "pending",
    });
    if (recordError) throw recordError;
  }
}

export async function reconcileStripeRefund(refund: Stripe.Refund) {
  const operation = refund.metadata?.operation;
  if (!operation) return;
  const split = operation.indexOf(":");
  if (split < 1) return;
  const id = operation.slice(0, split),
    key = operation.slice(split + 1);
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("stripe_payment_intent,refund_jobs")
    .eq("id", id)
    .eq("payment_method", "stripe")
    .maybeSingle();
  const intent =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;
  const job = payment?.refund_jobs?.find((j: { key: string }) => j.key === key);
  if (
    !job ||
    payment?.stripe_payment_intent !== intent ||
    Math.round(Number(job.amount) * 100) !== refund.amount
  )
    throw new Error("Refund does not match recorded request");
  const { error } = await admin.rpc("record_order_refund", {
    p_payment_id: id,
    p_key: key,
    p_refund_id: refund.id,
    p_state: refund.status ?? "pending",
  });
  if (error) throw error;
}

export async function reconcilePaymentProcessingFee(
  paymentId: string,
  intentId: string,
) {
  const intent = await getStripe().paymentIntents.retrieve(intentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") return false;
  const transaction = charge.balance_transaction;
  if (
    !transaction ||
    typeof transaction === "string" ||
    transaction.currency !== "gbp"
  )
    return false;
  const { error } = await createAdminClient()
    .from("payments")
    .update({ processing_fee: transaction.fee / 100 })
    .eq("id", paymentId)
    .eq("stripe_payment_intent", intentId);
  if (error) throw error;
  return true;
}
