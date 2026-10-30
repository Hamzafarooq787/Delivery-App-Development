import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
function sign(value: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Quote signing unavailable')
  return createHmac('sha256', key).update(value).digest('hex')
}
export function issueQuoteConsent(userId: string, scope: unknown, amount: number) {
  const payload = Buffer.from(JSON.stringify({ userId, scope, amount, expires: Date.now() + 10 * 60 * 1000 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}
export function checkQuoteConsent(token: string | undefined, userId: string, scope: unknown, amount: number) {
  try {
    if (!token || token.length > 8000) return false
    const [payload, signature] = token.split('.')
    const expected = sign(payload)
    if (signature?.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false
    const quote = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return quote.userId === userId && quote.expires > Date.now() && quote.amount === amount && JSON.stringify(quote.scope) === JSON.stringify(scope)
  } catch { return false }
}
export function deliveryScope(p: { pickupLat: number; pickupLng: number; deliveryLat: number; deliveryLng: number; packageSize: string }) {
  return [p.pickupLat, p.pickupLng, p.deliveryLat, p.deliveryLng, p.packageSize]
}
