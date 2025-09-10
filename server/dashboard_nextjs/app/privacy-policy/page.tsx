"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, ArrowLeft, Clock, Globe, Lock, UserCheck, FileText, Users, Database, Scale } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
  const sections = [
    { id: "purpose", title: "Purpose", icon: FileText },
    { id: "third-party-links", title: "Third-Party Links", icon: Globe },
    { id: "data-we-collect", title: "Data Collection", icon: Database },
    { id: "legal-basis", title: "Legal Basis", icon: Scale },
    { id: "fail-to-provide", title: "Required Data", icon: UserCheck },
    { id: "how-we-collect", title: "Collection Methods", icon: Users },
    { id: "marketing", title: "Marketing", icon: FileText },
    { id: "cookies", title: "Cookies", icon: Globe },
    { id: "international-transfers", title: "International Transfers", icon: Globe },
    { id: "data-security", title: "Data Security", icon: Lock },
    { id: "data-retention", title: "Data Retention", icon: Clock },
    { id: "data-disposal", title: "Data Disposal", icon: FileText },
    { id: "your-rights", title: "Your Rights", icon: UserCheck },
    { id: "disclaimer", title: "Disclaimer", icon: FileText },
    { id: "notice-updates", title: "Notice Updates", icon: Clock },
    { id: "contact", title: "Contact", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg font-[family-name:var(--font-space-grotesk)]">Privacy Policy</span>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            Version 2.0 • 29.04.2025
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="border-t bg-card">
          <div className="container mx-auto px-6 overflow-x-auto">
            <div className="flex gap-4 py-3 text-sm whitespace-nowrap">
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <Link 
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {section.title}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* 1. Purpose */}
        <section id="purpose" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                1. Purpose of this Privacy Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <p>
                Juspay Technologies Pvt. Ltd. ("Juspay", "we", "us", "our") may act
                as a controller and/or processor of your Personal Data. "Personal Data" means any personal
                information collected from you directly, via our customers/merchants, or other third parties.
              </p>
              <p>
                "You" or "your" refers to any individual who accesses, uses, or interacts with our services,
                websites or applications, including job applicants and individuals who communicate with us. By
                sharing your Personal Data, you agree to its processing in accordance with this notice.
              </p>
              <p>
                This notice explains how we collect and process your Personal Data. Please keep your information up
                to date and inform us of changes during your relationship with us.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 2. Third‑Party Links */}
        <section id="third-party-links" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                2. Third‑Party Links
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                Our websites may include links to third‑party sites or applications. Clicking those links may allow
                third parties to collect or share data about you. We don't control these sites and aren't responsible
                for their privacy statements. When you leave our website, we encourage you to read the privacy notice
                of every website you visit.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 3. Data We Collect */}
        <section id="data-we-collect" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                3. The Data We Collect About You
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <div>
                <p className="font-medium">When acting as a controller</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Identity and contact data (name, email, phone, address)</li>
                  <li>Technical data (IP address, browser type, device information)</li>
                  <li>Usage data (how you use our website and services)</li>
                  <li>Marketing and communications preferences</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">When acting as a processor (on behalf of customers)</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Transaction data processed for payment services</li>
                  <li>Customer data processed on behalf of merchants</li>
                  <li>End-user data for service delivery</li>
                </ul>
              </div>
              <p>
                We also collect, use and share aggregated data (e.g.,
                statistics or demographics) to improve services, performance of contract, marketing and other
                allied purposes. Aggregated data is derived from Personal Data but is not considered Personal Data
                under applicable law as it does not directly or indirectly reveal your identity.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 4. Legal Basis & Purposes */}
        <section id="legal-basis" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                4. Legal Basis and Purposes for Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <p>
                Below is a description of how we may process your Personal Data, the legal basis relied upon, and
                whether we disclose it to third parties.
              </p>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Purpose</th>
                      <th className="px-4 py-3 font-medium">Legal Basis</th>
                      <th className="px-4 py-3 font-medium">Third Party Disclosure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="px-4 py-3">Service provision</td>
                      <td className="px-4 py-3">Contract performance</td>
                      <td className="px-4 py-3">Service providers</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Marketing communications</td>
                      <td className="px-4 py-3">Consent/Legitimate interest</td>
                      <td className="px-4 py-3">Marketing partners</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Legal compliance</td>
                      <td className="px-4 py-3">Legal obligation</td>
                      <td className="px-4 py-3">Regulators, law enforcement</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                Note: Legal bases may differ by jurisdiction. We will ensure compliance with applicable local laws and
                regulations.
              </p>
              <p>
                We disclose Personal Data only for the purposes identified in this notice unless a law or regulation
                allows or requires otherwise. Third parties must respect the security of your Personal Data and process
                it only for specified purposes and in accordance with our instructions.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 5. If You Fail to Provide */}
        <section id="fail-to-provide" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                5. If You Fail to Provide Personal Data
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                Where we must collect Personal Data by law or under a contract with you, and you fail to provide it
                when requested, we may be unable to perform the contract (e.g., to provide products/services). We will
                endeavor to notify you if this is the case.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 6. How We Collect */}
        <section id="how-we-collect" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                6. How We Collect Your Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2 leading-7">
                <li>
                  <strong>Direct interactions:</strong> when you purchase or access our products or
                  services, request marketing, request support, or submit employment‑related queries.
                </li>
                <li>
                  <strong>Automated technologies or interactions:</strong> technical data collected via
                  cookies, pixels, server logs, and similar technologies.
                </li>
                <li>
                  <strong>Third parties or publicly available sources:</strong> contact
                  and transaction data from providers located inside and outside your country.
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* 7. Marketing */}
        <section id="marketing" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                7. Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 leading-7">
              <p>
                We provide choices regarding our use of your Personal Data for marketing and advertising. You may
                receive marketing communications if you have opted in, or if you subscribed for an account/purchased
                goods or services and have not opted out (where permitted by local law).
              </p>
              <p>
                All marketing communications include an opt‑out option. Opting out will not affect the lawfulness of
                processing prior to the opt‑out. You can adjust preferences in your account, follow opt‑out links in
                emails, or contact us (see <Link href="#contact" className="text-primary hover:underline">Contact</Link>).
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 8. Cookies */}
        <section id="cookies" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                8. Cookies
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                You can set your browser to refuse all or some cookies, or to alert you when websites set or access
                cookies. Disabling cookies may affect website functionality.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 9. International Transfers */}
        <section id="international-transfers" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                9. International Transfers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 leading-7">
              <p>
                Some external third parties may be based outside your country and the EEA; their processing may
                involve data transfers outside your country.
              </p>
              <p>
                We implement safeguards such as transfers to jurisdictions deemed adequate, standard contractual
                clauses/data protection clauses, binding corporate rules, or other mechanisms allowed by law
                (including consent or necessity for contract performance).
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 10. Data Security */}
        <section id="data-security" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                10. Data Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 leading-7">
              <p>
                We use appropriate security measures to prevent your Personal Data from being accidentally lost, used
                or accessed in an unauthorized way, altered, disclosed, or unavailable. Access is limited to those
                with a need to know and who are under a duty of confidentiality.
              </p>
              <p>
                We periodically review our privacy and security policies and update them as needed in line with
                changes in law or technology. Where new technologies create a high risk to Personal Data, we may
                (where required) perform a data protection impact assessment and proceed only if high risks can be
                mitigated.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 11. Data Retention */}
        <section id="data-retention" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                11. Data Retention
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                We retain Personal Data only as long as necessary to fulfill the purposes for which it was collected,
                including legal, accounting, or reporting requirements. In some cases, we may anonymize Personal Data
                for research or statistical purposes and use it indefinitely without further notice.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 12. Data Disposal */}
        <section id="data-disposal" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                12. Data Disposal
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                When retention periods expire, digital records are permanently destroyed or fully anonymized if
                retained for statistics or research. All personal identifiers are removed permanently so individuals
                cannot be identified.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 13. Your Rights */}
        <section id="your-rights" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                13. Your Legal Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Request access</strong> to your personal data</li>
                <li>
                  <strong>Request a privacy report</strong> (summary of Personal Data processed; processing
                  activities; identities of entities with whom data is shared; and other related information as
                  prescribed).
                </li>
                <li><strong>Request correction</strong> of inaccurate or incomplete data</li>
                <li><strong>Request erasure</strong> of your personal data</li>
                <li>
                  <strong>Object to processing</strong> (including sale or sharing of personal
                  data, subject to applicable exemptions).
                </li>
                <li><strong>Request restriction</strong> of processing</li>
                <li><strong>Request transfer</strong> of your data to another organization</li>
                <li><strong>Withdraw consent</strong> at any time</li>
                <li>
                  <strong>Authorize</strong> an individual to exercise rights in case of death
                  or incapacity.
                </li>
              </ul>
              <p>
                To exercise these rights, contact us using the details in <Link href="#contact" className="text-primary hover:underline">Contact</Link>.
                Depending on your jurisdiction, you may also have the right to appeal our decision or lodge a complaint
                with your local data protection authority.
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                <li>India: Data Protection Board of India (once implemented)</li>
                <li>European Union: your local member state DPA</li>
                <li>Singapore: Personal Data Protection Commission</li>
                <li>Brazil: Brazilian Data Protection Authority</li>
                <li>Delaware, USA: Delaware Attorney General Office</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* 14. Disclaimer */}
        <section id="disclaimer" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                14. Disclaimer
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                When we act as a Data Processor on behalf of our customers, any request you submit regarding your data
                will be forwarded to the respective customer(s).
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 15. Notice Updates */}
        <section id="notice-updates" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                15. Notice Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                We review policies at least annually and when laws change. We may update this notice to reflect
                changes in practices or to comply with applicable laws. Material changes will be posted on our website
                or notified directly. Continued use of our services after changes constitutes acceptance.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 16. Contact Details */}
        <section id="contact" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                16. Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Data Protection Officer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Email:</strong> privacy@juspay.in</p>
                    <p><strong>Address:</strong> Juspay Technologies Pvt. Ltd.</p>
                    <p>Girija Building, #817, Ganapathi Temple Rd,</p>
                    <p>8th Block, Koramangala, Bengaluru 560095</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">General Inquiries</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Email:</strong> support@juspay.in</p>
                    <p><strong>Phone:</strong> +91 80 6719 8000</p>
                    <p><strong>Website:</strong> www.juspay.in</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
