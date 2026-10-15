import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_LAUNCH_SETTINGS,
  validateLaunchSettings,
  type LaunchSettings,
} from './launch-pricing'
const BUCKET = 'godrop-brand-settings',
  FILE = 'launch-pricing.json'
export async function readLaunchSettings(): Promise<LaunchSettings> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .download(FILE)
  if (error) {
    if (['400', '404'].includes(String(error.statusCode)))
      return { ...DEFAULT_LAUNCH_SETTINGS }
    throw new Error('Pricing settings unavailable')
  }
  return validateLaunchSettings(JSON.parse(await data.text()).settings)
}
export async function writeLaunchSettings(
  settings: LaunchSettings,
  userId: string,
) {
  const admin = createAdminClient()
  const { data: bucket, error: bucketError } =
    await admin.storage.getBucket(BUCKET)
  if (bucketError || !bucket || bucket.public)
    throw new Error('Private settings storage is unavailable')
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(
      FILE,
      JSON.stringify({
        settings,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      }),
      { upsert: true, contentType: 'application/json', cacheControl: '0' },
    )
  if (error) throw new Error('Could not save pricing settings')
  if (JSON.stringify(await readLaunchSettings()) !== JSON.stringify(settings))
    throw new Error('Pricing save could not be verified')
}
