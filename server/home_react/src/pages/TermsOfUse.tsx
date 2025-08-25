import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import React from "react";

const TermsOfUse: React.FC = () => {
  return (
    <>
        <Header />
        <div className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <div className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Terms of Use</h1>
            <span className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</span>
            </div>
            <nav className="border-t bg-white">
            <div className="max-w-4xl mx-auto px-4 overflow-x-auto">
                <ol className="flex gap-4 py-3 text-sm whitespace-nowrap">
                <li><a href="#intro" className="text-blue-700 hover:underline">Intro</a></li>
                <li><a href="#modifications" className="text-blue-700 hover:underline">1. Modifications</a></li>
                <li><a href="#eligibility" className="text-blue-700 hover:underline">2. Eligibility</a></li>
                <li><a href="#content" className="text-blue-700 hover:underline">3. Content</a></li>
                <li><a href="#submissions" className="text-blue-700 hover:underline">4. User Submissions</a></li>
                <li><a href="#links" className="text-blue-700 hover:underline">5. Third‑Party Links</a></li>
                <li><a href="#prohibited" className="text-blue-700 hover:underline">6. Prohibited Actions</a></li>
                <li><a href="#dmca" className="text-blue-700 hover:underline">7. DMCA</a></li>
                <li><a href="#disclaimer" className="text-blue-700 hover:underline">8. Warranties & Disclaimers</a></li>
                <li><a href="#liability" className="text-blue-700 hover:underline">9. Limitation of Liability</a></li>
                <li><a href="#law" className="text-blue-700 hover:underline">10. Governing Law</a></li>
                <li><a href="#severability" className="text-blue-700 hover:underline">11. Severability</a></li>
                <li><a href="#limitation-of-claims" className="text-blue-700 hover:underline">12. Limitation of Claims</a></li>
                <li><a href="#general" className="text-blue-700 hover:underline">13. General</a></li>
                </ol>
            </div>
            </nav>
        </div>

        <main className="max-w-4xl mx-auto p-4 md:p-6 lg:px-8 lg:py-10">
            {/* Intro */}
            <section id="intro" className="scroll-mt-24">
            <div className="rounded-xl border bg-white p-5 md:p-6">
                <h2 className="sr-only">Introduction</h2>
                <p className="text-lg font-semibold">Please read these terms carefully before using this service</p>
                <p className="mt-3 leading-7">
                These terms and conditions (the <span className="italic">“Terms of Use”</span>) govern your use of
                <a href="https://airborne.juspay.in/" className="text-blue-700 hover:underline" target="_blank" rel="noreferrer"> https://airborne.juspay.in/</a>
                (the <span className="italic">“Site”</span>) that is owned by Juspay Technologies Pvt. Ltd. (<span className="italic">“Juspay,” “we,” “us,” or “our”</span>).
                These Terms of Use set forth the general terms and conditions of your use of the Site and your access,
                use, or download of materials from the Site. A user of this Site is referred to as <span className="italic">“User,” “you,”</span> or <span className="italic">“your.”</span>
                </p>
                <p className="mt-3 leading-7">
                Juspay provides technological payment solutions and ancillary services for facilitating seamless payment
                processing to e‑commerce merchant(s) and financial institutions.
                </p>
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                <p className="font-semibold">IF YOU DO NOT AGREE WITH THE TERMS SET FORTH IN THESE TERMS OF USE, YOU MUST NOT USE OUR SITE.</p>
                </div>
            </div>
            </section>

            <hr className="my-8" />

            {/* 1. Modifications */}
            <section id="modifications" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">1. Modification of Terms of Use, Site or Services</h2>
            <p className="leading-7">
                Juspay may, at its discretion, change or modify these Terms of Use at any time, and such changes or
                modifications shall be effective immediately upon posting to this Site. Your use of this Site after such
                changes or modifications have been made shall constitute your acceptance of these Terms of Use as last
                revised.
            </p>
            </section>

            <hr className="my-8" />

            {/* 2. Eligibility */}
            <section id="eligibility" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">2. Eligibility</h2>
            <p className="leading-7">
                Any registration by, use of or access to the Site by anyone under eighteen (18) years of age is unauthorized
                and in violation of these Terms of Use. If you are entering into these Terms of Use on behalf of another
                party, corporate entity or other organisation, you represent and warrant that you have the legal authority to
                bind such entity to these Terms of Use, in which case the terms “you,” “your,” or “User” shall refer to such
                party, corporate entity, or organisation.
            </p>
            </section>

            <hr className="my-8" />

            {/* 3. Content */}
            <section id="content" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">3. Content</h2>
            <div className="space-y-4 leading-7">
                <p>
                All copyright, trademark, and other proprietary rights and title in the text, graphics, design elements,
                audio, and all other materials originated or used on the Site (the “Content”), whether or not registered,
                are reserved to Juspay and its licensors. Further, Juspay and its licensors reserve all rights, title and
                interests in the trademarks, trade names, service marks, logos (“Trademarks”). You do not have the right to
                use any of the Trademarks from the Site without explicit consent from us.
                </p>
                <p>
                Juspay hereby authorizes you to download or copy the Content for personal use, provided that you retain all
                copyright and other proprietary notices contained in the original materials on any copies of the materials
                and that you comply strictly with these Terms. You may not modify, edit or take out of context the Content
                such that its use creates a false or misleading statement or impression as to the positions, statements or
                actions of Juspay. Except as specifically permitted by Juspay in writing, you may not use the Content for
                any commercial purposes. If you breach any of these Terms, your authorization to use the Site automatically
                terminates and you must immediately destroy any downloaded or printed materials.
                </p>
            </div>
            </section>

            <hr className="my-8" />

            {/* 4. User Submissions */}
            <section id="submissions" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">4. User Submissions</h2>
            <div className="space-y-4 leading-7">
                <p>
                You may submit your personal information via forms/fields on the Site while making enquiries or contacting
                us. All personal data obtained via your use of the Site is subject to our
                <a href="/privacy-policy" className="text-blue-700 hover:underline" target="_blank" rel="noreferrer"> Privacy Policy</a>.
                You hereby grant Juspay a royalty‑free, non‑exclusive, irrevocable, transferable and sub‑licensable license
                to use any information you provide via the Site for the purposes of contacting you, maintaining logs, and
                other related purposes. You are responsible for maintaining the confidentiality of any login information and
                secure access credentials associated with your Juspay account. Any action through your Juspay account shall
                be deemed to have been done by you. Juspay shall not be liable to verify the correctness, accuracy or
                currentness of the information provided by you through the Site.
                </p>
                <p>
                You acknowledge and agree that all submissions made by you to us through or in association with this Site,
                in the manner of feedback, comments, inquiries or materials are entirely voluntary, and do not establish a
                confidential relationship or obligate Juspay to treat your submissions as confidential except the personal
                information contained therein. Juspay shall own exclusive rights (including all intellectual property and
                other proprietary rights) to any submissions submitted by you, and shall be entitled to the unrestricted use
                and dissemination of any user submissions submitted to us for any purpose, commercial or otherwise. Juspay
                has no obligation, either express or implied, to develop or use your submissions and no compensation is due
                to you or to anyone else for any intentional or unintentional use of your user submissions.
                </p>
            </div>
            </section>

            <hr className="my-8" />

            {/* 5. Third‑Party Links */}
            <section id="links" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">5. Links to Third‑Party Sites</h2>
            <p className="leading-7">
                This Site may contain links to websites controlled by parties other than Juspay. Juspay assumes no
                responsibility over the content or use of any such websites controlled by a third party. It is hereby
                advised that the user reads, understands and reviews the terms, privacy policy and other governing documents
                before using such sites or the services found on such sites.
            </p>
            </section>

            <hr className="my-8" />

            {/* 6. Prohibited Actions */}
            <section id="prohibited" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">6. Prohibited Actions</h2>
            <p className="leading-7">
                You agree that the following actions are prohibited and constitute a material breach of these Terms. This
                list is not meant to be exhaustive, and Juspay reserves the right to determine what types of conduct it
                considers to be inappropriate use of the Site or the Services. In the case of inappropriate use, Juspay may
                take such measures as it determines in its sole discretion. By way of example, and not as a limitation, you
                agree that you will not:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-2 leading-7">
                <li>Use the Site or Content for any purpose or to take any actions in violation of local, state, national or international laws, regulations, codes or rules.</li>
                <li>Violate any code of conduct or other guidelines which may apply to any part of the Site or the Content.</li>
                <li>Take any action that places an unreasonable or disproportionately large load on Juspay’s infrastructure or otherwise adversely affects performance of the Services or restricts use by others.</li>
                <li>Use the Site for unauthorized framing or linking, or via automated devices, bots, agents, crawl, scraping, scripts, intelligent search or any similar means of access to Content.</li>
                <li>Aggregate, copy, duplicate, publish or make available any Content to third parties outside the Site or Juspay’s services in any manner, except as explicitly allowed in these Terms.</li>
                <li>Defame, abuse, harass, stalk, threaten or otherwise violate the legal rights of others, or impersonate anyone else or misrepresent your identity or affiliation.</li>
                <li>Publish, post, upload, distribute or disseminate any inappropriate, profane, defamatory, pornographic, offensive, harassing, infringing, obscene, indecent or unlawful topic, name, material, content or information.</li>
                <li>Upload or download files that contain software or other material protected by intellectual property laws or other laws, unless you own or control the rights or have received all necessary consents.</li>
                <li>Upload or transmit files that contain viruses, malware, disabling code, corrupted files, or any similar software or programs that may damage the operation of another’s computer.</li>
                <li>Falsify or delete any author attributions, legal or other notices, or proprietary designations or labels of origin or source.</li>
                <li>Engage in any other action that, in the judgment of Juspay, exposes it or any third party to potential liability or detriment of any type.</li>
            </ul>
            </section>

            <hr className="my-8" />

            {/* 7. DMCA */}
            <section id="dmca" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">7. DMCA Copyright Notice and Takedown Policy</h2>
            <p className="leading-7">
                If you are a copyright owner and believe your work has been copied and used improperly on the Site, please
                contact us. Pursuant to 17 U.S.C. § 512(c), to be effective, the notification must include: (1) physical or
                electronic signature of the copyright owner, or a person authorized to act on their behalf; (2) description
                of the work claimed to be infringed and the description and location of the alleged infringement on the Site;
                (3) your contact information including address, telephone number and email address; (4) a written statement
                that you have a good faith belief the accused usage is infringing; and (5) a statement under penalty of
                perjury that the information in the notice is accurate and that you are duly authorized to act on behalf of
                the copyright owner.
            </p>
            <p className="mt-3 leading-7">
                Please note that under Section 512(f) of the Digital Millennium Copyright Act (DMCA), any person who
                knowingly and materially misrepresents that material is infringing may be subject to liability. If you are
                unsure whether material on the Site is infringing, we suggest that you contact an attorney prior to sending
                notice.
            </p>
            </section>

            <hr className="my-8" />

            {/* 8. Warranties & Disclaimers */}
            <section id="disclaimer" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">8. Warranties and Disclaimers</h2>
            <p className="leading-7">
                Except as expressly stated otherwise in an agreement between you and Juspay, the Site, its Content and any
                items obtained through the Site are provided on an “as is” and “as available” basis, without any warranties
                of any kind, either express or implied. Neither Juspay nor any person associated with Juspay makes any
                warranty or representation with respect to the completeness, security, reliability, quality, accuracy or
                availability of the Site. Juspay hereby disclaims all warranties of any kind, whether express or implied,
                statutory or otherwise, including but not limited to any warranties of merchantability, non‑infringement and
                fitness for a particular purpose. The foregoing does not affect any warranties which cannot be excluded or
                limited under applicable law.
            </p>
            </section>

            <hr className="my-8" />

            {/* 9. Limitation of Liability */}
            <section id="liability" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">9. Limitation of Liability</h2>
            <p className="leading-7">
                We do not exclude or limit in any way our liability to you where it would be unlawful to do so. This includes
                liability for death or personal injury caused by our gross negligence or of our employees, agents or
                representatives; for fraud or fraudulent misrepresentation. Nothing in this section or these terms will affect
                your statutory rights as a consumer. Except under the circumstances stated above, in no event shall Juspay be
                responsible or liable to you or any third party under any circumstances for any indirect, consequential,
                special, punitive or exemplary damages or losses, including but not limited to damages for loss of profits,
                goodwill, use, data, or other intangible losses which may be incurred in connection with any goods, services,
                or information purchased, received, sold, or paid for by way of the use of the Services. In addition to and
                without limiting any of the foregoing, Juspay shall not have any liability for any failure or delay resulting
                from any condition beyond its reasonable control, including but not limited to governmental action or acts of
                terrorism, earthquake, fire, flood or other acts of God, strikes or other industrial action, power failures
                and Internet outages.
            </p>
            </section>

            <hr className="my-8" />

            {/* 10. Governing Law & Jurisdiction */}
            <section id="law" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">10. Governing Law and Jurisdiction</h2>
            <p className="leading-7">
                These Terms shall be governed by and construed in accordance with the laws of India, without reference to any
                conflict of law principles. You hereby consent to venue in and jurisdiction of the courts Bengaluru,
                Karnataka. Notwithstanding anything to the contrary, Juspay shall have the right to elect in its sole
                discretion the forum for any lawsuit arising hereunder brought by Juspay. Because you shall have access to the
                trademarks and other valuable proprietary materials of Juspay, you agree that Juspay shall have the right to
                enforce these Terms and any of its provisions by injunction (without being required to show any actual damage
                or to post an injunction bond), specific performance or any other equitable relief without prejudice to any
                other rights and remedies that Juspay may have for the breach of these Terms.
            </p>
            </section>

            <hr className="my-8" />

            {/* 11. Severability */}
            <section id="severability" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">11. Severability</h2>
            <p className="leading-7">
                If any provision or any part of a provision constituting the Terms is in violation of any law or regulation of
                any statutory body or held to be illegal, invalid or unenforceable by a court of competent jurisdiction, such
                provision shall be deemed modified to the extent necessary to make it enforceable under applicable law and
                shall be interpreted in a manner necessary to accomplish the objectives of such provision to the greatest
                extent possible. Any part or provision of these Terms which is held to be unenforceable shall be ineffective
                to the extent of such prohibition or unenforceability without invalidating the remaining provisions thereof.
            </p>
            </section>

            <hr className="my-8" />

            {/* 12. Limitation of Claims */}
            <section id="limitation-of-claims" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">12. Limitation of Claims</h2>
            <p className="leading-7">
                Any action on any claim against Juspay in relation to the Site and the Content must be brought by the user
                within one (1) year following the date the claim first accrued, or shall be deemed waived.
            </p>
            </section>

            <hr className="my-8" />

            {/* 13. General */}
            <section id="general" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">13. General</h2>
            <p className="leading-7">
                Juspay may revise these Terms at any time by updating this posting. You should visit this page from time to
                time to review the then‑current Terms of Use because they are binding on you.
            </p>
            </section>
        </main>
        </div>
        <Footer />
    </>
  );
};

export default TermsOfUse;
