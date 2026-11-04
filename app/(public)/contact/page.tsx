import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { ContactForm } from "./contact-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contact | GoDrop",
  description: "Ask GoDrop about a collection, delivery or existing booking.",
}

export default async function ContactPage() {
  const {data,error} = await createAdminClient().from("surge_pricing_settings")
    .select("platform_settings").eq("id",true).maybeSingle()
  const config = error ? null : data?.platform_settings
  const email = typeof config?.email === "string" ? config.email.trim() : ""
  const phone = typeof config?.phone === "string" ? config.phone.trim() : ""
  const contacts = [
    {icon:"✉", title:"Email", value:email, href:`mailto:${email}`, valid:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)},
    {icon:"☎", title:"Phone", value:phone, href:`tel:${phone.replace(/[^+0-9]/g,"")}`, valid:/^\+?[0-9 ()-]{7,40}$/.test(phone)&&phone.replace(/\D/g,"").length>=7},
  ].filter(contact=>contact.valid)
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero */}
      <section className="relative w-full overflow-hidden pt-24 sm:pt-32 pb-12 sm:pb-16">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_center,rgba(var(--brand-rgb),0.06),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <span className="inline-block px-4 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold tracking-widest uppercase mb-6">
              GoDrop support
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-headline tracking-tighter mb-4 sm:mb-6 text-balance break-words">
              Contact <span className="text-[var(--color-primary)] italic">us</span>
            </h1>
            <p className="text-base sm:text-lg text-[#adaaaa] leading-relaxed">
              Need help with a collection or delivery? Send us a message. If you already have a booking, include your tracking number.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <ContactForm />

        {contacts.length > 0 && <div className="flex flex-col gap-4">
          {contacts.map(item => (
            <div key={item.title} className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/10 flex gap-5 items-start hover:border-[#494847]/25 transition-colors">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">{item.icon}</div>
              <div><p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-1">{item.title}</p>
                <a className="text-white font-semibold break-all" href={item.href}>{item.value}</a></div>
            </div>
          ))}
        </div>}
      </section>
    </div>
  )
}

