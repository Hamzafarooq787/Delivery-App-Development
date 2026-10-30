import { runBankPayouts } from "@/lib/payouts/worker";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });
  try { return Response.json(await runBankPayouts()); }
  catch { return Response.json({ error: "Bank payout reconciliation unavailable" }, { status: 500 }); }
}
