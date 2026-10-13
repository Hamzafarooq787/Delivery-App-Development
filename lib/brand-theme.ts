export type BrandTheme = 'purple' | 'orange'
export function isBrandTheme(value: unknown): value is BrandTheme {
  return value === 'purple' || value === 'orange'
}
export const DEFAULT_BRAND: BrandTheme = 'orange'
