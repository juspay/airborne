"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Scale,
  ArrowLeft,
  AlertTriangle,
  FileText,
  Users,
  Link as LinkIcon,
  Shield,
  Gavel,
  Clock,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

export default function TermsOfUsePage() {
  const sections = [
    { id: "intro", title: "Introduction", icon: FileText },
    { id: "modifications", title: "Modifications", icon: Clock },
    { id: "eligibility", title: "Eligibility", icon: Users },
    { id: "content", title: "Content", icon: FileText },
    { id: "submissions", title: "User Submissions", icon: Users },
    { id: "links", title: "Third-Party Links", icon: LinkIcon },
    { id: "prohibited", title: "Prohibited Actions", icon: Shield },
    { id: "dmca", title: "DMCA", icon: Scale },
    { id: "disclaimer", title: "Warranties & Disclaimers", icon: AlertTriangle },
    { id: "liability", title: "Limitation of Liability", icon: Scale },
    { id: "law", title: "Governing Law", icon: Gavel },
    { id: "severability", title: "Severability", icon: FileText },
    { id: "limitation-of-claims", title: "Limitation of Claims", icon: Clock },
    { id: "general", title: "General", icon: HelpCircle },
  ];

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
                <Scale className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg font-[family-name:var(--font-space-grotesk)]">Terms of Use</span>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono">
            Last updated: {new Date().toLocaleDateString()}
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="border-t bg-card">
          <div className="container mx-auto px-6 overflow-x-auto">
            <div className="flex gap-4 py-3 text-sm whitespace-nowrap">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <Link
                    key={section.id}
                    href={`#${encodeURIComponent(section.id)}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {section.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Intro */}
        <section id="intro" className="scroll-mt-24 mb-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="sr-only">Introduction</h2>
              <p className="text-lg font-semibold mb-3">Please read these terms carefully before using this service</p>
              <div className="space-y-4 leading-7">
                <p>
                  These terms and conditions (the <strong>&quot;Terms&quot;</strong>) govern your use of the Airborne
                  platform and website (the <strong>&quot;Site&quot;</strong>) that is owned by Juspay Technologies Pvt.
                  Ltd. (<strong>&quot;Juspay&quot;</strong>). These Terms of Use set forth the general terms and
                  conditions of your use of the Site and your access, use, or download of materials from the Site. A
                  user of this Site is referred to as <strong>&quot;you&quot;</strong> or{" "}
                  <strong>&quot;User&quot;</strong>.
                </p>
                <p>
                  Juspay provides technological payment solutions and ancillary services for facilitating seamless
                  payment processing to e‑commerce merchant(s) and financial institutions.
                </p>
              </div>
              <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive-foreground">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Important Notice</p>
                    <p className="text-sm">
                      By accessing or using this service, you agree to be bound by these Terms of Use. If you do not
                      agree with any part of these terms, you must not use our service.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 1. Modifications */}
        <section id="modifications" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                1. Modification of Terms of Use, Site or Services
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                Juspay may, at its discretion, change or modify these Terms of Use at any time, and such changes or
                modifications shall be effective immediately upon posting to this Site. Your use of this Site after such
                changes or modifications have been made shall constitute your acceptance of these Terms of Use as last
                revised.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 2. Eligibility */}
        <section id="eligibility" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                2. Eligibility
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                Any registration by, use of or access to the Site by anyone under eighteen (18) years of age is
                unauthorized and in violation of these Terms of Use. If you are entering into these Terms of Use on
                behalf of another party, corporate entity or other organisation, you represent and warrant that you have
                the legal authority to bind such entity to these Terms of Use, in which case the terms &quot;you,&quot;
                &quot;your,&quot; or &quot;User&quot; shall refer to such party, corporate entity, or organisation.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 3. Content */}
        <section id="content" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                3. Content
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                All copyright, trademark, and other proprietary rights and title in the text, graphics, design elements,
                audio, and all other materials originated or used on the Site (the &quot;Content&quot;), whether or not
                registered, are reserved to Juspay and its licensors. Further, Juspay and its licensors reserve all
                rights, title and interests in the trademarks, trade names, service marks, logos
                (&quot;Trademarks&quot;). You do not have the right to use any of the Trademarks from the Site without
                explicit consent from us.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 4. User Submissions */}
        <section id="submissions" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                4. User Submissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <p>
                You are solely responsible for any content, information, data, text, software, music, sound,
                photographs, graphics, video, messages, or other materials (&quot;User Content&quot;) that you upload,
                post, publish, or display on or through the Site.
              </p>
              <p>
                By submitting User Content, you grant Juspay a worldwide, non-exclusive, royalty-free, transferable
                license to use, reproduce, distribute, prepare derivative works of, display, and perform the User
                Content in connection with the Site and Juspay&apos;s business.
              </p>
              <p>
                You represent and warrant that you own or have the necessary rights to submit the User Content and that
                such content does not violate any third-party rights or applicable laws.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 5. Third‑Party Links */}
        <section id="links" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                5. Links to Third‑Party Sites
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                This Site may contain links to websites controlled by parties other than Juspay. Juspay assumes no
                responsibility over the content or use of any such websites controlled by a third party. It is hereby
                advised that the user reads, understands and reviews the terms, privacy policy and other governing
                documents before using such sites or the services found on such sites.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 6. Prohibited Actions */}
        <section id="prohibited" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                6. Prohibited Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <p>
                You agree that the following actions are prohibited and constitute a material breach of these Terms.
                This list is not meant to be exhaustive, and Juspay reserves the right to determine what types of
                conduct it considers to be inappropriate use of the Site or the Services. In the case of inappropriate
                use, Juspay may take such measures as it determines in its sole discretion. By way of example, and not
                as a limitation, you agree that you will not:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Use the Site for any unlawful purpose or in violation of any local, state, national, or international
                  law
                </li>
                <li>Harass, threaten, demean, embarrass, or otherwise harm any other user of the Site</li>
                <li>
                  Violate or infringe upon the rights of others, including privacy, publicity, intellectual property, or
                  other proprietary rights
                </li>
                <li>
                  Upload, post, or transmit any content that is illegal, harmful, threatening, abusive, harassing,
                  defamatory, vulgar, obscene, or racially offensive
                </li>
                <li>
                  Distribute unsolicited or unauthorized advertising, promotional materials, spam, or any other form of
                  solicitation
                </li>
                <li>Collect, harvest, or store personal data about other users without their consent</li>
                <li>Attempt to gain unauthorized access to the Site, other user accounts, or computer systems</li>
                <li>Interfere with or disrupt the Site or servers connected to the Site</li>
                <li>Use any robot, spider, scraper, or other automated means to access the Site</li>
                <li>Reverse engineer, decompile, or disassemble any software made available through the Site</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* 7. DMCA */}
        <section id="dmca" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                7. DMCA Copyright Notice and Takedown Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <p>
                If you are a copyright owner and believe your work has been copied and used improperly on the Site,
                please contact us. Pursuant to 17 U.S.C. § 512(c), to be effective, the notification must include: (1)
                physical or electronic signature of the copyright owner, or a person authorized to act on their behalf;
                (2) description of the work claimed to be infringed and the description and location of the alleged
                infringement on the Site; (3) your contact information including address, telephone number and email
                address; (4) a written statement that you have a good faith belief the accused usage is infringing; and
                (5) a statement under penalty of perjury that the information in the notice is accurate and that you are
                duly authorized to act on behalf of the copyright owner.
              </p>
              <p>
                Please note that under Section 512(f) of the Digital Millennium Copyright Act (DMCA), any person who
                knowingly and materially misrepresents that material is infringing may be subject to liability. If you
                are unsure whether material on the Site is infringing, we suggest that you contact an attorney prior to
                sending notice.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 8. Warranties & Disclaimers */}
        <section id="disclaimer" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                8. Warranties and Disclaimers
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                Except as expressly stated otherwise in an agreement between you and Juspay, the Site, its Content and
                any items obtained through the Site are provided on an &quot;as is&quot; and &quot;as available&quot;
                basis, without any warranties of any kind, either express or implied. Neither Juspay nor any person
                associated with Juspay makes any warranty or representation with respect to the completeness, security,
                reliability, quality, accuracy or availability of the Site. Juspay hereby disclaims all warranties of
                any kind, whether express or implied, statutory or otherwise, including but not limited to any
                warranties of merchantability, non‑infringement and fitness for a particular purpose. The foregoing does
                not affect any warranties which cannot be excluded or limited under applicable law.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 9. Limitation of Liability */}
        <section id="liability" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                9. Limitation of Liability
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                We do not exclude or limit in any way our liability to you where it would be unlawful to do so. This
                includes liability for death or personal injury caused by our gross negligence or of our employees,
                agents or representatives; for fraud or fraudulent misrepresentation. Nothing in this section or these
                terms will affect your statutory rights as a consumer. Except under the circumstances stated above, in
                no event shall Juspay be responsible or liable to you or any third party under any circumstances for any
                indirect, consequential, special, punitive or exemplary damages or losses, including but not limited to
                damages for loss of profits, goodwill, use, data, or other intangible losses which may be incurred in
                connection with any goods, services, or information purchased, received, sold, or paid for by way of the
                use of the Services. In addition to and without limiting any of the foregoing, Juspay shall not have any
                liability for any failure or delay resulting from any condition beyond its reasonable control, including
                but not limited to governmental action or acts of terrorism, earthquake, fire, flood or other acts of
                God, strikes or other industrial action, power failures and Internet outages.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 10. Governing Law & Jurisdiction */}
        <section id="law" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                10. Governing Law and Jurisdiction
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of India, without reference
                to any conflict of law principles. You hereby consent to venue in and jurisdiction of the courts
                Bengaluru, Karnataka. Notwithstanding anything to the contrary, Juspay shall have the right to elect in
                its sole discretion the forum for any lawsuit arising hereunder brought by Juspay. Because you shall
                have access to the trademarks and other valuable proprietary materials of Juspay, you agree that Juspay
                shall have the right to enforce these Terms and any of its provisions by injunction (without being
                required to show any actual damage or to post an injunction bond), specific performance or any other
                equitable relief without prejudice to any other rights and remedies that Juspay may have for the breach
                of these Terms.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 11. Severability */}
        <section id="severability" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                11. Severability
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                If any provision or any part of a provision constituting the Terms is in violation of any law or
                regulation of any statutory body or held to be illegal, invalid or unenforceable by a court of competent
                jurisdiction, such provision shall be deemed modified to the extent necessary to make it enforceable
                under applicable law and shall be interpreted in a manner necessary to accomplish the objectives of such
                provision to the greatest extent possible. Any part or provision of these Terms which is held to be
                unenforceable shall be ineffective to the extent of such prohibition or unenforceability without
                invalidating the remaining provisions thereof.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 12. Limitation of Claims */}
        <section id="limitation-of-claims" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                12. Limitation of Claims
              </CardTitle>
            </CardHeader>
            <CardContent className="leading-7">
              <p>
                Any action on any claim against Juspay in relation to the Site and the Content must be brought by the
                user within one (1) year following the date the claim first accrued, or shall be deemed waived.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 13. General */}
        <section id="general" className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                13. General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 leading-7">
              <p>
                Juspay may revise these Terms at any time by updating this posting. You should visit this page from time
                to time to review the then‑current Terms of Use because they are binding on you.
              </p>
              <p>
                These Terms constitute the entire agreement between you and Juspay regarding your use of the Site and
                supersede all prior and contemporaneous written or oral agreements between you and Juspay.
              </p>
              <p>
                No waiver of any term of these Terms shall be deemed a further or continuing waiver of such term or any
                other term, and Juspay&apos;s failure to assert any right or provision under these Terms shall not
                constitute a waiver of such right or provision.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Contact Section */}
        <section className="scroll-mt-24 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="leading-7">If you have any questions about these Terms of Use, please contact us at:</p>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Email:</strong> legal@juspay.in
                    </p>
                    <p>
                      <strong>Address:</strong> Juspay Technologies Pvt. Ltd.
                    </p>
                    <p>Girija Building, #817, Ganapathi Temple Rd,</p>
                    <p>8th Block, Koramangala, Bengaluru 560095, India</p>
                    <p>
                      <strong>Phone:</strong> +91 80 6719 8000
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
