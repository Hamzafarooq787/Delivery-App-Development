'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'
import { createClient } from '@/lib/supabase/client'
import { getMarketingConsent, updateMarketingConsent } from '@/app/actions/marketing'

const NOTIF_STORAGE_KEY = 'kv_notification_prefs'

type NotifPrefs = { email: boolean; sms: boolean; push: boolean }
const defaultNotifPrefs: NotifPrefs = { email: true, sms: true, push: false }

type MarketingPrefs = { email: boolean; push: boolean }

export default function SettingsPage() {
  const [showModal, setShowModal] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(defaultNotifPrefs)
  const [marketingPrefs, setMarketingPrefs] = useState<MarketingPrefs>({ email: false, push: false })
  const [marketingLoaded, setMarketingLoaded] = useState(false)
  const [savingMarketing, setSavingMarketing] = useState(false)
  const [marketingMessage, setMarketingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [initialFullName, setInitialFullName] = useState('')
  const [initialPhone, setInitialPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (cancelled) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data, error } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error('[v0] settings load error — code:', error.code, error.message)
        return
      }
      const nm = data?.full_name ?? ''
      const ph = data?.phone ?? ''
      setFullName(nm)
      setPhone(ph)
      setInitialFullName(nm)
      setInitialPhone(ph)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  // Load real marketing consent from the database
  useEffect(() => {
    let cancelled = false
    async function loadMarketing() {
      const { data } = await getMarketingConsent()
      if (cancelled || !data) return
      setMarketingPrefs({ email: data.marketing_email_opt_in, push: data.marketing_push_opt_in })
      setMarketingLoaded(true)
    }
    loadMarketing()
    return () => { cancelled = true }
  }, [])

  async function toggleMarketing(key: keyof MarketingPrefs) {
    if (savingMarketing) return
    const next = { ...marketingPrefs, [key]: !marketingPrefs[key] }
    setMarketingPrefs(next)
    setSavingMarketing(true)
    setMarketingMessage(null)
    const { error } = await updateMarketingConsent({ emailOptIn: next.email, pushOptIn: next.push })
    setSavingMarketing(false)
    if (error) {
      setMarketingPrefs(marketingPrefs) // revert on failure
      setMarketingMessage({ type: 'error', text: error })
      return
    }
    setMarketingMessage({ type: 'success', text: 'Preferences saved.' })
  }

  // Load saved notification prefs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setNotifPrefs({
          email: typeof parsed.email === 'boolean' ? parsed.email : defaultNotifPrefs.email,
          sms: typeof parsed.sms === 'boolean' ? parsed.sms : defaultNotifPrefs.sms,
          push: typeof parsed.push === 'boolean' ? parsed.push : defaultNotifPrefs.push,
        })
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function handleSaveProfile() {
    if (!userId || saving) return
    setSaving(true)
    setSaveMessage(null)
    const { data: updated, error } = await supabase
      .from('users')
      .update({ full_name: fullName, phone })
      .eq('id', userId)
      .select('full_name, phone')
      .single()
    setSaving(false)
    if (error) {
      console.error('[v0] settings save error — code:', error.code, error.message)
      // PGRST116 = 0 rows matched — RLS is blocking the update
      const msg = error.code === 'PGRST116'
        ? 'Save blocked — RLS policy missing. Run the SQL fix in your Supabase dashboard.'
        : error.message || 'Failed to save profile.'
      setSaveMessage({ type: 'error', text: msg })
      return
    }
    setFullName(updated.full_name ?? fullName)
    setPhone(updated.phone ?? phone)
    setInitialFullName(updated.full_name ?? fullName)
    setInitialPhone(updated.phone ?? phone)
    setSaveMessage({ type: 'success', text: 'Profile updated successfully.' })
  }

  function handleDiscardProfile() {
    setFullName(initialFullName)
    setPhone(initialPhone)
    setSaveMessage(null)
  }

  async function handleChangePassword() {
    if (savingPassword) return
    setPasswordMessage(null)
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      console.error('[v0] password update error', error)
      setPasswordMessage({ type: 'error', text: error.message || 'Failed to update password.' })
      return
    }
    setPasswordMessage({ type: 'success', text: 'Password updated.' })
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordForm(false)
  }

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 pb-28 md:pb-8 md:ml-64 min-h-screen bg-surface-container-low">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-12">
          {/* Page Header */}
          <div className="mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter mb-2 text-on-surface">
              Settings
            </h2>
            <p className="text-on-surface-variant max-w-2xl text-sm">
              Manage your profile, security, and notification preferences.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Profile + Security (left) */}
            <section className="col-span-12 lg:col-span-7 space-y-6">
              {/* Profile Section */}
              <div className="glass-card border border-outline-variant/15 rounded-xl p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <span className="material-symbols-outlined text-primary">account_circle</span>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Profile</h3>
                </div>
                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveProfile() }}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                      Full Name
                    </label>
                    <input
                      className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                      Email Address
                    </label>
                    <input
                      className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm outline-none text-on-surface-variant disabled:opacity-70"
                      type="email"
                      value={email}
                      readOnly
                      disabled
                    />
                    <p className="text-[10px] text-on-surface-variant ml-1">
                      Email is managed by your sign-in provider.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                      Phone Number
                    </label>
                    <input
                      className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                    />
                  </div>
                  <div className="pt-4 flex justify-end items-center gap-4 flex-wrap">
                    {saveMessage && (
                      <span className={`text-xs font-medium ${saveMessage.type === 'success' ? 'text-primary' : 'text-error'}`}>
                        {saveMessage.text}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleDiscardProfile}
                      disabled={saving}
                      className="px-6 py-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors rounded-lg text-sm font-bold border border-outline-variant/15 disabled:opacity-60"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !userId}
                      className="px-8 py-2 bg-primary text-on-primary hover:brightness-110 transition-colors rounded-lg text-sm font-extrabold shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)] disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Update Profile'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Security Section */}
              <div className="glass-card border border-outline-variant/15 rounded-xl p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <span className="material-symbols-outlined text-primary">security</span>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Security</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-surface-container-low/50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex space-x-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-primary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            lock
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold mb-1 text-on-surface">Account Password</p>
                          <p className="text-xs text-on-surface-variant">
                            Use a strong, unique password with at least 8 characters.
                          </p>
                        </div>
                      </div>
                      {!showPasswordForm && (
                        <button
                          type="button"
                          onClick={() => { setShowPasswordForm(true); setPasswordMessage(null) }}
                          className="px-4 py-2 bg-surface-container-highest hover:bg-surface-bright text-on-surface text-xs font-bold rounded-lg transition-colors border border-outline-variant/20 whitespace-nowrap"
                        >
                          Change Password
                        </button>
                      )}
                    </div>

                    {showPasswordForm && (
                      <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                            New Password
                          </label>
                          <input
                            className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                            Confirm Password
                          </label>
                          <input
                            className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-3 flex-wrap">
                          {passwordMessage && (
                            <span className={`text-xs font-medium ${passwordMessage.type === 'success' ? 'text-primary' : 'text-error'}`}>
                              {passwordMessage.text}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setShowPasswordForm(false)
                              setNewPassword('')
                              setConfirmPassword('')
                              setPasswordMessage(null)
                            }}
                            disabled={savingPassword}
                            className="px-4 py-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors rounded-lg text-xs font-bold border border-outline-variant/15 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={savingPassword}
                            className="px-6 py-2 bg-primary text-on-primary hover:brightness-110 transition-colors rounded-lg text-xs font-bold disabled:opacity-60"
                          >
                            {savingPassword ? 'Saving...' : 'Save Password'}
                          </button>
                        </div>
                      </div>
                    )}

                    {!showPasswordForm && passwordMessage?.type === 'success' && (
                      <p className="mt-4 text-xs text-primary">{passwordMessage.text}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Notifications (right) */}
            <section className="col-span-12 lg:col-span-5 space-y-6">
              <div className="glass-card border border-outline-variant/15 rounded-xl p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <span className="material-symbols-outlined text-secondary">notifications_active</span>
                  <h3 className="text-xl font-bold font-headline text-on-surface">
                    Notifications
                  </h3>
                </div>
                <div className="space-y-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                    Delivery alerts
                  </p>

                  {([
                    {
                      key: 'email' as const,
                      label: 'Email Alerts',
                      desc: 'Receive delivery updates and receipts via email.',
                    },
                    {
                      key: 'sms' as const,
                      label: 'SMS Alerts',
                      desc: 'Get text messages for status changes on your deliveries.',
                    },
                    {
                      key: 'push' as const,
                      label: 'Push Notifications',
                      desc: 'Real-time browser notifications when your driver moves.',
                    },
                  ]).map((toggle, idx) => (
                    <div key={toggle.key}>
                      {idx > 0 && <div className="h-px bg-outline-variant/10 mb-6" />}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                          <p className="text-sm font-medium text-on-surface">{toggle.label}</p>
                          <p className="text-xs text-on-surface-variant">{toggle.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleNotif(toggle.key)}
                          aria-pressed={notifPrefs[toggle.key]}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                            notifPrefs[toggle.key] ? 'bg-primary' : 'bg-surface-container-highest'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                              notifPrefs[toggle.key] ? 'right-0.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-on-surface-variant mt-2">
                    Preferences are saved on this device.
                  </p>
                </div>
              </div>

              <div className="glass-card border border-outline-variant/15 rounded-xl p-8">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="material-symbols-outlined text-secondary">campaign</span>
                  <h3 className="text-xl font-bold font-headline text-on-surface">
                    Marketing Preferences
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant mb-6">
                  Promotional offers, discount codes, and reminders to come back. Off by default — opt in anytime.
                </p>
                <div className="space-y-6">
                  {([
                    { key: 'email' as const, label: 'Marketing Emails', desc: 'Promotions, discount codes, and updates by email.' },
                    { key: 'push' as const, label: 'Marketing Push', desc: 'Promotions and reminders as push notifications.' },
                  ]).map((toggle, idx) => (
                    <div key={toggle.key}>
                      {idx > 0 && <div className="h-px bg-outline-variant/10 mb-6" />}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                          <p className="text-sm font-medium text-on-surface">{toggle.label}</p>
                          <p className="text-xs text-on-surface-variant">{toggle.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleMarketing(toggle.key)}
                          disabled={!marketingLoaded || savingMarketing}
                          aria-pressed={marketingPrefs[toggle.key]}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                            marketingPrefs[toggle.key] ? 'bg-primary' : 'bg-surface-container-highest'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                              marketingPrefs[toggle.key] ? 'right-0.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                  {marketingMessage && (
                    <p className={`text-xs font-medium ${marketingMessage.type === 'success' ? 'text-primary' : 'text-error'}`}>
                      {marketingMessage.text}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}

