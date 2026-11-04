import { signUp } from "@/app/actions/auth"
import { signupEmailRequested } from "@/lib/signup-email"
import { shortRequest } from "@/lib/short-request"

export async function POST(request: Request) {
  const response = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } })
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return response({ error: "Please open GoDrop directly and try again." }, 403)
  }
  try {
    const result = await shortRequest((async () => signUp(await request.formData()))(), 11500)
    return response(result, !result.success ? 400 : "delivery" in result ? 202 : 200)
  } catch {
    return response(signupEmailRequested, 202)
  }
}
