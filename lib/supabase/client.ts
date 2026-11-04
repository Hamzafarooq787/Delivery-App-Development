import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {realtime:{timeout:5000,reconnectAfterMs:(tries:number)=>Math.min(30000,1000*2**Math.min(tries,5))+Math.floor(Math.random()*500)}},
  )
}
