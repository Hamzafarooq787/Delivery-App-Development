'use server'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {parseOrderPhoto} from '@/lib/order-media'
export async function cleanupAbandonedOrderPhotos(urls:string[],sweep=false){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return
 const admin=createAdminClient(),bucket=admin.storage.from('delivery-item-photos')
 const candidates=new Map<string,string>()
 for(const url of Array.isArray(urls)?urls.slice(0,100):[]){const p=parseOrderPhoto(url);if(p&&p.path.split('/')[0]===user.id)candidates.set(p.path,p.url)}
 if(sweep){
   const prefix=bucket.getPublicUrl('').data.publicUrl.replace(/\/?$/,'/')
   const {data,error}=await admin.rpc('claim_abandoned_customer_photos',{p_user:user.id,p_prefix:prefix})
   if(!error&&Array.isArray(data)&&data.length){const removed=await bucket.remove(data);if(removed.error)console.error('[Photo cleanup] Could not remove claimed item photos')}
 }
 for(const [path,url]of candidates){
 // Only item-upload folders are eligible. Receipts and replacement evidence are never swept.
 const parts=path.split('/');if(!(parts.length===2||(parts.length===3&&parts[1]==='bfm-items')))continue
 const {data,error}=await admin.rpc('claim_abandoned_customer_photo',{p_user:user.id,p_path:path,p_url:url,p_min_age_hours:sweep?48:0})
 if(!error&&data===true){const removed=await bucket.remove([path]);if(removed.error)console.error('[Photo cleanup] Could not remove claimed item photo')}
 }
}
