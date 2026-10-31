'use client'

import { saveCustomerProfile } from "@/app/actions/customer-repairs"
import {getServicePushPreference,saveServicePushPreference} from "@/app/actions/notification-preferences"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  ChevronRight,
  CircleHelp,
  LockKeyhole,
  LogOut,
  MapPin,
  UserRound,
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import {
  CustomerDialog,
  CustomerPage,
} from '@/components/customer/CustomerPage'
import styles from '@/components/customer/CustomerPages.module.css'
import { createClient } from '@/lib/supabase/client'
import {
  getMarketingConsent,
  updateMarketingConsent,
} from '@/app/actions/marketing'

const NOTIF_STORAGE_KEY = 'kv_notification_prefs'

type NotifPrefs = { email: boolean; sms: boolean; push: boolean }
const defaultNotifPrefs: NotifPrefs = { email: true, sms: true, push: false }

type MarketingPrefs = { email: boolean; push: boolean }

export default function SettingsPage() {
  const [section, setSection] = useState<
    'profile' | 'notifications' | 'security'
  >('profile')
  const [editing, setEditing] = useState<
    'profile' | 'notifications' | 'security' | null
  >(null)
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(defaultNotifPrefs)
  const [marketingPrefs, setMarketingPrefs] = useState<MarketingPrefs>({
    email: false,
    push: false,
  })
  const [marketingLoaded, setMarketingLoaded] = useState(false)
  const [savingMarketing, setSavingMarketing] = useState(false)
  const [marketingMessage, setMarketingMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const [profileLoading,setProfileLoading]=useState(true),[profileError,setProfileError]=useState(''),[profileRevision,setProfileRevision]=useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [initialFullName, setInitialFullName] = useState('')
  const [initialPhone, setInitialPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setProfileLoading(true);setProfileError('')
      try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in required')
      if (cancelled) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data, error } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) throw new Error('Profile unavailable')
      const nm = data?.full_name ?? ''
      const ph = data?.phone ?? ''
      setFullName(nm)
      setPhone(ph)
      setInitialFullName(nm)
      setInitialPhone(ph)
      } catch { if (!cancelled) setProfileError('Could not load your profile. Please try again.') } finally { if (!cancelled) setProfileLoading(false) }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase,profileRevision])

  // Load real marketing consent from the database
  useEffect(() => {
    let cancelled = false
    async function loadMarketing() {
      try {
      const { data,error } = await getMarketingConsent()
      if(error) throw new Error(error)
      if (cancelled || !data) return
      setMarketingPrefs({
        email: data.marketing_email_opt_in,
        push: data.marketing_push_opt_in,
      })
      setMarketingLoaded(true)
      } catch { if (!cancelled) setMarketingMessage({type:'error',text:'Could not load preferences. Please reload settings.'}) }
    }
    loadMarketing()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleMarketing(key: keyof MarketingPrefs) {
    if (savingMarketing) return
    const next = { ...marketingPrefs, [key]: !marketingPrefs[key] }
    setMarketingPrefs(next)
    setSavingMarketing(true)
    setMarketingMessage(null)
    try {
    const { error } = await updateMarketingConsent({
      emailOptIn: next.email,
      pushOptIn: next.push,
    })
    setSavingMarketing(false)
    if (error) {
      setMarketingPrefs(marketingPrefs) // revert on failure
      setMarketingMessage({ type: 'error', text: error })
      return
    }
    setMarketingMessage({ type: 'success', text: 'Preferences saved.' })
    } catch { setMarketingPrefs(marketingPrefs);setMarketingMessage({type:'error',text:'Could not save preferences. Please try again.'}) } finally { setSavingMarketing(false) }
  }

  useEffect(()=>{let alive=true;getServicePushPreference().then(r=>{if(!alive)return;if(r.error)setSaveMessage({type:'error',text:r.error});else setNotifPrefs({email:false,sms:false,push:r.enabled??true})}).catch(()=>{if(alive)setSaveMessage({type:'error',text:'Could not load notification preferences.'})});return()=>{alive=false}},[])
  async function toggleNotif(key:keyof NotifPrefs){
    if(key!=='push'||saving)return;setSaving(true);
    const next=!notifPrefs.push;let r;try{r=await saveServicePushPreference(next)}catch{r={error:'Unable to save preference'}}finally{setSaving(false)}
    if(r.error)setSaveMessage({type:'error',text:r.error});else setNotifPrefs(p=>({...p,push:next}));
  }

  async function handleSaveProfile() {
    if (!userId || saving || profileLoading || profileError) return
    setSaving(true);setSaveMessage(null)
    try {
      const r=await saveCustomerProfile(fullName,phone)
      if('error' in r){setSaveMessage({type:'error',text:r.error});return}
      const updated=r.data!;setFullName(updated.full_name);setPhone(updated.phone??'');setInitialFullName(updated.full_name);setInitialPhone(updated.phone??'');setSaveMessage({type:'success',text:'Profile updated successfully.'})
    }catch{setSaveMessage({type:'error',text:'Could not save your profile. Please try again.'})}finally{setSaving(false)}
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
      setPasswordMessage({
        type: 'error',
        text: 'Password must be at least 8 characters.',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSavingPassword(true)
    try {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      console.error('[v0] password update error', error)
      setPasswordMessage({
        type: 'error',
        text: error.message || 'Failed to update password.',
      })
      return
    }
    setPasswordMessage({ type: 'success', text: 'Password updated.' })
    setNewPassword('')
    setConfirmPassword('')
    setEditing(null)
    } catch { setPasswordMessage({type:'error',text:'Could not update your password. Please try again.'}) } finally { setSavingPassword(false) }
  }

  const profileForm = (
    <form
      className={styles.formPanel}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSaveProfile()
      }}
    >
      <h2>Profile details</h2>
      {profileLoading && <p role="status">Loading your profile…</p>}
      {profileError && <p role="alert" className={styles.error}>{profileError} <button type="button" onClick={()=>setProfileRevision(v=>v+1)}>Try again</button></p>}
      <label>
        Full name
        <input
          className={styles.input}
          type="text"
          autoComplete="name"
          required
          disabled={profileLoading || !!profileError}
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
        />
      </label>
      <label>
        Email address
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          value={email}
          readOnly
        />
      </label>
      <label>
        Phone number
        <input
          className={styles.input}
          type="tel"
          autoComplete="tel"
          maxLength={40}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Your phone number"
        />
      </label>
      {saveMessage && (
        <p
          role="status"
          className={
            saveMessage.type === 'error' ? styles.error : styles.message
          }
        >
          {saveMessage.text}
        </p>
      )}
      <div className={styles.formActions}>
        <button
          className={styles.primary}
          disabled={saving || !userId || profileLoading || !!profileError}
          type="submit"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={saving || profileLoading || !!profileError}
          onClick={handleDiscardProfile}
        >
          Discard
        </button>
      </div>
    </form>
  )
  const notificationForm = (
    <div className={styles.formPanel}>
      <h2>Notification preferences</h2>
      {saveMessage && <p role="status">{saveMessage.text}</p>}
      <p className={styles.muted} style={{ fontSize: 12 }}>
        Push preferences apply across your devices. Email and SMS delivery updates are not enabled.
      </p>
      {(['push'] as const).map((key) => (
        <div key={key} className={styles.switchRow}>
          <div>
            <strong>
              {String(key) === 'sms'
                ? 'SMS'
                : key === 'push'
                  ? 'Push notifications'
                  : 'Email'}
            </strong>
            <small>
              {key === 'push'
                ? 'Browser permission is also required'
                : 'Your saved preference on this device'}
            </small>
          </div>
          <button
            className={styles.switch}
            role="switch"
            aria-checked={notifPrefs[key]}
            aria-label={`${key} notifications`}
            disabled={saving}
            onClick={() => toggleNotif(key)}
          >
            <span />
          </button>
        </div>
      ))}
      <h3>Offers and promotions</h3>
      {(['email', 'push'] as const).map((key) => (
        <div className={styles.switchRow} key={key}>
          <div>
            <strong>{key === 'email' ? 'Email offers' : 'Push offers'}</strong>
            <small>Optional marketing updates</small>
          </div>
          <button
            className={styles.switch}
            role="switch"
            aria-checked={marketingPrefs[key]}
            aria-label={`Marketing ${key}`}
            disabled={savingMarketing || !marketingLoaded}
            onClick={() => void toggleMarketing(key)}
          >
            <span />
          </button>
        </div>
      ))}
      {marketingMessage && (
        <p
          className={
            marketingMessage.type === 'error' ? styles.error : styles.message
          }
          role="status"
        >
          {marketingMessage.text}
        </p>
      )}
    </div>
  )
  const passwordForm = (
    <form
      className={styles.formPanel}
      onSubmit={(e) => {
        e.preventDefault()
        void handleChangePassword()
      }}
    >
      <h2>Change password</h2>
      <p className={styles.muted} style={{ fontSize: 12 }}>
        Use at least eight characters.
      </p>
      <label>
        New password
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </label>
      {passwordMessage && (
        <p
          role="status"
          className={
            passwordMessage.type === 'error' ? styles.error : styles.message
          }
        >
          {passwordMessage.text}
        </p>
      )}
      <button
        className={styles.primary}
        disabled={savingPassword}
        type="submit"
      >
        {savingPassword ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
  const sections = [
    { key: 'profile' as const, label: 'Profile', icon: UserRound },
    { key: 'notifications' as const, label: 'Notifications', icon: Bell },
    { key: 'security' as const, label: 'Security', icon: LockKeyhole },
  ]
  return (
    <CustomerPage
      title="Your account"
      subtitle="Manage your personal details, notifications and security."
    >
      <div className={styles.settingsLayout}>
        <nav
          className={styles.settingsTabs}
          role="tablist"
          aria-label="Account settings"
        >
          {sections.map(({ key, label, icon: Icon }) => (
            <button
              role="tab"
              key={key}
              aria-selected={section === key}
              onClick={() => setSection(key)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <Link
            className={styles.textButton}
            href="/dashboard/customer/addresses"
          >
            <MapPin size={17} />
            Saved addresses
          </Link>
          <Link
            className={styles.textButton}
            href="/dashboard/customer/support"
          >
            <CircleHelp size={17} />
            Help & support
          </Link>
        </nav>
        <section className={`${styles.panel} ${styles.formPanel}`}>
          {section === 'profile'
            ? profileForm
            : section === 'notifications'
              ? notificationForm
              : passwordForm}
        </section>
        <aside className={styles.settingSide}>
          <div className={styles.panel}>
            <h2>Notification preferences</h2>
      {saveMessage && <p role="status">{saveMessage.text}</p>}
            <div className={styles.switchRow}>
              <div>
                <strong>Order updates</strong>
                <small>View your notification preferences</small>
              </div>
              <button
                className={styles.textButton}
                onClick={() => setSection('notifications')}
              >
                Manage
                <ChevronRight size={14} />
              </button>
            </div>
            <div className={styles.switchRow}>
              <div>
                <strong>Email offers</strong>
                <small>Offers and service updates</small>
              </div>
              <button
                className={styles.switch}
                role="switch"
                aria-checked={marketingPrefs.email}
                aria-label="Marketing email offers"
                disabled={savingMarketing || !marketingLoaded}
                onClick={() => void toggleMarketing('email')}
              >
                <span />
              </button>
            </div>
          </div>
          <div className={styles.panel}>
            <h2>Security</h2>
            <p style={{ marginTop: 10 }}>
              Manage your password and account access.
            </p>
            <button
              className={styles.secondary}
              style={{ marginTop: 14 }}
              onClick={() => setSection('security')}
            >
              <LockKeyhole size={16} />
              Change password
            </button>
          </div>
          <LogoutButton className={styles.danger}>
            <LogOut size={17} />
            Sign out
          </LogoutButton>
        </aside>
      </div>
      <div className={styles.settingsOverview}>
        <div className={`${styles.panel} ${styles.profileIdentity}`}>
          <span className={styles.avatar}>
            {fullName ? (
              fullName
                .split(/\s+/)
                .map((x) => x[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            ) : (
              <UserRound size={23} />
            )}
          </span>
          <div>
            <strong>{fullName || 'Your account'}</strong>
            <small>{email || 'Loading your details…'}</small>
          </div>
        </div>
        <div className={`${styles.panel} ${styles.accountLinks}`}>
          {sections.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setEditing(key)}>
              <Icon size={21} />
              {key === 'profile' ? 'Personal details' : label}
              <ChevronRight size={18} />
            </button>
          ))}
          <Link href="/dashboard/customer/support">
            <CircleHelp size={21} />
            Help & support
            <ChevronRight size={18} />
          </Link>
        </div>
        <div className={`${styles.panel} ${styles.accountLinks}`}>
          <Link href="/dashboard/customer/addresses">
            <MapPin size={21} />
            Saved addresses
            <ChevronRight size={18} />
          </Link>
        </div>
        <LogoutButton className={styles.danger}>
          <LogOut size={18} />
          Sign out
        </LogoutButton>
      </div>
      {editing && (
        <CustomerDialog
          title={
            editing === 'profile'
              ? 'Personal details'
              : editing === 'notifications'
                ? 'Notifications'
                : 'Security'
          }
          onClose={() => {
            if (!saving && !savingPassword) setEditing(null)
          }}
        >
          {editing === 'profile'
            ? profileForm
            : editing === 'notifications'
              ? notificationForm
              : passwordForm}
        </CustomerDialog>
      )}
    </CustomerPage>
  )
}
