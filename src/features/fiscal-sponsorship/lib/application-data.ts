import type { FiscalSponsorshipProgramOption } from "../types"

export const FISCAL_SPONSORSHIP_HANDBOOK_HREF = "/fiscal-sponsorship/handbook"

export const FISCAL_SPONSORSHIP_HANDBOOK_DOWNLOAD_HREF =
  "/fiscal-sponsorship/2026-ch-fiscal-sponsorship-handbook.md"

export const FISCAL_SPONSORSHIP_HANDBOOK_NAV_ITEMS = [
  {
    id: "fs-how-this-works",
    label: "How this works",
    description: "Model C, ownership, control, fundraising, revenue.",
  },
  {
    id: "fs-what-we-look-for",
    label: "What we look for",
    description: "Public benefit, fit, noncommercial alignment.",
  },
  {
    id: "fs-requirements",
    label: "Requirements",
    description: "Eligibility, legal structures, U.S. operations.",
  },
  {
    id: "fs-agreement-template",
    label: "Agreement",
    description: "Grant agreement terms and signing source language.",
  },
  {
    id: "fs-fundraising-approval-disclosure",
    label: "Fundraising",
    description: "Approval rules and required disclosure language.",
  },
  {
    id: "fs-grant-request-template",
    label: "Grant requests",
    description: "Grant request data, documentation, certifications.",
  },
  {
    id: "fs-ch-internal-controls",
    label: "Internal controls",
    description: "Project setup, receipts, approvals, disbursement.",
  },
] as const

export const FISCAL_SPONSORSHIP_HANDBOOK_GUIDE_SECTIONS = [
  {
    id: "fs-how-this-works",
    eyebrow: "Model",
    title: "Our Fiscal Sponsorship Model",
    markdown: `Coach House fiscally sponsors community-based, civic, and mission-driven projects that are charitable in nature, primarily noncommercial, and aligned with a clear public benefit.

The program is structured as a **Model C grantor-grantee relationship**:

- Coach House serves as the fiscal sponsor and grantor.
- The project or organization serves as the sponsored entity and grantee.
- Donors, foundations, corporations, or public entities give to Coach House for the benefit of the approved project.
- Coach House then makes charitable grants to support approved project expenses.

This lets projects without their own 501(c)(3) status receive tax-deductible donations, apply for many grants, establish financial credibility, and operate with appropriate oversight.

While fiscally sponsored, the project keeps ownership and day-to-day control of its work. Coach House provides financial oversight, compliance guardrails, and review of fundraising materials. The relationship is not a partnership, joint venture, or employment arrangement.`,
  },
  {
    id: "fs-what-we-look-for",
    eyebrow: "Eligibility",
    title: "What Coach House Needs To Confirm",
    markdown: `A project must serve a clear public benefit and be charitable in nature, consistent with Section 501(c)(3) of the Internal Revenue Code.

To be considered, the applicant must:

- Be engaged with Coach House through an approved intake pathway.
- Submit a complete application with project description, leadership background, preliminary budget, and intended fundraising activities.
- Operate for a charitable purpose.
- Be primarily non-commercial.
- Align with Coach House mission, values, risk standards, and readiness expectations.

Projects should not present legal, financial, or compliance risks that cannot be reasonably managed under fiscal sponsorship.`,
  },
  {
    id: "fs-requirements",
    eyebrow: "Tax ID",
    title: "Legal Structure And U.S. Requirements",
    markdown: `The applicant must identify the legal entity and U.S. tax identification number associated with the sponsored project for tax reporting.

Coach House can review projects operating as:

- Individual / sole proprietor
- Informal group with an EIN
- Limited liability company
- Corporation
- Partnership

Activities outside the United States and lobbying require an explanation for individual review; neither automatically prevents an application. The project must have a valid U.S. mailing address, working email address, internet access, and the ability to submit required information in writing.`,
  },
  {
    id: "fs-agreement-template",
    eyebrow: "Agreement",
    title: "Agreement Template Inputs",
    markdown: `The Model C agreement is prepared from the approved application and incorporated policies.

The template needs:

- Legal name of the sponsored entity or individual
- Project name and approved charitable activities
- Legal status and tax reporting identity
- Fundraising and solicitation commitments
- Administrative fee terms
- Reporting, recordkeeping, and prohibited activity acknowledgements
- Applicant signature and Coach House countersignature

This means the application step should collect data once, then prefill the agreement instead of forcing staff to transfer answers manually.`,
  },
  {
    id: "fs-fundraising-approval-disclosure",
    eyebrow: "Fundraising",
    title: "Approval And Disclosure",
    markdown: `All fundraising solicitations, grant applications, sponsorship requests, donation pages, and related materials referencing Coach House must be reviewed and approved in writing before submission or publication.

Approved materials should clearly disclose the fiscal sponsorship relationship. The short disclosure pattern is:

> [Project Name] is fiscally sponsored by Coach House Solutions Group, a 501(c)(3) nonprofit organization. All donations are tax-deductible to the extent permitted by law and are made to Coach House Solutions Group in support of [Project Name].

Applicants may not represent themselves as a 501(c)(3), use Coach House's EIN without written authorization, or make commitments on behalf of Coach House.`,
  },
  {
    id: "fs-grant-request-template",
    eyebrow: "Grant request",
    title: "Grant Requests After Approval",
    markdown: `After approval and execution of the agreement, the project submits grant requests for approved project expenses.

The request needs the amount, intended disbursement date, payment method, use of funds, timeframe, supporting documentation, and certification that the funds will be used only for approved project purposes.`,
  },
  {
    id: "fs-ch-internal-controls",
    eyebrow: "Controls",
    title: "Internal Controls And Disbursement",
    markdown: `Coach House maintains internal controls for project setup, restricted fund tracking, donor acknowledgment, grant review, approval authority, and post-disbursement oversight.

The product flow should capture the data needed for:

- Internal project setup and restricted fund records
- External onboarding and grantee responsibilities
- Receipt, review, deposit, and recording of funds
- Donor acknowledgment and disclosure language
- Grant request review, approval, and payment documentation
- Post-disbursement reporting and issue follow-up`,
  },
] as const

