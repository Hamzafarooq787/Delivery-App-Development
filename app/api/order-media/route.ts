import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseOrderPhoto } from '@/lib/order-media'
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'Referrer-Policy': 'no-referrer' }
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401, headers })
    const photo = parseOrderPhoto(new URL(request.url).searchParams.get('url'))
    if (!photo) return new Response('Invalid image', { status: 400, headers })
    const db = createAdminClient()
    if (photo.path.split('/')[0] !== user.id) {
      const { data: allowed, error } = await db.rpc('can_read_order_photo', { p_user: user.id, p_url: photo.url })
      if (error || allowed !== true) return new Response('Not found', { status: 404, headers })
    }
    const { data, error } = await db.storage.from('delivery-item-photos').createSignedUrl(photo.path, 60)
    if (error || !data?.signedUrl) return new Response('Image unavailable', { status: 404, headers })
    return new Response(null, { status: 302, headers: { ...headers, Location: data.signedUrl } })
  } catch { return new Response('Image unavailable', { status: 503, headers }) }
}
