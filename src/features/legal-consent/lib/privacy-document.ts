import type { LegalDocument } from "../types"
import {
  LEGAL_DOCUMENT_EFFECTIVE_DATE,
  LEGAL_DOCUMENT_VERSION,
} from "./version"

export const PRIVACY_DOCUMENT: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  description:
    "This Policy explains what personal information Coach House handles, why we use it, how it is disclosed, and the choices available to you.",
  effectiveDate: LEGAL_DOCUMENT_EFFECTIVE_DATE,
  version: LEGAL_DOCUMENT_VERSION,
  sha256: "dd58c9175fd80b067658f07e503883f4f983c357413092e1533df8aeeccc0135",
  sections: [
    {
      id: "scope",
      heading: "Scope and our role",
      body: [
        'This Privacy Policy applies to Coach House websites, applications, communications, and services operated by Coach House Solutions Group ("Coach House," "we," "us," or "our"). It does not govern third-party sites or services that have their own privacy policies.',
        "For account, product, billing, security, and direct-support information, Coach House determines why and how information is handled. An organization may separately control information its administrators and members place in an organization workspace. In that situation, contact the organization first about its decisions; we assist it as required by law and our agreement.",
      ],
    },
    {
      id: "information",
      heading: "Information we collect",
      body: [
        "We collect information you provide, information generated when you use the service, information from organizations and integrations you connect with, and public or licensed source information used for nonprofit and resource discovery.",
      ],
      items: [
        "Identifiers and account information, including name, email address, authentication records, account role, organization membership, profile image, and consent records.",
        "Organization and workspace information, including profiles, programs, team records, notes, roadmaps, tasks, policies, documents, media, public-page settings, invitations, and collaboration activity.",
        "Financial and transaction information, including budgets, revenue or expense activity, source and freshness records, donation or payer references, financial evidence, tax or fiscal documents, subscription status, invoice details, and payment-processor identifiers. Coach House does not receive or store full payment-card numbers entered into Stripe.",
        "Communications, including support requests, survey or feedback responses, email preferences, and messages you send through the service.",
        "Device, network, and usage information, including IP address, browser and device characteristics, pages and features used, referring pages, timestamps, errors, performance measurements, authentication events, and security logs.",
        "Location information when you choose a location feature, plus organization addresses, service areas, map searches, and map viewport requests.",
        "Information from integrations and third-party sources, such as payment status from Stripe, authentication events from Supabase, basic identity and profile information from Google when you choose Google Sign-In, public resource directories, provider websites, public records, and information supplied by an organization administrator.",
      ],
    },
    {
      id: "sensitive-information",
      heading: "Sensitive information",
      body: [
        "Depending on the features you use, content may include precise device location, financial or tax records, account credentials, communications, and government or taxpayer identifiers in designated fiscal documents. We use sensitive information only to provide the requested feature, secure the service, comply with law, and other purposes permitted with your consent.",
        "Do not place sensitive information in public fields, ordinary notes, or AI prompts. Coach House is not intended to collect protected health information under HIPAA or information from children. If an organization uploads information about another person, it is responsible for having a lawful basis and giving required notice.",
      ],
    },
    {
      id: "purposes",
      heading: "How we use information",
      body: [
        "We use personal information only for reasonably necessary and proportionate purposes connected to the service and our legal obligations.",
      ],
      items: [
        "Create and authenticate accounts; manage organizations, roles, invitations, subscriptions, and preferences.",
        "Provide nonprofit discovery, maps, workspaces, education, documents, reporting, fiscal workflows, communications, and support requested by users.",
        "Process purchases, maintain transaction records, prevent duplicate or fraudulent charges, and reconcile payment status with Stripe.",
        "Personalize the experience, preserve selected settings, provide location-relevant results, and maintain records users choose to collect or share.",
        "Monitor reliability, measure performance, troubleshoot errors, prevent abuse, enforce access controls, investigate incidents, and protect users and the service.",
        "Communicate about accounts, security, transactions, service changes, support, and marketing where permitted; honor opt-outs and consent withdrawals.",
        "Comply with law, enforce agreements, respond to lawful requests, establish or defend claims, conduct audits, and maintain required fiscal, consent, and transaction evidence.",
        "Create aggregated or de-identified information that is not reasonably linkable to a person and use it for research, reporting, service planning, and improvement.",
      ],
    },
    {
      id: "legal-bases",
      heading: "Legal bases where required",
      body: [
        "Where a law requires a legal basis, we rely on performance of a contract to provide requested services; legitimate interests in security, support, administration, and improvement; compliance with legal obligations; consent for optional processing such as device location or certain communications; and protection of vital or legal interests when applicable.",
        "You may withdraw consent at any time, but withdrawal does not affect prior lawful processing and may prevent an optional feature from working.",
      ],
    },
    {
      id: "disclosures",
      heading: "How information is disclosed",
      body: [
        "We disclose information only as described below, at your direction, or as otherwise disclosed when information is collected. Service providers may use information only to provide contracted services and for other purposes permitted by their agreements and law.",
      ],
      items: [
        "Supabase provides authentication, database, storage, and related infrastructure.",
        "Google provides optional account sign-in. When you choose Google Sign-In, Google provides your verified email address, name, profile image, and Google account identifier so we can create, authenticate, secure, and link your Coach House account. Google also receives the site origin, OAuth client identifier, and device and network information needed to complete sign-in. Google Sign-In does not give Coach House access to Google Drive, Calendar, contacts, or email content.",
        "Vercel provides hosting, logs, performance monitoring, and privacy-oriented site analytics.",
        "Stripe processes payments and provides subscription, invoice, and transaction status. Stripe receives payment information directly under its own policy.",
        "Mapbox provides maps, geocoding, tiles, and map interactions and receives map requests and associated device and network information.",
        "Resend and Supabase deliver account, authentication, support, and permitted marketing email.",
        "hCaptcha may process interaction, device, and network information to detect automated abuse when CAPTCHA is enabled.",
        "OpenAI may process prompts, instructions, and relevant context when an authorized user invokes an AI-assisted feature.",
        "Professional advisers, auditors, insurers, contractors, and support providers may receive information when reasonably necessary and subject to confidentiality or legal duties.",
        "Government authorities or other parties may receive information when we reasonably believe disclosure is legally required or necessary to protect rights, safety, security, users, or the public.",
        "A successor may receive information as part of a merger, financing, reorganization, bankruptcy, or transfer of all or part of the service, subject to appropriate protections and notice where required.",
      ],
    },
    {
      id: "google-sign-in",
      heading: "Google Sign-In",
      body: [
        "Google Sign-In is optional. Coach House uses the basic Google identity information described above only to create, authenticate, secure, support, and link your Coach House account. We do not use Google identity information for advertising or sell it.",
        "You can use email and password instead. You may manage or revoke Coach House access through your Google Account, but revocation does not automatically delete your Coach House account or records we must retain. Google handles information under its own privacy policy, and Coach House's use of information received from Google follows applicable Google API Services User Data Policy requirements, including Limited Use requirements where applicable.",
      ],
    },
    {
      id: "google-drive",
      heading: "Google Drive",
      body: [
        "Google Drive is optional and requires separate permission from Google Sign-In. Coach House accesses files you explicitly choose through Google's file picker. We receive your Google account identifier and verified email address, and store selected file identifiers, names, file types, Google links, modification times, connection status, and the workspace and account that attached them. We use this information to connect and display the selected files in Documents; we do not browse your entire Drive.",
        "Where document import is available, choosing to import a supported file lets Coach House read that file's content and prepare it for your document editor. Saving the imported content stores a copy in your Coach House workspace. Authorized workspace members can access linked file details and saved copies according to workspace permissions; public sharing follows the settings you or an administrator choose. Linking or importing a file does not change its Google sharing permissions, edit the Google original, or send it to AI providers.",
        "Drive connection credentials are encrypted and restricted by server-side authorization. Disconnecting Drive removes its stored refresh credential and stops further access through that connection. It does not delete your Google files, disconnect Calendar or Google Sign-In, or remove file links and imported copies already saved in a workspace. Those workspace records remain until removed under the retention and deletion practices described below. Google may apply account-wide revocation to other Coach House Google integrations.",
        "Coach House does not sell Drive data or use it for advertising. We use it to provide the file connection and import features you request, subject to the Google API Services User Data Policy, including applicable Limited Use requirements. Google handles information under its own privacy policy; the service providers described in this Policy support Coach House's hosting and storage.",
      ],
    },
    {
      id: "google-calendar",
      heading: "Google Calendar",
      body: [
        "Google Calendar is optional and requires separate permission from Google Sign-In. When you connect it, Coach House receives your Google account identifier and verified email address, a list of calendars you can access, and event information from the calendars you select. We store calendar names and identifiers, time zones, event titles, dates, start and end times, all-day status, links to Google events, and sync information to display and refresh your private agenda.",
        "Connection credentials are encrypted, and server-side authorization restricts access to stored Calendar data. Imported personal events are visible only to you in Coach House; they are not added to shared organization boards or public pages. Coach House does not sell Calendar data, use it for advertising, or send it to AI providers for this integration. Our use of Google data follows the Google API Services User Data Policy, including applicable Limited Use requirements.",
        "Turning sync off pauses updates and hides imported events while retaining your connection and selections. Disconnecting removes the stored refresh credential and event cache from active storage. It does not delete events in Google Calendar or disconnect Google Sign-In or Drive. Connection identifiers and prior export mappings may remain to support reconnection without duplicate exports. You can also revoke access in your Google Account; Google may apply that revocation to other Coach House Google integrations.",
        "If you enable optional board export, Coach House sends your selected workspace's board event details to a separate Google calendar it creates for that purpose. Coach House updates its exported events when those board events change. It does not edit your existing Google-native events. Google processes information under its own privacy policy, and your Google sharing settings control access to the exported calendar.",
      ],
    },
    {
      id: "organization-public-sharing",
      heading: "Organization access and public sharing",
      body: [
        "Organization owners, administrators, coaches, and authorized collaborators may access information according to their roles. Information created for an organization may remain with that organization if a member leaves. Organizations are responsible for configuring roles and public settings appropriately.",
        "Information you or an administrator marks public can be viewed, indexed, copied, and shared outside Coach House. This may include an organization profile, programs, team information, contact details, location, public documents, resource listings, or roadmap content. Private workspace and designated fiscal documents are not made public merely because an organization has a public profile.",
      ],
    },
    {
      id: "location",
      heading: "Location and maps",
      body: [
        "Device location is optional and requires browser permission. Coach House currently uses raw device coordinates in browser memory to center the map and does not store those raw coordinates in your account or Coach House database. The browser may retain a permission choice, and Coach House may retain a local indication that the prompt was answered.",
        "Mapbox and network providers receive map, tile, viewport, IP, and device requests needed to render the map. You can deny or revoke browser location permission and search manually. Organization addresses, provider locations, and service areas that users submit or sources publish are separate from device location.",
      ],
    },
    {
      id: "ai-processing",
      heading: "AI-assisted processing",
      body: [
        "When an authorized user chooses an AI-assisted feature, Coach House may send the prompt, instructions, and relevant context to OpenAI or another provider identified at the feature. We use the response to provide the requested function, support safety, and troubleshoot the service.",
        "Do not include confidential, regulated, or sensitive personal information in an AI prompt unless the feature expressly requests it and you are authorized to disclose it. AI output is not used as the sole basis for legal or similarly significant decisions about a person.",
      ],
    },
    {
      id: "cookies-storage-analytics",
      heading: "Cookies, local storage, and analytics",
      body: [
        "We use cookies and similar browser storage for authentication, security, active-organization selection, theme and interface preferences, onboarding state, map permission state, and other functions you request. Disabling required storage may prevent sign-in or features from working.",
        "Vercel Analytics, Speed Insights, application telemetry, and server logs help us understand aggregate use, performance, and errors. We do not use third-party advertising pixels for cross-site behavioral advertising. Browser privacy controls may limit some measurement.",
      ],
    },
    {
      id: "communications",
      heading: "Communications and preferences",
      body: [
        "We send transactional and relationship communications for authentication, invitations, purchases, security, support, and material service changes. These are not marketing and may continue while necessary to provide or secure an account.",
        "Marketing email includes an unsubscribe or preference mechanism where required. We honor valid email opt-outs while retaining evidence needed to suppress future marketing. If we offer automated marketing calls or texts, we will obtain any required consent separately and honor reasonable revocation requests, including STOP for covered texts.",
      ],
    },
    {
      id: "sale-advertising",
      heading: "Sale, sharing, and targeted advertising",
      body: [
        "Coach House does not sell personal information for money and does not share personal information for cross-context behavioral advertising as those terms are defined by applicable U.S. state privacy laws. We do not knowingly sell or share personal information of people under 18.",
        "Disclosures to service providers, organization collaborators, and third parties you direct are not treated as sales when the law provides an applicable exception. If our practices change, we will update this Policy and provide required opt-out controls before the change applies.",
      ],
    },
    {
      id: "retention",
      heading: "Retention and deletion",
      body: [
        "We retain each category only as long as reasonably necessary for the purposes described above, considering account status, organization instructions, contractual commitments, legal and fiscal recordkeeping, security, dispute and fraud prevention, source provenance, and backup schedules.",
      ],
      items: [
        "Account, workspace, and organization content is generally retained while the account or organization is active and for a limited period afterward to support recovery, export, disputes, and deletion workflows.",
        "Consent, transaction, subscription, fiscal, tax, audit, and security evidence may be retained longer when necessary to comply with law, document authorization, prevent fraud, or establish and defend claims.",
        "Operational logs, analytics, support records, and local browser preferences are retained according to their purpose and configured lifecycle, then deleted, aggregated, or de-identified.",
        "Public-source and resource records may be retained for attribution, provenance, correction, safety, and unpublish history even after they are no longer publicly displayed.",
        "Backups are protected and expire on a managed schedule. Deletion from active systems may not immediately remove information from backups, legal holds, or records another organization controls.",
      ],
    },
    {
      id: "security-breaches",
      heading: "Security and incident notice",
      body: [
        "We use administrative, technical, and organizational safeguards designed for the nature of the information, including server-side authorization, row-level access controls, encrypted transport, restricted storage access, signed links, audit evidence, and service monitoring. No system is completely secure.",
        "If a security incident affects personal information, we will investigate, contain, document, and provide notice to affected people and regulators when required by applicable law. Notify us promptly if you believe an account or information has been compromised.",
      ],
    },
    {
      id: "rights",
      heading: "Your choices and privacy rights",
      body: [
        "Depending on where you live and subject to exceptions, you may have rights to know or access personal information; receive a portable copy; correct inaccuracies; delete information; withdraw consent; opt out of sale, sharing, targeted advertising, or certain profiling; limit certain sensitive-information uses; appeal a denied request; and receive equal service without unlawful discrimination.",
        "You can update some information in the service, manage email preferences through message links, revoke browser location permission in browser settings, or submit a request to joel@coachhousesolutions.org. Describe the right and account involved. We may verify identity and authority, use information only for verification, and ask an authorized agent for proof. We will respond within the time required by applicable law and explain any denial or appeal method.",
      ],
    },
    {
      id: "state-notice",
      heading: "U.S. state privacy notice",
      body: [
        "The categories collected in the preceding 12 months are the categories listed in Information we collect, including identifiers; customer and commercial records; internet or electronic activity; approximate or precise geolocation when enabled; professional or organization information; user content; and sensitive information described above. Sources, purposes, recipient categories, and retention criteria are also described in this Policy.",
        "We do not offer a financial incentive for personal information. We do not sell or share personal information for cross-context behavioral advertising, so there is no sale or sharing to opt out of under our current practices. Where state law applies, eligible residents may exercise the rights described above and may contact us to appeal a decision.",
      ],
    },
    {
      id: "children",
      heading: "Children",
      body: [
        "Coach House is intended for adults and is not directed to children under 13. Accounts require users to be at least 18. We do not knowingly collect personal information from children. If you believe a child provided personal information, contact us so we can investigate and delete it as required.",
      ],
    },
    {
      id: "international",
      heading: "International use",
      body: [
        "Coach House is operated from the United States. If you access it from another country, information may be processed in the United States and other locations where our providers operate. Where required, we use lawful transfer mechanisms and protections. You are responsible for determining whether organizational use is permitted in your jurisdiction.",
      ],
    },
    {
      id: "changes-contact",
      heading: "Changes and contact",
      body: [
        "We may update this Policy to reflect service, legal, or operational changes. We will post the new effective date and provide additional notice or request consent when required. Materially different practices will not be applied retroactively without an appropriate legal basis.",
        "Questions, privacy requests, and security reports may be sent to joel@coachhousesolutions.org. Please do not email sensitive documents or credentials; we will provide a safer submission method when needed.",
      ],
    },
  ],
}
