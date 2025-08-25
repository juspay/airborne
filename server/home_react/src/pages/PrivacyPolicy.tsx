import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import React from "react";

const PrivacyPolicyPage: React.FC = () => {
  return (
    <>
        <Header />
        <div className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <div className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Privacy Policy</h1>
                <span className="text-sm text-gray-500">Version 2.0 • 29.04.2025</span>
            </div>
            <nav className="border-t bg-white">
                <div className="max-w-4xl mx-auto px-4 overflow-x-auto">
                    <ol className="flex gap-4 py-3 text-sm whitespace-nowrap">
                    <li><a href="#purpose" className="text-blue-700 hover:underline">1. Purpose</a></li>
                    <li><a href="#third-party-links" className="text-blue-700 hover:underline">2. Third‑Party Links</a></li>
                    <li><a href="#data-we-collect" className="text-blue-700 hover:underline">3. Data We Collect</a></li>
                    <li><a href="#legal-basis" className="text-blue-700 hover:underline">4. Legal Basis & Purposes</a></li>
                    <li><a href="#fail-to-provide" className="text-blue-700 hover:underline">5. If You Don’t Provide Data</a></li>
                    <li><a href="#how-we-collect" className="text-blue-700 hover:underline">6. How We Collect</a></li>
                    <li><a href="#marketing" className="text-blue-700 hover:underline">7. Marketing</a></li>
                    <li><a href="#cookies" className="text-blue-700 hover:underline">8. Cookies</a></li>
                    <li><a href="#international-transfers" className="text-blue-700 hover:underline">9. International Transfers</a></li>
                    <li><a href="#data-security" className="text-blue-700 hover:underline">10. Data Security</a></li>
                    <li><a href="#data-retention" className="text-blue-700 hover:underline">11. Data Retention</a></li>
                    <li><a href="#data-disposal" className="text-blue-700 hover:underline">12. Data Disposal</a></li>
                    <li><a href="#your-rights" className="text-blue-700 hover:underline">13. Your Rights</a></li>
                    <li><a href="#disclaimer" className="text-blue-700 hover:underline">14. Disclaimer</a></li>
                    <li><a href="#notice-updates" className="text-blue-700 hover:underline">15. Notice Updates</a></li>
                    <li><a href="#contact" className="text-blue-700 hover:underline">16. Contact</a></li>
                    </ol>
                </div>
            </nav>
        </div>

        <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
            {/* 1. Purpose */}
            <section id="purpose" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">1. Purpose of this Privacy Notice</h2>
            <div className="space-y-4 leading-7">
                <p>
                <span className="font-medium">Juspay Technologies Private Limited</span> ("Juspay", “we”, “us”, “our”) may act
                as a controller and/or processor of your Personal Data. “Personal Data” means any personal
                information collected from you directly, via our customers/merchants, or other third parties.
                </p>
                <p>
                “You” or “your” refers to any individual who accesses, uses, or interacts with our services,
                websites or applications, including job applicants and individuals who communicate with us. By
                sharing your Personal Data, you agree to its processing in accordance with this notice.
                </p>
                <p>
                This notice explains how we collect and process your Personal Data. Please keep your information up
                to date and inform us of changes during your relationship with us.
                </p>
            </div>
            </section>

            <hr className="my-8" />

            {/* 2. Third‑Party Links */}
            <section id="third-party-links" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">2. Third‑Party Links</h2>
            <p className="leading-7">
                Our websites may include links to third‑party sites or applications. Clicking those links may allow
                third parties to collect or share data about you. We don’t control these sites and aren’t responsible
                for their privacy statements. When you leave our website, we encourage you to read the privacy notice
                of every website you visit.
            </p>
            </section>

            <hr className="my-8" />

            {/* 3. Data We Collect */}
            <section id="data-we-collect" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">3. The Data We Collect About You</h2>
            <div className="space-y-4 leading-7">
                <p className="font-medium">When acting as a controller</p>
                <ul className="list-disc pl-6 space-y-2">
                <li>
                    <span className="font-medium">Profile data:</span> username and password, interests, preferences, 
                    correspondence and engagement records, feedback and survey responses.
                </li>
                <li>
                    <span className="font-medium">Marketing & communications data:</span> preferences for receiving
                    marketing and your communication settings (e.g., name, email address, phone).
                </li>
                <li>
                    <span className="font-medium">Technical data (online identifiers):</span> IP address, device
                    identifiers (e.g., IDFA/IMEI), device type, login data, browser type/version, time‑zone and
                    geolocation, plug‑ins, operating system and platform, and other technology used to access our
                    websites.
                </li>
                </ul>
                <p className="font-medium">When acting as a processor (on behalf of customers)</p>
                <ul className="list-disc pl-6 space-y-2">
                <li><span className="font-medium">Identity data:</span> first/last name, username or similar identifier, title, date of birth.</li>
                <li><span className="font-medium">Contact data:</span> postal address, email address, phone numbers.</li>
                <li><span className="font-medium">Financial data:</span> bank account, card details, payroll data.</li>
                <li><span className="font-medium">Transaction data:</span> details of payments to/from you and purchases.</li>
                <li><span className="font-medium">Usage data:</span> information about how you use our website, products and services.</li>
                </ul>
                <p>
                <span className="font-medium">Aggregated data:</span> We also collect, use and share aggregated data (e.g.,
                statistics or demographics) to improve services, performance of contract, marketing and other
                allied purposes. Aggregated data is derived from Personal Data but is not considered Personal Data
                under applicable law as it does not directly or indirectly reveal your identity.
                </p>
            </div>
            </section>

            <hr className="my-8" />

            {/* 4. Legal Basis & Purposes */}
            <section id="legal-basis" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">4. Legal Basis and Purposes for Processing</h2>
            <p className="mb-4 leading-7">
                Below is a description of how we may process your Personal Data, the legal basis relied upon, and
                whether we disclose it to third parties.
            </p>
            <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-700">
                    <tr>
                    <th className="px-4 py-3 font-semibold">Purpose/Activity</th>
                    <th className="px-4 py-3 font-semibold">Type of Data</th>
                    <th className="px-4 py-3 font-semibold">Lawful Basis</th>
                    <th className="px-4 py-3 font-semibold">Disclosure to Third Party</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    <tr>
                    <td className="px-4 py-3">Onboarding and registration of vendors/customers</td>
                    <td className="px-4 py-3">Name, business email, phone, company name, website</td>
                    <td className="px-4 py-3">Required to sign up or get onboarded; vendor due diligence; performance of services</td>
                    <td className="px-4 py-3">Local payment providers and other service providers (as applicable)</td>
                    </tr>
                    <tr>
                    <td className="px-4 py-3">Enabling Juspay products and services</td>
                    <td className="px-4 py-3">Card/UPI details, name, contact info, transaction amount/date/time/id</td>
                    <td className="px-4 py-3">Provision of products and services</td>
                    <td className="px-4 py-3">Cloud service providers, local PSPs, card networks</td>
                    </tr>
                    <tr>
                    <td className="px-4 py-3">Marketing and promotional activities</td>
                    <td className="px-4 py-3">Identity, contact and communication info shared by you</td>
                    <td className="px-4 py-3">Legitimate interests (product usage analysis, development, growth)</td>
                    <td className="px-4 py-3">CRM providers and third‑party email aggregators</td>
                    </tr>
                    <tr>
                    <td className="px-4 py-3">Processing job applications</td>
                    <td className="px-4 py-3">Identity, contact, identification proof, other voluntarily provided details</td>
                    <td className="px-4 py-3">Due diligence of candidates; onboarding</td>
                    <td className="px-4 py-3">Third‑party background verification providers</td>
                    </tr>
                    <tr>
                    <td className="px-4 py-3">Customer service and support</td>
                    <td className="px-4 py-3">Name, email, mobile number</td>
                    <td className="px-4 py-3">Consent</td>
                    <td className="px-4 py-3">Third‑party email aggregators for support</td>
                    </tr>
                    <tr>
                    <td className="px-4 py-3">Improvement of services</td>
                    <td className="px-4 py-3">Statistical and usage data</td>
                    <td className="px-4 py-3">Legitimate interests</td>
                    <td className="px-4 py-3">Not applicable</td>
                    </tr>
                    <tr>
                    <td className="px-4 py-3">Constitutional changes through mergers or acquisitions</td>
                    <td className="px-4 py-3">All personal data</td>
                    <td className="px-4 py-3">Legitimate interests</td>
                    <td className="px-4 py-3">Advisers and prospective purchasers/partners; new owners/partners</td>
                    </tr>
                </tbody>
                </table>
            </div>
            <p className="mt-4 text-sm text-gray-700">
                Note: Legal bases may differ by jurisdiction. We will ensure compliance with applicable local laws and
                regulations.
            </p>
            <p className="mt-2 leading-7">
                We disclose Personal Data only for the purposes identified in this notice unless a law or regulation
                allows or requires otherwise. Third parties must respect the security of your Personal Data and process
                it only for specified purposes and in accordance with our instructions.
            </p>
            </section>

            <hr className="my-8" />

            {/* 5. If You Fail to Provide */}
            <section id="fail-to-provide" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">5. If You Fail to Provide Personal Data</h2>
            <p className="leading-7">
                Where we must collect Personal Data by law or under a contract with you, and you fail to provide it
                when requested, we may be unable to perform the contract (e.g., to provide products/services). We will
                endeavor to notify you if this is the case.
            </p>
            </section>

            <hr className="my-8" />

            {/* 6. How We Collect */}
            <section id="how-we-collect" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">6. How We Collect Your Data</h2>
            <ul className="list-disc pl-6 space-y-2 leading-7">
                <li>
                <span className="font-medium">Direct interactions:</span> when you purchase or access our products or
                services, request marketing, request support, or submit employment‑related queries.
                </li>
                <li>
                <span className="font-medium">Automated technologies or interactions:</span> technical data collected via
                cookies, pixels, server logs, and similar technologies.
                </li>
                <li>
                <span className="font-medium">From providers of technical, payment and delivery services:</span> contact
                and transaction data from providers located inside and outside your country.
                </li>
            </ul>
            </section>

            <hr className="my-8" />

            {/* 7. Marketing */}
            <section id="marketing" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">7. Marketing</h2>
            <div className="space-y-3 leading-7">
                <p>
                We provide choices regarding our use of your Personal Data for marketing and advertising. You may
                receive marketing communications if you have opted in, or if you subscribed for an account/purchased
                goods or services and have not opted out (where permitted by local law).
                </p>
                <p>
                All marketing communications include an opt‑out option. Opting out will not affect the lawfulness of
                processing prior to the opt‑out. You can adjust preferences in your account, follow opt‑out links in
                emails, or contact us (see <a href="#contact" className="text-blue-700 hover:underline">Contact</a>).
                </p>
            </div>
            </section>

            <hr className="my-8" />

            {/* 8. Cookies */}
            <section id="cookies" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">8. Cookies</h2>
            <p className="leading-7">
                You can set your browser to refuse all or some cookies, or to alert you when websites set or access
                cookies. Disabling cookies may affect website functionality.
            </p>
            </section>

            <hr className="my-8" />

            {/* 9. International Transfers */}
            <section id="international-transfers" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">9. International Transfers</h2>
            <div className="space-y-3 leading-7">
                <p>
                Some external third parties may be based outside your country and the EEA; their processing may
                involve data transfers outside your country.
                </p>
                <p>
                We implement safeguards such as transfers to jurisdictions deemed adequate, standard contractual
                clauses/data protection clauses, binding corporate rules, or other mechanisms allowed by law
                (including consent or necessity for contract performance).
                </p>
            </div>
            </section>

            <hr className="my-8" />

            {/* 10. Data Security */}
            <section id="data-security" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">10. Data Security</h2>
            <div className="space-y-3 leading-7">
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
            </div>
            </section>

            <hr className="my-8" />

            {/* 11. Data Retention */}
            <section id="data-retention" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">11. Data Retention</h2>
            <p className="leading-7">
                We retain Personal Data only as long as necessary to fulfill the purposes for which it was collected,
                including legal, accounting, or reporting requirements. In some cases, we may anonymize Personal Data
                for research or statistical purposes and use it indefinitely without further notice.
            </p>
            </section>

            <hr className="my-8" />

            {/* 12. Data Disposal */}
            <section id="data-disposal" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">12. Data Disposal</h2>
            <p className="leading-7">
                When retention periods expire, digital records are permanently destroyed or fully anonymized if
                retained for statistics or research. All personal identifiers are removed permanently so individuals
                cannot be identified.
            </p>
            </section>

            <hr className="my-8" />

            {/* 13. Your Rights */}
            <section id="your-rights" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">13. Your Legal Rights</h2>
            <ul className="list-disc pl-6 space-y-2 leading-7">
                <li><span className="font-medium">Right to be Informed</span></li>
                <li>
                <span className="font-medium">Right of Access</span> (summary of Personal Data processed; processing
                activities; identities of entities with whom data is shared; and other related information as
                prescribed).
                </li>
                <li><span className="font-medium">Right to Correction and Erasure</span></li>
                <li><span className="font-medium">Right to Restriction on Processing</span></li>
                <li>
                <span className="font-medium">Right to Object or Opt‑Out</span> (including sale or sharing of personal
                data, subject to applicable exemptions).
                </li>
                <li><span className="font-medium">Right to Data Portability</span></li>
                <li><span className="font-medium">Right to Object to/Review Automated Decisions</span></li>
                <li><span className="font-medium">Right to Grievance Redressal</span></li>
                <li>
                <span className="font-medium">Right to Nominate</span> an individual to exercise rights in case of death
                or incapacity.
                </li>
            </ul>
            <p className="mt-4 leading-7">
                To exercise these rights, contact us using the details in <a href="#contact" className="text-blue-700 hover:underline">Contact</a>.
                Depending on your jurisdiction, you may also have the right to appeal our decision or lodge a complaint
                with your local data protection authority.
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-sm text-gray-700">
                <li>India: Data Protection Board of India (once implemented)</li>
                <li>European Union: your local member state DPA</li>
                <li>Singapore: Personal Data Protection Commission</li>
                <li>Brazil: Brazilian Data Protection Authority</li>
                <li>Delaware, USA: Delaware Attorney General Office</li>
            </ul>
            </section>

            <hr className="my-8" />

            {/* 14. Disclaimer */}
            <section id="disclaimer" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">14. Disclaimer</h2>
            <p className="leading-7">
                When we act as a Data Processor on behalf of our customers, any request you submit regarding your data
                will be forwarded to the respective customer(s).
            </p>
            </section>

            <hr className="my-8" />

            {/* 15. Notice Updates */}
            <section id="notice-updates" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">15. Notice Updates</h2>
            <p className="leading-7">
                We review policies at least annually and when laws change. We may update this notice to reflect
                changes in practices or to comply with applicable laws. Material changes will be posted on our website
                or notified directly. Continued use of our services after changes constitutes acceptance.
            </p>
            </section>

            <hr className="my-8" />

            {/* 16. Contact Details */}
            <section id="contact" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-3">16. Contact Details</h2>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold">JUSPAY INDIA</h3>
                <p className="mt-2 text-sm">Juspay Technologies Private Limited</p>
                <p className="text-sm">Stallion Business Center, 444, 18th Main Rd, 6th Block, Koramangala, Bengaluru - 560095</p>
                <p className="mt-1 text-sm">Email: <a className="text-blue-700" href="mailto:privacy@juspay.in">privacy@juspay.in</a></p>
                </div>
                <div className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold">JUSPAY USA</h3>
                <p className="mt-2 text-sm">Juspay Technologies Inc.</p>
                <p className="text-sm">111B S Governors Ave STE 23409, Dover, DE 19904</p>
                </div>
                <div className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold">JUSPAY SINGAPORE</h3>
                <p className="mt-2 text-sm">Juspay Global PTE LTD</p>
                <p className="text-sm">160 ROBINSON ROAD, #20-03, SINGAPORE - 068914</p>
                <p className="mt-1 text-sm">Appointed Data Protection Officer: Shreya Pandey</p>
                <p className="text-sm">Email: <a className="text-blue-700" href="mailto:dpo-singapore@juspay.in">dpo-singapore@juspay.in</a></p>
                </div>
                <div className="rounded-lg border bg-white p-5">
                <h3 className="font-semibold">JUSPAY IRELAND</h3>
                <p className="mt-2 text-sm">Juspay Europe Limited</p>
                <p className="text-sm">29/30 Fitzwilliam Square, Dublin 2</p>
                <p className="mt-1 text-sm">Email: <a className="text-blue-700" href="mailto:juspaydpo@formiti.com">juspaydpo@formiti.com</a>; <a className="text-blue-700" href="mailto:privacy@juspay.in">privacy@juspay.in</a></p>
                </div>
            </div>
            </section>
        </main>
        </div>
        <Footer />
    </>
  );
};

export default PrivacyPolicyPage;
