export function QuoteLock({ expiresAt }: { expiresAt: number }) {
  const expiry = new Date(expiresAt)
  return <p className="text-xs">Price locked for 10 minutes · expires at <time dateTime={expiry.toISOString()}>{expiry.toLocaleTimeString('en-GB', { timeZone: 'Europe/London' })} UK time</time>. Checkout uses this exact total.</p>
}