export const FISCAL_SPONSORSHIP_PREFILL_ITEMS = [
  {
    id: "organization-profile",
    label: "Organization profile",
    description:
      "Organization title, formation status, EIN, email, phone, mailing address, mission, need, origin story, and public boilerplate.",
  },
  {
    id: "program-data",
    label: "Programs / projects / initiatives",
    description:
      "Project name, description, location, dates, public status, and funding goal from the Programs card.",
  },
  {
    id: "document-library",
    label: "Documents",
    description:
      "Formation documents, handbook, application packet, agreement, disclosure policy, and grant request templates.",
  },
] as const

export const FISCAL_SPONSORSHIP_MISSING_APPLICATION_SECTIONS = [
  {
    id: "applicant-contact",
    title: "Applicant contact",
    description:
      "Confirm the person responsible for the sponsorship relationship.",
    fields: [
      "First name",
      "Last name",
      "Mailing address line 2, if needed",
      "Phone number",
      "Primary email address",
    ],
  },
  {
    id: "legal-tax",
    title: "Legal entity and tax status",
    description:
      "Confirm who receives grants and what tax reporting identity applies.",
    fields: [
      "Legal entity type",
      "Whether the legal entity already has 501(c)(3) status",
      "U.S. tax ID confirmation",
      "Formation or good-standing documents, when applicable",
    ],
  },
  {
    id: "project-scope",
    title: "Project scope",
    description:
      "Capture the approved charitable project, not just the organization.",
    fields: [
      "Project, program, or initiative name",
      "Temporary or ongoing / multi-year status",
      "Date range for temporary or one-time work",
      "Issue or focus area",
      "Project location if different from mailing address",
    ],
  },
  {
    id: "budget-funding",
    title: "Budget and funding",
    description:
      "Convert planning assumptions into the agreement and grant request templates.",
    fields: [
      "Anticipated fundraising amount (USD)",
      "Monthly, Annually, or Total",
      "Prospective sources of funding",
      "Preliminary fundraising materials that mention Coach House",
    ],
  },
  {
    id: "benefit-leadership-history",
    title: "Public benefit and readiness",
    description: "Support Coach House review and future document generation.",
    fields: [
      "Public benefit and community impact",
      "Leadership experience or relevant background",
      "Brief history of the initiative",
    ],
  },
  {
    id: "risk-attestations",
    title: "Eligibility attestations",
    description:
      "Identify activities that need explanation and individual review.",
    fields: [
      "Plans to operate outside the United States",
      "Plans to engage in lobbying activities",
      "Known legal, compliance, or financial concerns",
      "Explanation for any concern marked yes",
    ],
  },
] as const

export function formatFiscalSponsorshipProgramAmount(cents?: number | null) {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) {
    return null
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function resolveFiscalSponsorshipProgramLocation(
  program: FiscalSponsorshipProgramOption
) {
  const explicitLocation = program.location?.trim()
  if (explicitLocation) return explicitLocation

  const addressParts = [
    program.addressCity,
    program.addressState,
    program.addressCountry,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)

  if (addressParts.length > 0) return addressParts.join(", ")
  if (program.locationType === "online") return "Online"

  return "Location needed"
}
