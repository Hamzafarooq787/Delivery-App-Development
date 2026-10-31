import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseOrderPhoto } from '@/lib/order-media'
export async function leaseOrderPhotos(userId:string,urls:unknown[]):Promise<boolean>{
 const paths:string[]=[]
 for(const url of urls){if(url==null||url==='')continue;const p=parseOrderPhoto(url);if(!p||p.path.split('/')[0]!==userId)return false;paths.push(p.path)}
 if(!paths.length)return true
 const {data,error}=await createAdminClient().rpc('lease_customer_photos',{p_user:userId,p_paths:[...new Set(paths)]})
 return !error&&data===true
}
