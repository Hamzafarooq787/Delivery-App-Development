import {createAdminClient} from '@/lib/supabase/admin'
const sent=new Map<string,{at:number;ok:boolean}>()
export async function recordHealth(key:string,ok:boolean,detail:string){const previous=sent.get(key);if(previous?.ok===ok&&Date.now()-previous.at<60000)return;try{const {error}=await createAdminClient().rpc('record_integration_health',{p_key:key,p_ok:ok,p_detail:detail});if(error)console.error('[health] Could not persist integration status',key);else sent.set(key,{at:Date.now(),ok})}catch{console.error('[health] Status recording unavailable',key)}}
