import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { boundedFetch, shortRequest } from "@/lib/short-request"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirect = (path: string) => {
    const destination = new URL(path, url.origin)
    // Prevent a browser inheriting an implicit-flow token fragment.
    destination.hash = "_"
    return new Response(null, { status: 303, headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    } })
  }
  if (url.searchParams.has("error") || url.searchParams.has("error_code")) return redirect("/login?confirmation=expired")

  const token = url.searchParams.get("token_hash")
  if (token) {
    if (url.searchParams.get("type") !== "email" || !/^[a-zA-Z0-9_-]{20,256}$/.test(token)) return redirect("/login?confirmation=expired")
    try {
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { fetch: boundedFetch(8000) },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await shortRequest(client.auth.verifyOtp({ token_hash: token, type: "email" }), 8500)
      if (!error && data.user?.email_confirmed_at) return redirect("/login?confirmation=confirmed")
      if (error?.status && error.status < 500 && error.status !== 429) return redirect("/login?confirmation=expired")
    } catch { /* Verification may have succeeded before the connection failed. */ }
    return redirect("/login?confirmation=check")
  }

  // The standard Supabase email verifies the address before redirecting.
  // A PKCE code is not needed to sign in with the account password.
  // Neither this code nor the confirmation banner grants access.
  if (url.searchParams.has("code")) return redirect("/login?confirmation=confirmed")

  // The default resend flow reports its result in the fragment. Inspect it
  // on this isolated page and discard it without sending tokens anywhere.
  const relay = 'const h=new URLSearchParams(location.hash.slice(1));location.replace("/login?confirmation="+(h.has("error")||h.has("error_code")?"expired":h.has("access_token")?"confirmed":"check")+"#_");'
  const hash = createHash("sha256").update(relay).digest("base64")
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>GoDrop email confirmation</title><script>${relay}</script><p><a href="/login?confirmation=check#_">Continue to GoDrop sign-in</a></p></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; script-src 'sha256-${hash}'; base-uri 'none'; frame-ancestors 'none'`,
    },
  })
}
