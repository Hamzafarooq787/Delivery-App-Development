import { SupportContactLinks } from "@/components/public/support-contact-links"
import { CancellationPolicyNotice } from "@/components/customer/cancellation-policy-notice"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Terms of Service | GoDrop" }

const sections = [
  {
    title: "Acceptance of Terms",
    content: "By accessing or using GoDrop, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform. We reserve the right to update these terms at any time with notice provided via email or in-app notification.",
  },
  {
    title: "Description of Services",
    content: "GoDrop provides an on-demand delivery platform connecting customers who need items delivered with independent drivers. We are a technology platform and are not a logistics company. Drivers are independent contractors, not employees of GoDrop.",
  },
  {
    title: "User Accounts and Registration",
    content: "You must create an account to use our services. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must provide accurate, current, and complete information during registration.",
  },
  {
    title: "Prohibited Activities",
    content: "You may not use GoDrop to transport prohibited or illegal items. This includes but is not limited to: controlled substances, weapons, hazardous materials, counterfeit goods, and live animals. Violation of this policy may result in immediate account suspension and legal action.",
  },
  {
    title: "Payment Terms",
    content: "All payments are processed securely through our payment partners. By placing an order, you authorise us to charge your selected payment method. Prices displayed include all applicable fees. Refunds are processed according to our cancellation policy.",
  },
  {
    title: "Cancellation Policy",
    content: "Cancellation is free before the driver starts travel, including after acceptance. A fee applies after travel starts or the driver arrives, as shown in the booking policy and cancellation preview. Driver fault or no-show has no cancellation fee. Purchased shopping requires an admin review before a return, delivery or refund decision.",
  },
  {
    title: "Limitation of Liability",
    content: "To the maximum extent permitted by law, GoDrop shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability shall not exceed the amount paid for the delivery in question.",
  },
  {
    title: "Privacy and Data Protection",
    content: "Your use of GoDrop is also governed by our Privacy Policy, which is incorporated into these Terms by reference. We are committed to protecting your personal data in accordance with applicable data protection laws.",
  },
  {
    title: "Changes to Terms",
    content: "We reserve the right to modify these Terms at any time. We will provide reasonable notice of material changes. Your continued use of GoDrop after such changes constitutes your acceptance of the new Terms.",
  },
  {
    title: "Governing Law",
    content: "These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which GoDrop operates, without regard to its conflict of law provisions.",
  },
  {
    title: "Contact Information",
    content: "If you have any questions about these Terms of Service, please contact us at the support contact shown in the app or write to us at our registered business address.",
  },
]

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-3">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: 5 November 2026</p>
      </div>
      <div className="space-y-8">
        {sections.map((section, i) => (
          <div key={section.title} className="border-b border-border pb-8 last:border-0">
            <h2 className="text-base font-semibold text-foreground mb-3">
              {i + 1}. {section.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
            {section.title==="Contact Information"&&<SupportContactLinks/>}
            {section.title==="Cancellation Policy"&&<CancellationPolicyNotice/>}
          </div>
        ))}
      </div>
    </div>
  )
}
