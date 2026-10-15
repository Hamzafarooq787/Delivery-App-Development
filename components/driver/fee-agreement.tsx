'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getLaunchSettings } from '@/app/actions/launch-settings'
import type { LaunchSettings } from '@/lib/launch-pricing'
export function FeeAgreement() {
  const [settings, setSettings] = useState<LaunchSettings | null>(null)
  useEffect(() => {
    getLaunchSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])
  return (
    <p className="text-sm text-white">
      {settings
        ? `Current standard split: ${100 - settings.commissionPercent}% driver / ${settings.commissionPercent}% GoDrop, on delivery and shopping service fees only. Minimum payments: £${settings.minimumDriverDelivery.toFixed(2)} delivery, £${settings.minimumDriverShopping.toFixed(2)} shopping. Minimums may increase your amount and reduce GoDrop's share. Weekly payments. `
        : 'Loading the current driver fee arrangement. '}
      Shopping purchase funds are excluded. The offer and earnings statement
      show your actual payment.{' '}
      <Link
        className="text-[var(--color-secondary)] underline"
        href="/driver-agreement"
      >
        Read the driver fee agreement
      </Link>
      .
    </p>
  )
}
