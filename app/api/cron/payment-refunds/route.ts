import { createAdminClient } from "@/lib/supabase/admin";
import {
  processOrderRefunds,
  reconcilePaymentProcessingFee,
} from "@/lib/payments/direct";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response("Unauthorized", { status: 401 });
  const { data, error } = await createAdminClient().rpc(
    "pending_card_refund_orders",
  );
  if (error)
    return Response.json(
      { error: "Refund queue unavailable" },
      { status: 500 },
    );
  let processed = 0,
    failed = 0;
  for (const row of data ?? []) {
    try {
      await processOrderRefunds(row.delivery_id);
      processed++;
    } catch {
      failed++;
    } finally {
      await createAdminClient()
        .from("payments")
        .update({ refund_checked_at: new Date().toISOString() })
        .eq("delivery_id", row.delivery_id)
        .eq("payment_method", "stripe");
    }
    if (processed + failed >= 20) break;
  }
  const { data: unreconciled } = await createAdminClient()
    .from("payments")
    .select("id,stripe_payment_intent")
    .eq("payment_method", "stripe")
    .eq("status", "paid")
    .is("processing_fee", null)
    .not("stripe_payment_intent", "is", null)
    .limit(20);
  let feesUpdated = 0;
  for (const payment of unreconciled ?? []) {
    try {
      if (
        await reconcilePaymentProcessingFee(
          payment.id,
          payment.stripe_payment_intent,
        )
      )
        feesUpdated++;
    } catch {
      failed++;
    }
  }
  return Response.json(
    { processed, failed, feesUpdated },
    { status: failed ? 500 : 200 },
  );
}
