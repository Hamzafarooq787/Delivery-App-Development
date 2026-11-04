import {boundedFetch} from '@/lib/short-request'
import {getAdminActor} from '@/lib/admin-access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient(boundedFetch(3500))
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return new Response('Missing document', { status: 400 })
  const admin = createAdminClient(boundedFetch(3500))
  const [actorProfile,{data:doc}]=await Promise.all([
    admin.from('users').select('role,account_status').eq('id',user.id).maybeSingle(),
    admin.from('driver_documents').select('driver_id,file_url').eq('id',id).maybeSingle(),
  ])
  if(actorProfile.error||actorProfile.data?.account_status!=='active')return new Response('Forbidden',{status:403})
  if(actorProfile.data.role==='admin'){
    if(!await getAdminActor('operations'))return new Response('Forbidden',{status:403})
  } else if(doc?.driver_id!==user.id) return new Response('Not found',{status:404})
  if(!doc)return new Response('Not found',{status:404})
  let path: string
  try {
    const url = new URL(doc.file_url)
    const prefix = '/storage/v1/object/public/driver-documents/'
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || !url.pathname.startsWith(prefix)) throw new Error('Invalid object')
    path = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!path.startsWith(`${doc.driver_id}/`)) throw new Error('Invalid owner')
  } catch { return new Response('Invalid document reference', { status: 400 }) }
  const { data, error } = await admin.storage.from('driver-documents').createSignedUrl(path, 60)
  if (error || !data?.signedUrl) return new Response('Document unavailable', { status: 503 })
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store' } })
}
