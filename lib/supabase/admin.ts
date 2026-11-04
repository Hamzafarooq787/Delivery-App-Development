import { createClient } from "@supabase/supabase-js"

/**
 * Service-role client — bypasses RLS. Only use in server-side code (server
 * actions, route handlers). Never expose to the browser.
 */
export function createAdminClient(customFetch?: typeof fetch) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
  }
  return createClient(url, key, {
    ...(customFetch ? { global: { fetch: customFetch } } : {}),
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
