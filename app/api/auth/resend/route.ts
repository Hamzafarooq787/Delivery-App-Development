import { createClient } from "@/lib/supabase/server"
import { getAppOrigin } from "@/lib/get-app-origin"
import { boundedFetch, shortRequest } from "@/lib/short-request"
import { signupEmailAddress } from "@/lib/signup-email"

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Please open GoDrop directly and try again." }, 403)
  try {
    return await shortRequest((async () => {
      const email = signupEmailAddress((await request.formData()).get("email"))
      if (!email) return reply({ error: "Enter a valid email address." }, 400)
      const client = await createClient(boundedFetch(8000))
      const origin = await getAppOrigin()
      const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/confirm` } })
      // Keep the same response for unknown, confirmed and unconfirmed accounts.
      if (error?.status && error.status >= 500) return reply({ error: "Email service is temporarily unavailable. Try again in a few minutes." }, 503)
      return reply({ success: true })
    })(), 9000)
  } catch {
    return reply({ error: "Email service is temporarily unavailable. Check your inbox, then try again in a few minutes." }, 503)
  }
}
