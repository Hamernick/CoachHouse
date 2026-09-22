import type { LegalDocument } from "../types"
import {
  LEGAL_DOCUMENT_EFFECTIVE_DATE,
  LEGAL_DOCUMENT_VERSION,
} from "./version"

export const TERMS_DOCUMENT: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  description:
    "These Terms govern access to Coach House's nonprofit discovery, organizational, educational, reporting, and related services.",
  effectiveDate: LEGAL_DOCUMENT_EFFECTIVE_DATE,
  version: LEGAL_DOCUMENT_VERSION,
  sha256: "8757308d709eac552572d79642b0374f6c41ee7c5277b50b961ce9948577e03c",
  sections: [
    {
      id: "agreement",
      heading: "Agreement and eligibility",
      body: [
        'These Terms of Service form a binding agreement between you and Coach House Solutions Group ("Coach House," "we," "us," or "our"). By creating an account, accepting these Terms, or using the service, you agree to these Terms and acknowledge the Privacy Policy.',
        "You must be at least 18 years old and legally able to enter this agreement. If you use Coach House for an organization, you represent that you have authority to bind that organization. The organization is responsible for activity by its authorized users.",
      ],
    },
    {
      id: "service-scope",
      heading: "What Coach House provides",
      body: [
        "Coach House provides nonprofit discovery, organization workspaces, educational materials, document tools, source-labeled reporting, fiscal-sponsorship workflows, and related support. Features may change as the service develops.",
        "Coach House is not a bank, payment processor, investment adviser, law firm, accounting firm, grant maker, government agency, emergency service, or healthcare provider. Unless a separate signed agreement says otherwise, Coach House does not hold, transfer, or control user funds. Stripe and other third parties process payments. A separate fiscal sponsorship or services agreement controls if it conflicts with these Terms.",
      ],
    },
    {
      id: "accounts",
      heading: "Accounts and organization access",
      body: [
        "Provide accurate information, keep credentials confidential, use individual accounts rather than shared credentials, and promptly report suspected unauthorized access. You are responsible for activity under your account until you notify us of compromise.",
        "Organization owners and administrators control membership, roles, workspace access, and some organization data. They may access, change, export, or remove information associated with their organization. Resolve role and ownership disputes with the organization; we may require evidence before changing administrative control.",
      ],
    },
    {
      id: "content",
      heading: "Your content and sharing choices",
      body: [
        "You retain ownership of content you submit. You grant Coach House a non-exclusive, worldwide, royalty-free license to host, copy, process, transmit, display, and create technical derivatives of that content only as reasonably needed to operate, secure, support, and improve the service, comply with law, and carry out the sharing or publication settings you choose.",
        "You represent that you have the rights and permissions needed to submit the content, including personal information about team members, donors, clients, or other people. Public profiles, programs, resources, documents, or roadmaps can be viewed and copied by others. Review public settings before publishing.",
      ],
    },
    {
      id: "sensitive-data",
      heading: "Sensitive and regulated information",
      body: [
        "Submit sensitive information only through a feature that expressly requests it, only when necessary, and only when you are authorized to do so. Designated fiscal, tax, document, and financial-evidence features may request sensitive records. Do not place payment-card numbers, bank passwords, authentication secrets, consumer reports, or government identifiers in ordinary notes, public fields, or AI prompts.",
        "Coach House is not designed to receive protected health information under HIPAA or personal information from children. Do not submit either unless we first enter a written agreement that expressly authorizes the data and establishes required safeguards.",
      ],
    },
    {
      id: "ai",
      heading: "AI-assisted features",
      body: [
        "Some administrative or educational tools may use third-party artificial intelligence services. Information entered into an AI-assisted feature, together with relevant instructions or context, may be sent to the identified provider to generate a response.",
        "AI output may be inaccurate, incomplete, biased, or unsuitable. Review it before relying on or publishing it. Do not use AI output as legal, tax, accounting, investment, employment, eligibility, healthcare, safety, or other professional advice, or as the sole basis for a decision that materially affects a person.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      body: [
        "You may use Coach House only lawfully and in accordance with these Terms. You may not help another person engage in prohibited conduct.",
      ],
      items: [
        "Do not violate law, another person's privacy, intellectual-property rights, contractual rights, or civil rights.",
        "Do not impersonate others, misrepresent authority, submit deceptive fundraising or eligibility claims, or publish information you know is materially false.",
        "Do not upload malware, probe or bypass security, access data without authorization, interfere with service operation, or use credentials obtained from another person.",
        "Do not scrape, harvest, resell, or systematically copy the service or its data except through an authorized interface or written agreement.",
        "Do not use the service for harassment, exploitation, discrimination, illegal surveillance, spam, or content that threatens or facilitates harm.",
      ],
    },
    {
      id: "resources",
      heading: "Resource directory and third-party services",
      body: [
        "Resource listings and external opportunities are informational. We may use provider sites, public records, partner directories, and other sources, but we do not guarantee that a listing is current, available, accurate, safe, licensed, eligible for you, or endorsed by Coach House. Confirm critical details directly with the provider, and contact emergency services when appropriate.",
        "The service may link to or depend on third parties such as Google, Stripe, Supabase, Vercel, Mapbox, Resend, hCaptcha, and OpenAI. Their products, availability, terms, and privacy practices are their responsibility. Your use of a third-party service may create a separate agreement with that provider.",
      ],
    },
    {
      id: "payments",
      heading: "Fees, subscriptions, and refunds",
      body: [
        "Prices, billing frequency, renewal terms, and included services are shown before purchase. By purchasing, you authorize the disclosed charges and applicable taxes through our payment processor. Recurring subscriptions continue until canceled through the available billing tools or by contacting support before renewal.",
        "Except where law or the purchase terms require otherwise, charges for a completed billing period or delivered service are non-refundable. We may correct billing errors. Failure to pay may result in restricted access, but we will not intentionally delete organization content solely because a payment is overdue without reasonable notice and an opportunity to export where practicable.",
      ],
    },
    {
      id: "communications",
      heading: "Email, calls, and text messages",
      body: [
        "We may send account, security, transaction, support, and service notices needed to operate the service. You may unsubscribe from marketing email using the message link; required account and security notices may continue while your account is active.",
        "If Coach House later offers automated marketing calls or text messages, we will request any legally required prior express written consent separately. Marketing consent is not a condition of purchase. You may revoke consent through any reasonable method, including replying STOP to a covered text. Message and data rates may apply.",
      ],
    },
    {
      id: "coach-house-rights",
      heading: "Coach House materials and feedback",
      body: [
        "The service, software, branding, interface, templates, and Coach House-created materials are owned by Coach House or its licensors and protected by law. We grant you a limited, revocable, non-transferable right to use them for their intended purpose during your authorized access.",
        "If you provide feedback, you permit us to use it without restriction or compensation, but we will not identify you publicly as the source without permission.",
      ],
    },
    {
      id: "copyright",
      heading: "Copyright and rights complaints",
      body: [
        "If you believe content on Coach House infringes your rights, email the contact below with your contact information, identification of the protected work, the specific content and location, the basis for your claim, and a statement that the information is accurate. We may remove or restrict content while reviewing a good-faith complaint and may terminate repeat infringers where appropriate.",
      ],
    },
    {
      id: "termination",
      heading: "Suspension and termination",
      body: [
        "You may stop using the service and request account deletion. We may suspend or terminate access when reasonably necessary to address nonpayment, security risk, legal requirements, material breach, harm, or misuse. When practical, we will give notice and an opportunity to cure.",
        "Following termination, access ends and we may delete or de-identify information under the Privacy Policy, subject to backups, legal retention, organization ownership, fraud prevention, dispute resolution, and records required by a separate agreement. Provisions that by their nature should survive termination remain effective.",
      ],
    },
    {
      id: "disclaimers",
      heading: "Disclaimers",
      body: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." COACH HOUSE DISCLAIMS IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ANY WARRANTY ARISING FROM COURSE OF DEALING OR USAGE.',
        "We do not guarantee uninterrupted or error-free operation, funding or fundraising results, nonprofit or tax status, fiscal-sponsorship approval, resource availability, data supplied by users or third parties, or that educational materials or reports will meet your needs. Nothing in these Terms excludes a warranty that cannot lawfully be excluded.",
      ],
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      body: [
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, COACH HOUSE AND ITS DIRECTORS, OFFICERS, EMPLOYEES, CONTRACTORS, AND LICENSORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES; LOST PROFITS, REVENUE, DATA, GOODWILL, OR OPPORTUNITIES; OR THE COST OF SUBSTITUTE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY.",
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THEIR TOTAL LIABILITY ARISING FROM THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF $100 OR THE AMOUNT YOU PAID COACH HOUSE FOR THE SERVICE DURING THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. These limits do not apply where prohibited or to liability that cannot lawfully be limited.",
      ],
    },
    {
      id: "indemnity",
      heading: "Organization indemnity",
      body: [
        "If you use Coach House on behalf of an organization, that organization will defend, indemnify, and hold Coach House and its personnel harmless from third-party claims, damages, and reasonable costs arising from the organization's content, unlawful use, violation of another person's rights, or material breach of these Terms. This obligation does not apply to the extent a claim results from Coach House's own unlawful conduct, and it does not limit non-waivable consumer rights.",
      ],
    },
    {
      id: "disputes",
      heading: "Disputes and governing law",
      body: [
        "Before filing a claim, contact us and describe the issue so the parties can attempt to resolve it informally for 30 days. These Terms are governed by Illinois law, without regard to conflict-of-law rules. Unless applicable consumer law requires otherwise, claims must be brought in the state or federal courts located in Cook County, Illinois, and each party consents to their jurisdiction.",
        "Nothing in these Terms waives rights or remedies that applicable law does not permit you to waive. If any provision is unenforceable, it will be enforced to the maximum lawful extent and the remaining provisions will continue.",
      ],
    },
    {
      id: "changes-contact",
      heading: "Changes and contact",
      body: [
        "We may update these Terms to reflect service, legal, or operational changes. We will post the effective date and provide additional notice or request renewed acceptance when required. Continued use after an update becomes effective means you accept the revised Terms, except where law requires a different form of consent.",
        "Questions, notices, and rights complaints may be sent to joel@coachhousesolutions.org. Electronic notices to the email associated with your account are considered delivered when sent, subject to applicable law.",
      ],
    },
  ],
}
