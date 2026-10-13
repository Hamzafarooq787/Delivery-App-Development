"use client"

import { useState } from "react"
import { submitContactForm } from "./actions"

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const result = await submitContactForm({
      firstName: fd.get("firstName") as string,
      lastName:  fd.get("lastName")  as string,
      email:     fd.get("email")     as string,
      subject:   fd.get("subject")   as string,
      message:   fd.get("message")   as string,
    })

    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="lg:col-span-2 bg-[#1a1919] rounded-3xl p-6 sm:p-8 md:p-12 border border-[#494847]/15 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-emerald-400 text-3xl">check_circle</span>
        </div>
        <h2 className="text-2xl font-bold font-headline text-white mb-3">Signal Received</h2>
        <p className="text-[#adaaaa] text-sm max-w-sm">
          Your message has been transmitted. Our team will respond within 2 hours.
        </p>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2 bg-[#1a1919] rounded-3xl p-6 sm:p-8 md:p-12 border border-[#494847]/15">
      <h2 className="text-2xl font-bold font-headline mb-8">Transmit a Message</h2>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">First Name</label>
            <input
              name="firstName"
              type="text"
              required
              placeholder="Marcus"
              className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Last Name</label>
            <input
              name="lastName"
              type="text"
              required
              placeholder="Chen"
              className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Email Address</label>
          <input
            name="email"
            type="email"
            required
            placeholder="ops@yourcompany.com"
            className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Subject</label>
          <select
            name="subject"
            required
            className="w-full h-12 bg-black/40 border border-[#494847]/20 rounded-xl px-4 text-sm text-white outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-colors"
          >
            <option className="bg-[#1a1919]" value="">Select a topic...</option>
            <option className="bg-[#1a1919]">Enterprise Partnership</option>
            <option className="bg-[#1a1919]">Technical Support</option>
            <option className="bg-[#1a1919]">Billing Inquiry</option>
            <option className="bg-[#1a1919]">Damage Claim</option>
            <option className="bg-[#1a1919]">Custom Fleet Request</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-2">Message</label>
          <textarea
            name="message"
            rows={6}
            required
            placeholder="Describe your logistical requirements in detail. The more data you provide, the faster we can mobilize a response."
            className="w-full bg-black/40 border border-[#494847]/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#adaaaa]/40 outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-colors resize-none"
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs font-medium">{error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(var(--brand-rgb),0.2)] hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {pending ? "Transmitting…" : "Transmit Signal"}
        </button>
      </form>
    </div>
  )
}

