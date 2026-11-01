import {getAdminActor} from '@/lib/admin-access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const search = new URL(request.url).searchParams
  const id = search.get('id'), kind = search.get('kind')
  if (!id || !['pickup','delivery'].includes(kind ?? '')) return new Response('Invalid proof', { status: 400 })
  const admin = createAdminClient()
  const actorProfile=await admin.from('users').select('role,account_status').eq('id',user.id).maybeSingle()
  if(actorProfile.error||actorProfile.data?.account_status!=='active')return new Response('Forbidden',{status:403})
  if(actorProfile.data.role==='admin'){const actor=await getAdminActor('any');if(!actor||!actor.owner&&!['operations', 'support'].some(scope=>actor.scopes.includes(scope)))return new Response('Forbidden',{status:403})}

  const { data: order } = await admin.from('delivery_requests').select('customer_id,driver_id,parcel_image_url,delivered_image_url').eq('id',id).maybeSingle()
  if (!order) return new Response('Not found', { status: 404 })
  if (user.id !== order.customer_id && user.id !== order.driver_id) {
    const { data: caller } = await admin.from('users').select('role').eq('id',user.id).maybeSingle()
    if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })
  }
  const value = kind === 'pickup' ? order.parcel_image_url : order.delivered_image_url
  try {
    const url = new URL(value ?? '')
    const prefix = '/storage/v1/object/public/driver-documents/'
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || !url.pathname.startsWith(prefix)) throw new Error('Invalid object')
    const path = decodeURIComponent(url.pathname.slice(prefix.length))
    const proofPrefix = `${order.driver_id}/${kind === 'pickup' ? 'parcel' : 'delivered'}-${id}-`
    if (!path.startsWith(proofPrefix)) throw new Error('Invalid proof association')
    const { data, error } = await admin.storage.from('driver-documents').createSignedUrl(path,60)
    if (error || !data?.signedUrl) throw new Error('Unavailable')
    return new Response(null,{status:302,headers:{Location:data.signedUrl,'Cache-Control':'private, no-store'}})
  } catch { return new Response('Proof unavailable',{status:404}) }
}
