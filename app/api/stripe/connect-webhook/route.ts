import { getStripe } from "@/lib/stripe/server";
import { runBankPayouts } from "@/lib/payouts/worker";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Connect webhook not configured" }, { status: 503 });
  let event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret); }
  catch { return Response.json({ error: "Invalid signature" }, { status: 400 }); }
  const live = process.env.STRIPE_SECRET_KEY?.match(/^(sk|rk)_live_/) != null;
  if (event.livemode !== live || !event.account) return Response.json({ ignored: true });
  // Re-read provider objects under our stored account IDs. Event payloads never
  // directly set paid, amounts, recipients or ledger statuses.
  if (event.type === "payout.created" || event.type === "payout.updated" || event.type === "payout.paid" || event.type === "payout.failed" || event.type === "payout.canceled") {
    try {
      const id = event.data.object.metadata?.godrop_payout;
      if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return Response.json({ ignored: true });
      const result = await runBankPayouts(id);
      if (result.busy) return Response.json({ retry: true }, { status: 503 });
    } catch { return Response.json({ error: "Reconciliation failed" }, { status: 500 }); }
  }
  return Response.json({ received: true });
}
