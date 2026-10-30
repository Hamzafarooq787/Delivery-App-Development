const sections = [
  {
    title: "Information We Collect",
    content: "We collect information you provide directly to us, such as your name, email address, phone number, and payment details. We also automatically collect usage data including device information, IP addresses, and delivery history when you use our platform.",
  },
  {
    title: "How We Use Your Information",
    content: "We use your information to provide, maintain, and improve our services, process transactions, send transactional and promotional communications, monitor and analyse usage patterns, and comply with legal obligations.",
  },
  {
    title: "Information Sharing",
    content: "We share your information with drivers to fulfil delivery requests, with payment processors to complete transactions, and with service providers who assist in our operations. We do not sell your personal data to third parties.",
  },
  {
    title: "Data Security",
    content: "We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security audits to protect your personal information from unauthorised access or disclosure.",
  },
  {
    title: "Cookies and Tracking",
    content: "We use cookies and similar tracking technologies to enhance your experience, remember your preferences, and analyse how our platform is used. You can control cookie settings through your browser preferences.",
  },
  {
    title: "Third-Party Services",
    content: "Our platform may contain links to third-party services or integrate with third-party APIs such as mapping and payment providers. These third parties have their own privacy policies and we are not responsible for their practices.",
  },
  {
    title: "Your Rights",
    content: "Depending on your location, you may have rights to access, correct, delete, or restrict processing of your personal data. To exercise these rights, please contact us at privacy@godrop.uk.",
  },
  {
    title: "Data Retention",
    content: "We retain your personal data for as long as your account is active or as needed to provide services. We may retain certain data for longer periods as required by law or for legitimate business purposes.",
  },
  {
    title: "Children's Privacy",
    content: "Our services are not directed at individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal data, we will delete it promptly.",
  },
  {
    title: "International Transfers",
    content: "Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for any such transfers in accordance with applicable data protection laws.",
  },
  {
    title: "Updates to This Policy",
    content: "We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on our platform. Your continued use of our services after such changes constitutes acceptance.",
  },
  {
    title: "Contact Us",
    content: "If you have questions about this Privacy Policy or our data practices, please contact our Data Protection team at privacy@godrop.uk or write to us at our registered business address.",
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-foreground text-balance mb-3">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: January 1, 2025</p>
      </div>
      <div className="space-y-8">
        {sections.map((section, i) => (
          <div key={section.title} className="border-b border-border pb-8 last:border-0">
            <h2 className="text-base font-semibold text-foreground mb-3">
              {i + 1}. {section.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
