/* Both assets stay mounted so the global CSS brand changes the logo instantly. */
export function BrandLogo() {
  return <span className="brand-logo" role="img" aria-label="GoDrop">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="brand-logo-purple" src="/images/godrop-logo-purple.webp" alt="" width="160" height="48" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="brand-logo-orange" src="/images/godrop-logo-orange.webp" alt="" width="160" height="48" />
  </span>
}
