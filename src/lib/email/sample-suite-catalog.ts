import { buildOrganizationAccessEmailPreviews } from "@/features/organization-access/client"
import { buildCoachingBookingEmail } from "@/features/coaching-booking/client"
import { buildEmailOpsCampaignEmail, emailOpsSampleCampaignIds, findEmailOpsCampaign } from "@/features/email-ops/client"
import { buildFiscalSignatureEmail, fiscalApplicantEmail, fiscalStaffEventEmail, reviewerEmailDigest } from "@/features/fiscal-sponsorship/client"
import type { EmailSample, EmailSampleException } from "./sample-suite"

const SITE = "https://coachhouse.app"
const INERT_LINK = "https://example.com/coach-house-email-preview"
const projectName = "Neighborhood Learning Collective"
const reviewSnapshot = {
  project_name: projectName, applicant_full_name: "Alex Rivera", primary_email: "alex@example.com",
  received_at: "2026-10-16T20:00:00.000Z", project_location: "Chicago, Illinois", focus_area: "Youth education",
  fundraising_goal: { amountCents: 7500000, period: "annually" }, project_duration_type: "ongoing_multi_year",
  project_description: "Free after-school tutoring and creative workshops for middle-school students, hosted with neighborhood partners.",
  public_benefit: "Students can access consistent academic support without cost, with priority for families underserved by existing programs.",
  prospective_funding_sources: "Individual donations, local business sponsorships, and community foundation grants.",
  expense_summary: "Educator stipends, learning materials, accessible space, insurance, and program administration.",
  leadership_background: "Led by educators and neighborhood volunteers with experience running youth programs.",
  initiative_history: "A volunteer pilot served 24 students over eight weeks. The team is preparing a year-round program.",
  legal_entity_type: "individual", legal_entity_has_501c3: false, formation_status: null,
  operates_outside_united_states: false, engages_in_lobbying: false, has_legal_compliance_financial_concerns: false,
}
const { received_at: _receivedAt, ...applicationSnapshot } = reviewSnapshot
const receiptSnapshot = {
  ...applicationSnapshot, applicant_first_name: "Alex", applicant_last_name: "Rivera",
  mailing_street_address: "123 Example Street", mailing_city: "Chicago", mailing_state: "IL", mailing_postal_code: "60601",
}

export const EMAIL_SAMPLE_EXCEPTIONS: EmailSampleException[] = [
  { provider: "Supabase Auth", limitation: "Six auth templates are rendered with inert fixture links. These samples do not create tokens, accounts, or password resets and do not prove hosted auth template synchronization." },
  { provider: "Google Calendar", limitation: "Calendar invitations and change notices are provider-generated. No events or invitations are created by this suite; their layout is outside the application renderer." },
  { provider: "Stripe", limitation: "Receipts and invoices use Stripe-managed branding. No payments, subscriptions, invoices, or billing events are created by this suite. Provider preview coverage requires separate verification." },
  { provider: "DocuSeal", limitation: "Legacy signing-email helper has no active source callers. No signing packet is created. The active application-owned signature-request email is included." },
  { provider: "Email Ops", limitation: "Three existing draft/review/paused campaign previews are samples only. Sending samples does not enable bulk delivery or publish campaigns." },
]

/** Keep sample layout/content identical to production; replace every actionable destination. */
export function inertEmailSample(sample: EmailSample): EmailSample {
  const href = `${INERT_LINK}/${sample.id}`
  const replaceTokens = (value: string) => value.replace(/{{[\s\S]*?}}/g, "SAMPLE-NOT-A-TOKEN")
  return { ...sample,
    html: replaceTokens(sample.html).replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])(.*?)\2/gi, `$1"${href}"`),
    text: replaceTokens(sample.text).replace(/https?:\/\/[^\s<>]+/g, href),
  }
}

export function buildEmailSampleCatalog(): EmailSample[] {
  const samples: EmailSample[] = buildOrganizationAccessEmailPreviews(SITE).map((preview) => ({
    id: preview.id, category: preview.family, state: preview.title, source: "organization-access/client",
    subject: preview.subject, html: preview.html, text: preview.text,
  }))
  for (const audience of ["attendee", "coach"] as const) samples.push({
    id: `coaching-booking-${audience}`, category: "coaching", state: `${audience} confirmation`, source: "coaching-booking/client",
    ...buildCoachingBookingEmail({ audience, siteUrl: SITE, attendeeEmail: "alex@example.com", startsAt: "2026-11-03T19:00:00Z", endsAt: "2026-11-03T20:00:00Z", timezone: "America/Chicago", googleEventHtmlLink: INERT_LINK, googleMeetUrl: INERT_LINK, attendeeNotes: "Discuss the funding plan and next steps for the neighborhood program." }),
  })
  for (const corrections of [false, true]) samples.push({
    id: corrections ? "fs-reviewer-corrections" : "fs-reviewer-new", category: "fiscal staff", state: corrections ? "corrections received" : "new application", source: "fiscal-sponsorship/client",
    ...reviewerEmailDigest(reviewSnapshot, `${SITE}/projects/sample`, corrections),
  })
  for (const kind of ["applicant_receipt", "applicant_recovery"] as const) samples.push({
    id: `fs-${kind.replaceAll("_", "-")}`, category: "fiscal applicant", state: kind, source: "fiscal-sponsorship/client",
    ...fiscalApplicantEmail({ kind, projectName, verificationUrl: `${SITE}/documentation/fiscal-sponsorship`, ...(kind === "applicant_receipt" ? { receiptSnapshot } : {}) }),
  })
  for (const eventType of ["application_needs_info", "application_approved", "application_declined", "application_submitted", "application_updated"]) samples.push({
    id: `fs-applicant-${eventType.replaceAll("_", "-")}`, category: "fiscal applicant", state: eventType, source: "fiscal-sponsorship/client",
    ...fiscalApplicantEmail({ kind: "applicant_update", projectName, verificationUrl: `${SITE}/documentation/fiscal-sponsorship`, eventType }),
  })
  samples.push({ id: "fs-signature-request", category: "fiscal applicant", state: "signature requested", source: "fiscal-sponsorship/client", ...buildFiscalSignatureEmail({ siteUrl: SITE, projectName, signingUrl: INERT_LINK }) })
  for (const eventType of ["application_approved", "application_needs_info", "application_declined", "document_connected", "document_reviewed", "agreement_ready", "agreement_sent", "agreement_signed", "agreement_countersigned", "agreement_completed", "w9_completed", "workflow_updated"]) samples.push({
    id: `fs-staff-${eventType.replaceAll("_", "-")}`, category: "fiscal staff", state: eventType, source: "fiscal-sponsorship/client", ...fiscalStaffEventEmail({ eventType, projectName, url: `${SITE}/projects/sample` }),
  })
  for (const id of emailOpsSampleCampaignIds) {
    const campaign = findEmailOpsCampaign(id)
    if (!campaign) throw new Error(`Missing email sample campaign: ${id}`)
    samples.push({ id: `draft-${id}`, category: "campaign draft", state: campaign.status, source: "email-ops/client", ...buildEmailOpsCampaignEmail(campaign, SITE) })
  }
  return samples.map(inertEmailSample)
}
