import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Supabase stores the session as a JSON object in the cookie.
  // The cookie name is: sb-<project-ref>-auth-token
  // For chunked sessions it may be split across .0 and .1 suffixes.
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] ?? ''

  let sessionJson: string | undefined

  // Try the single cookie first
  const singleCookie = cookieStore.get(`sb-${projectRef}-auth-token`)?.value
  if (singleCookie) {
    sessionJson = singleCookie
  } else {
    // Try chunked cookies
    const chunk0 = cookieStore.get(`sb-${projectRef}-auth-token.0`)?.value ?? ''
    const chunk1 = cookieStore.get(`sb-${projectRef}-auth-token.1`)?.value ?? ''
    if (chunk0) sessionJson = chunk0 + chunk1
  }

  let accessToken: string | undefined
  if (sessionJson) {
    try {
      const decoded = decodeURIComponent(sessionJson)
      const parsed = JSON.parse(decoded)
      // The session object has shape: { access_token, refresh_token, ... }
      accessToken = parsed?.access_token
    } catch {
      // cookie is malformed or not a session cookie — proceed unauthenticated
    }
  }

  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {},
      },
    },
  )

  return client
}
