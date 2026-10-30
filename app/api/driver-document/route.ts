import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return new Response('Missing document', { status: 400 })
  const admin = createAdminClient()
  const { data: doc } = await admin.from('driver_documents').select('driver_id,file_url').eq('id', id).maybeSingle()
  if (!doc) return new Response('Not found', { status: 404 })
  if (doc.driver_id !== user.id) {
    const { data: caller } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
    if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })
  }
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
