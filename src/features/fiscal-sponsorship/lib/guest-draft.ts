import { z } from "zod"
import type { FiscalSponsorshipApplicationDraft } from "./application-draft"

// Preserve unfinished input exactly. Submission has a separate, stricter contract.
const text = z.string().max(200)
const answer = z.string().max(6000)
const choice = z.enum(["unknown", "yes", "no"])
export const guestDraftSchema = z.object({
  applicantFirstName: text, applicantLastName: text, primaryEmail: z.string().max(254),
  mailingStreetAddress: text, mailingStreetAddress2: text, mailingCity: text,
  mailingState: text, mailingPostalCode: text, phoneNumber: text,
  legalEntityType: z.enum(["", "individual", "corporation", "informal_group_with_ein", "llc", "partnership", "other"]),
  legalEntityHas501c3: choice, formationStatus: text,
  projectName: text, projectDescription: answer, projectLocation: text,
  projectDurationType: z.enum(["", "temporary", "ongoing_multi_year"]),
  temporaryStartDate: z.string().max(10), temporaryEndDate: z.string().max(10), focusArea: text,
  fundraisingGoalDollars: z.string().max(40), fundraisingGoalPeriod: z.enum(["monthly", "annually", "total"]),
  expenseSummary: answer, prospectiveFundingSources: answer, publicBenefit: answer,
  leadershipBackground: answer, initiativeHistory: answer,
  operatesOutsideUnitedStates: choice, engagesInLobbying: choice,
  hasLegalComplianceFinancialConcerns: choice, concernsExplanation: answer,
}).partial().strict()

export type GuestFiscalDraft = z.infer<typeof guestDraftSchema>

export function pickGuestFiscalDraft(draft: FiscalSponsorshipApplicationDraft): GuestFiscalDraft {
  return guestDraftSchema.parse(Object.fromEntries(
    Object.keys(guestDraftSchema.shape).map((key) => [key, draft[key as keyof FiscalSponsorshipApplicationDraft]])
  ))
}

export const guestDraftRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("read") }).strict(),
  z.object({ operation: z.literal("save"), version: z.number().int().min(0).max(2147483646),
    requestId: z.string().uuid(), draft: guestDraftSchema }).strict(),
])

export const guestDraftResponseSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("draft"), version: z.number().int().nonnegative(),
    draft: guestDraftSchema, expiresAt: z.string().datetime({ offset: true }) }).strict(),
  z.object({ state: z.literal("submitted"), reference: z.string().uuid() }).strict(),
  z.object({ state: z.literal("conflict") }).strict(),
  z.object({ state: z.literal("expired") }).strict(),
])
