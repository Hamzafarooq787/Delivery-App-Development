"use client"
import { useState } from 'react'
import { useBrand } from '@/components/shared/brand-provider'
import { BrandLogo } from '@/components/shared/brand-logo'
import type { BrandTheme } from '@/lib/brand-theme'
export function BrandThemePanel() {
  const { brand, loaded, apply } = useBrand()
  const [saving, setSaving] = useState<BrandTheme | null>(null)
  const [message, setMessage] = useState('')
  async function choose(next: BrandTheme) {
    setSaving(next); setMessage('')
    try {
      const response = await fetch('/api/brand-theme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand: next }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save theme')
      apply(next)
      setMessage(`${next === 'orange' ? 'Orange' : 'Purple'} theme applied across GoDrop.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save theme') }
    finally { setSaving(null) }
  }
  return <section className="rounded-2xl bg-[var(--brand-panel)] p-6 space-y-5">
    <h2 className="text-xl font-bold">App theme</h2>
    <p className="text-sm text-on-surface-variant">Choose one theme for the website, customer panel, driver panel and admin app. Colours, backgrounds and the logo change together.</p>
    <div className="grid sm:grid-cols-2 gap-4">
      {(['purple', 'orange'] as const).map(next => <button key={next} type="button" disabled={!!saving} onClick={() => choose(next)} aria-pressed={loaded && brand === next} className="brand-preview rounded-2xl border border-outline-variant p-5 text-left disabled:opacity-60" data-preview-brand={next}>
        <BrandLogo />
        <div className="my-5 flex gap-2" aria-hidden>{[next === 'purple' ? '#101112' : '#101214', next === 'purple' ? '#7957ff' : '#ff7900', next === 'purple' ? '#a99aff' : '#ffb168'].map(color => <span key={color} className="h-8 w-8 rounded-full" style={{ background: color }} />)}</div>
        <strong className="capitalize">{next}</strong><span className="ml-3 text-sm">{saving === next ? 'Applying…' : loaded && brand === next ? 'Active ✓' : 'Apply theme →'}</span>
      </button>)}
    </div>
    <p role="status" className="text-sm text-[var(--brand-soft)] min-h-5">{message}</p>
    <p className="text-xs text-on-surface-variant">Open sessions update within 15 seconds, or immediately when reopened.</p>
  </section>
}
