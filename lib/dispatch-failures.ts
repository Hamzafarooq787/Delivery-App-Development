import 'server-only'
import {createHash,randomUUID} from 'node:crypto'
import {createAdminClient} from '@/lib/supabase/admin'
export async function recordDispatchFailure(channel:'push'|'email',userId:string|null,payload:Record<string,unknown>,deliveryKey?:string){try{const key=deliveryKey??randomUUID();const dispatchKey=createHash('sha256').update(`${channel}:${userId??''}:${key}`).digest('hex');await createAdminClient().from('integration_dispatches').upsert({channel,user_id:userId,payload,dispatch_key:dispatchKey,state:'failed',updated_at:new Date().toISOString()},{onConflict:'dispatch_key'})}catch{console.error('[dispatch] Failure recording unavailable')}}
