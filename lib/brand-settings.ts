import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_BRAND, isBrandTheme, type BrandTheme } from '@/lib/brand-theme'
// Private storage: no client upload policies. Only the authenticated admin
// route writes this small global configuration with server credentials.
const BUCKET = 'godrop-brand-settings'
const FILE = 'theme.json'
export async function readBrandTheme(): Promise<BrandTheme> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(FILE)
  if (error) {
    if (['404', '400'].includes(String(error.statusCode))) return DEFAULT_BRAND
    throw new Error('Could not load the shared theme')
  }
  const config = JSON.parse(await data.text())
  return isBrandTheme(config.brand) ? config.brand : DEFAULT_BRAND
}
export async function writeBrandTheme(brand: BrandTheme, userId: string) {
  const admin = createAdminClient()
  const { data: bucket } = await admin.storage.getBucket(BUCKET)
  if (!bucket) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: false, fileSizeLimit: 4096, allowedMimeTypes: ['application/json'],
    })
    // Another admin may have created the bucket concurrently.
    if (error && !/already exists|duplicate/i.test(error.message)) throw new Error('Could not prepare theme storage')
  } else if (bucket.public) {
    throw new Error('Theme storage must be private')
  }
  const { error } = await admin.storage.from(BUCKET).upload(FILE,
    JSON.stringify({ brand, updatedAt: new Date().toISOString(), updatedBy: userId }),
    { upsert: true, contentType: 'application/json', cacheControl: '0' })
  if (error) throw new Error('Could not save the shared theme')
  // Verify persistence before reporting success.
  if (await readBrandTheme() !== brand) throw new Error('Theme save could not be verified')
}
