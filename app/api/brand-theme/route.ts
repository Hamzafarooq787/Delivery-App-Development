import {getAdminActor,auditAdmin} from "@/lib/admin-access"
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readBrandTheme, writeBrandTheme } from '@/lib/brand-settings'
import { isBrandTheme } from '@/lib/brand-theme'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    return Response.json({ brand: await readBrandTheme() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Theme is temporarily unavailable' }, { status: 503 })
  }
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid origin' }, { status: 403 })
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return Response.json({ error: 'Please sign in' }, { status: 401 })
    const { data: profile, error } = await createAdminClient().from('users').select('role').eq('id', user.id).maybeSingle()
    if (error || !(await getAdminActor('settings'))) return Response.json({ error: 'Admin access required' }, { status: 403 })
    const body = await request.json()
    if (!isBrandTheme(body.brand)) return Response.json({ error: 'Choose purple or orange' }, { status: 400 })
    await writeBrandTheme(body.brand, user.id)
    await auditAdmin(user.id,"brand_theme","settings",{brand:body.brand})
    return Response.json({ brand: body.brand })
  } catch {
    return Response.json({ error: 'Theme could not be saved. Please try again.' }, { status: 500 })
  }
}
