import {recordHealth} from "@/lib/integration-health"
import { runBankPayouts } from "@/lib/payouts/worker";
export const maxDuration = 60;
async function run(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });
  try { return Response.json(await runBankPayouts()); }
  catch { return Response.json({ error: "Bank payout reconciliation unavailable" }, { status: 500 }); }
}

export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return new Response('Unauthorized',{status:401})
 try{const response=await run(request);await recordHealth("cron_bank_payouts",response.ok,`HTTP ${response.status}`);return response}catch{await recordHealth("cron_bank_payouts",false,'Run failed; check the operational queue and logs');return Response.json({error:'Scheduled processing failed'},{status:500})}
}
