import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// React cache is request-scoped: never share authenticated users across requests.
export const getDashboardUser = cache(async () => {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error) return null
  return user
})
