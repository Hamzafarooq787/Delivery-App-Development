/** Stored URLs remain stable references. Display them through authenticated access. */
export function parseOrderPhoto(value: unknown, base = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    if (typeof value !== 'string' || !base) return null
    const url = new URL(value), origin = new URL(base).origin
    const prefix = '/storage/v1/object/public/delivery-item-photos/'
    if (url.origin !== origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!path || path.split('/').some(part => !part || part === '.' || part === '..') || path.includes('\\')) return null
    return { path, url: `${origin}${prefix}${url.pathname.slice(prefix.length)}` }
  } catch { return null }
}
export function ownsOrderPhoto(value: unknown, userId: string) {
  if (value == null || value === '') return true
  const photo = parseOrderPhoto(value)
  return !!photo && photo.path.split('/')[0] === userId
}
export function orderMediaUrl(value: string) {
  return parseOrderPhoto(value) ? `/api/order-media?url=${encodeURIComponent(value)}` : value
}
