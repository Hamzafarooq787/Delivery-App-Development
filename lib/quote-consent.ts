import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
function sign(value: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Quote signing unavailable')
  return createHmac('sha256', key).update(value).digest('hex')
}
export const QUOTE_TTL_MS=10*60*1000
export function issueQuoteConsent(userId: string, scope: unknown, amount: number, snapshot?:unknown) {
  const payload = Buffer.from(JSON.stringify({ userId, scope, amount, expires: Date.now() + QUOTE_TTL_MS, ...(snapshot?{snapshot}:{}) })).toString('base64url')
  return `${payload}.${sign(payload)}`
}
export function checkQuoteConsent(token: string | undefined, userId: string, scope: unknown, amount: number) {
  const quote=readQuoteConsent(token,userId,scope)
  return !!quote&&quote.amount===amount
}
export function readQuoteConsent<T=Record<string,unknown>>(token: string | undefined,userId:string,scope:unknown):{amount:number;expires:number;snapshot?:T}|null {
  try {
    if (!token || token.length > 8000) return null
    const parts=token.split('.')
    if(parts.length!==2)return null
    const [payload, signature] = parts
    const expected = sign(payload)
    if (signature?.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const quote = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return quote.userId === userId && quote.expires > Date.now() && Number.isFinite(quote.amount) && quote.amount>=0 && JSON.stringify(quote.scope) === JSON.stringify(scope)?quote:null
  } catch { return null }
}
export function deliveryScope(p: { pickupLat: number; pickupLng: number; deliveryLat: number; deliveryLng: number; packageSize: string;promoCode?:string|null;serviceType?:string }) {
  return [p.pickupLat, p.pickupLng, p.deliveryLat, p.deliveryLng, p.packageSize,(p.promoCode??"").trim().toUpperCase(),p.serviceType??"delivery"]
}
export function shoppingScope(p:{shop_lat:number;shop_lng:number;delivery_lat:number;delivery_lng:number;estimated_items_total?:number;promo_code?:string|null}){return [p.shop_lat,p.shop_lng,p.delivery_lat,p.delivery_lng,p.estimated_items_total??0,(p.promo_code??"").trim().toUpperCase()]}
