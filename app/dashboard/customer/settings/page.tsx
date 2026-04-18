'use client'

import { useState } from 'react'
import Header from '@/components/customer/Header'
import NewDeliveryModal from '@/components/customer/NewDeliveryModal'

export default function SettingsPage() {
  const [showModal, setShowModal] = useState(false)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)

  return (
    <>
      <Header onNewDelivery={() => setShowModal(true)} />
      <main className="pt-16 md:ml-64 min-h-screen bg-surface-container-low">
        <div className="max-w-5xl mx-auto px-8 py-12">
          {/* Page Header */}
          <div className="mb-12">
            <h2 className="text-4xl font-extrabold font-headline tracking-tighter mb-2 text-on-surface">
              Settings
            </h2>
            <p className="text-on-surface-variant max-w-2xl text-sm">
              Configure your operational environment and security protocols for Kinetic Logistics OS.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Profile + Security (left) */}
            <section className="col-span-12 lg:col-span-7 space-y-6">
              {/* Profile Section */}
              <div className="glass-card border border-outline-variant/15 rounded-xl p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <span className="material-symbols-outlined text-primary">account_circle</span>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Profile Section</h3>
                </div>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                        Full Name
                      </label>
                      <input
                        className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                        type="text"
                        defaultValue="Alexander Sterling"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                        Job Title
                      </label>
                      <input
                        className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                        type="text"
                        defaultValue="Chief Dispatcher"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                      Email Address
                    </label>
                    <input
                      className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                      type="email"
                      defaultValue="a.sterling@kinetic-void.io"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                      Phone Number
                    </label>
                    <input
                      className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface"
                      type="tel"
                      defaultValue="+1 (555) 012-3456"
                    />
                  </div>
                  <div className="pt-4 flex justify-end gap-4">
                    <button
                      type="button"
                      className="px-6 py-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors rounded-lg text-sm font-bold border border-outline-variant/15"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      className="px-8 py-2 bg-primary text-on-primary hover:brightness-110 transition-colors rounded-lg text-sm font-extrabold shadow-[0_0_15px_rgba(163,166,255,0.2)]"
                    >
                      Update Profile
                    </button>
                  </div>
                </form>
              </div>

              {/* Security Section */}
              <div className="glass-card border border-outline-variant/15 rounded-xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <span className="material-symbols-outlined text-primary">security</span>
                    <h3 className="text-xl font-bold font-headline text-on-surface">Security Section</h3>
                  </div>
                  <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20">
                    ENCRYPTED
                  </span>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start justify-between p-4 bg-surface-container-low/50 rounded-xl">
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
                          Last updated 4 months ago. Use a strong, unique password.
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-surface-container-highest hover:bg-surface-bright text-on-surface text-xs font-bold rounded-lg transition-colors border border-outline-variant/20">
                      Change Password
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-primary/20 bg-primary/5 rounded-xl">
                    <div className="flex space-x-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">verified_user</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold mb-1 text-on-surface">
                          Two-Factor Authentication (2FA)
                        </p>
                        <p className="text-xs text-primary/80">Secured via Mobile Authenticator App.</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-primary">
                      <span className="text-xs font-bold">ACTIVE</span>
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    </div>
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
                    Notifications Section
                  </h3>
                </div>
                <div className="space-y-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                    Operational Alerts
                  </p>

                  {[
                    {
                      label: 'Email Alerts',
                      desc: 'Weekly logistics summaries and critical ship alerts.',
                      value: emailAlerts,
                      set: setEmailAlerts,
                    },
                    {
                      label: 'SMS Alerts',
                      desc: 'Immediate notification for high-priority dispatch delays.',
                      value: smsAlerts,
                      set: setSmsAlerts,
                    },
                    {
                      label: 'Push Notifications',
                      desc: 'Real-time status updates on active fleet units.',
                      value: pushNotifications,
                      set: setPushNotifications,
                    },
                  ].map((toggle, idx) => (
                    <div key={toggle.label}>
                      {idx > 0 && <div className="h-px bg-outline-variant/10 mb-6" />}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-on-surface">{toggle.label}</p>
                          <p className="text-xs text-on-surface-variant">{toggle.desc}</p>
                        </div>
                        <button
                          onClick={() => toggle.set(!toggle.value)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            toggle.value ? 'bg-primary' : 'bg-surface-container-highest'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                              toggle.value ? 'right-0.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="mt-8 p-6 bg-secondary/5 rounded-xl border border-secondary/10">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="material-symbols-outlined text-secondary text-sm">auto_awesome</span>
                      <p className="text-xs font-bold text-secondary tracking-widest">SMART FILTERING</p>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Our AI-driven &ldquo;Kinetic Calm&rdquo; protocol automatically mutes non-critical
                      alerts during your scheduled off-hours to prevent notification fatigue.
                    </p>
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="glass-card border border-outline-variant/15 rounded-xl p-8 relative overflow-hidden h-[180px]">
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-primary tracking-widest mb-1 uppercase">
                    System Health
                  </p>
                  <h4 className="text-2xl font-bold font-headline mb-4 text-on-surface">99.98% Uptime</h4>
                  <div className="flex items-end space-x-1 h-12">
                    {[20, 40, 30, 60, 100, 50, 80, 40, 90].map((h, i) => (
                      <div
                        key={i}
                        className="w-2 bg-primary rounded-t-sm"
                        style={{ height: `${h * 0.48}px`, opacity: h / 100 + 0.2 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              </div>
            </section>
          </div>

          {/* Danger Zone */}
          <div className="mt-12 glass-card border border-error-container/20 rounded-xl p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-error mb-1">Deactivate Account</h3>
                <p className="text-sm text-on-surface-variant">
                  Once deactivated, your access to Kinetic Void archives will be permanently revoked.
                </p>
              </div>
              <button className="px-6 py-2 border border-error-container text-error hover:bg-error-container/10 transition-colors rounded-lg text-xs font-bold">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} />}
    </>
  )
}
