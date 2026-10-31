import {recordHealth} from "@/lib/integration-health"
import { createAdminClient } from "@/lib/supabase/admin";
export const maxDuration = 60;
// Reserve earnings; the separate 08:30 daily bank worker handles provider operations.
async function run(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  let offset = 0,
    reserved = 0;
  while (true) {
    const { data, error } = await db
      .from("driver_profiles")
      .select("id")
      .eq("status", "approved")
      .order("id")
      .range(offset, offset + 99);
    if (error)
      return Response.json(
        { error: "Unable to read drivers" },
        { status: 500 },
      );
    for (const driver of data ?? []) {
      const r = await db.rpc("reserve_driver_payout", { p_driver: driver.id });
      if (r.error)
        return Response.json(
          { error: "Payout reservation failed", reserved },
          { status: 500 },
        );
      if (r.data?.id) reserved++;
    }
    if (!data || data.length < 100) break;
    offset += 100;
  }
  return Response.json({ reserved, bankTransfersSent: 0 });
}

export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return new Response('Unauthorized',{status:401})
 try{const response=await run(request);await recordHealth("cron_weekly_payouts",response.ok,`HTTP ${response.status}`);return response}catch{await recordHealth("cron_weekly_payouts",false,'Run failed; check the operational queue and logs');return Response.json({error:'Scheduled processing failed'},{status:500})}
}
