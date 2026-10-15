'use client'
import { useEffect, useState } from 'react'
import {
  getLaunchSettings,
  saveLaunchSettings,
} from '@/app/actions/launch-settings'
import {
  DEFAULT_LAUNCH_SETTINGS,
  type LaunchSettings,
} from '@/lib/launch-pricing'
const fields: [keyof LaunchSettings, string][] = [
  ['shoppingEstimateMinutes', 'Estimated shop time (minutes, never billed)'],
  ['baseFare', 'Minimum delivery price (£)'],
  ['includedMiles', 'Included driving miles'],
  ['perMile', 'Additional mile (£)'],
  ['shoppingFee', 'Fixed shopping service fee (£)'],
  ['maxProducts', 'Different products (maximum 5)'],
  ['maxShoppingValue', 'Shopping value (maximum £100)'],
  ['maxQuantityPerProduct', 'Maximum quantity per product'],
  ['maxShoppingWeightKg', 'Maximum shopping weight (kg)'],
  ['maxShoppingDimensionCm', 'Maximum item dimension (cm)'],
  ['commissionPercent', 'GoDrop commission (%)'],
  ['minimumDriverDelivery', 'Minimum driver delivery payment (£)'],
  ['minimumDriverShopping', 'Minimum driver shopping payment (£)'],
  ['freeWaitingMinutes', 'Free collection waiting minutes'],
  ['waitingPerMinute', 'Waiting charge per minute (£)'],
  ['vanCharge', 'Van surcharge (£)'],
  ['heavyCharge', 'Large/heavy surcharge (£)'],
  ['busyMultiplier', 'Busy-period multiplier'],
  ['weatherMultiplier', 'Weather multiplier'],
  ['areaLat', 'Service area centre latitude'],
  ['areaLng', 'Service area centre longitude'],
  ['areaRadiusMiles', 'Service area radius (miles)'],
]
export function LaunchPricingPanel() {
  const [settings, setSettings] = useState<LaunchSettings>(
      DEFAULT_LAUNCH_SETTINGS,
    ),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    getLaunchSettings()
      .then((v) => {
        if (active) {
          setSettings(v)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (active)
          setMessage('Could not load settings. Reload before making changes.')
      })
    return () => {
      active = false
    }
  }, [])
  return (
    <form
      className="rounded-xl bg-[#222] p-5 space-y-5 text-white"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          const r = await saveLaunchSettings(settings)
          setMessage(r.error ?? 'Settings saved and verified.')
        } catch {
          setMessage('Could not save settings.')
        } finally {
          setSaving(false)
        }
      }}
    >
      <h3 className="text-xl font-bold">Manchester launch pricing</h3>
      <p className="text-sm text-gray-200">
        Shopping is a fixed fee. Shopping time is never billed. Driver
        commission applies only to service fees. Minimums below are proposed
        launch values; review before enabling payments.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              className="mt-1 w-full rounded-lg border border-gray-500 bg-[#333] p-3 text-white"
              type="number"
              step="any"
              required
              value={settings[key] as number}
              disabled={!loaded || saving}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  [key]: e.target.value === '' ? NaN : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
        <label className="text-sm">
          Service area name
          <input
            className="mt-1 w-full rounded-lg border border-gray-500 bg-[#333] p-3"
            value={settings.areaName}
            onChange={(e) =>
              setSettings({ ...settings, areaName: e.target.value })
            }
          />
        </label>
      </div>
      <p className="text-sm text-gray-200">
        Collection waiting charges require a customer-approved quote after the
        first five minutes. No automatic Buy for Me time charge. Promotion
        controls remain in Marketing / Promotions. Existing busy-period schedule
        rules still apply.
      </p>
      {(['deliveryCheckoutEnabled', 'shoppingCheckoutEnabled'] as const).map(
        (key) => (
          <label className="flex items-center gap-3 text-sm" key={key}>
            <input
              type="checkbox"
              checked={settings[key]}
              disabled={!loaded || saving}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.checked })
              }
            />
            {key === 'deliveryCheckoutEnabled'
              ? 'Enable direct Stripe delivery checkout'
              : 'Enable direct Stripe shopping checkout (funded purchase cards required)'}
          </label>
        ),
      )}
      {message && (
        <p role="status" className="text-sm text-orange-200">
          {message}
        </p>
      )}
      <button
        className="rounded-xl bg-[var(--color-primary)] text-black px-5 py-3 font-bold disabled:opacity-40"
        disabled={!loaded || saving}
      >
        {saving ? 'Saving…' : 'Save pricing and limits'}
      </button>
    </form>
  )
}
