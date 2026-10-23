import { z } from "zod"
import type { Json } from "@/lib/supabase"

const short = z.string().trim().max(200).nullable().optional()
const answer = z.string().trim().max(6000).nullable().optional()
const requiredAnswer = z.string().trim().min(1).max(6000)
const requiredShort = z.string().trim().min(1).max(200)
const date = z.iso.date().nullable().optional()

// Explicit public input contract: no caller-owned IDs, review status, metadata or snapshots.
export const guestSubmissionSchema = z.object({
  // Accept ignored tokens from forms loaded before CAPTCHA removal.
  captchaToken: z.string().max(10000).optional(),
  application: z.object({
    applicantFirstName: requiredShort, applicantLastName: requiredShort,
    primaryEmail: z.string().trim().toLowerCase().email().max(254),
    mailingStreetAddress: requiredShort, mailingStreetAddress2: short,
    mailingCity: requiredShort, mailingState: requiredShort, mailingPostalCode: requiredShort,
    phoneNumber: short,
    legalEntityType: z.enum(["individual", "corporation", "informal_group_with_ein", "llc", "partnership", "other"]),
    legalEntityHas501c3: z.boolean().nullable().optional(), formationStatus: short,
    projectName: requiredShort, projectDescription: requiredAnswer, projectLocation: short,
    projectDurationType: z.enum(["temporary", "ongoing_multi_year"]),
    temporaryStartDate: date, temporaryEndDate: date, focusArea: short,
    fundraisingGoal: z.object({ amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), period: z.enum(["monthly", "annually", "total"]) }).strict(),
    expenseSummary: answer, prospectiveFundingSources: requiredAnswer, publicBenefit: requiredAnswer,
    leadershipBackground: answer, initiativeHistory: answer,
    operatesOutsideUnitedStates: z.boolean(), engagesInLobbying: z.boolean(),
    hasLegalComplianceFinancialConcerns: z.boolean(), concernsExplanation: answer,
  }).strict().superRefine((value, context) => {
    if (value.legalEntityType !== "individual" && !value.formationStatus) {
      context.addIssue({ code: "custom", path: ["formationStatus"], message: "Choose a formation status." })
    }
    if ((value.operatesOutsideUnitedStates || value.engagesInLobbying || value.hasLegalComplianceFinancialConcerns) && !value.concernsExplanation) {
      context.addIssue({ code: "custom", path: ["concernsExplanation"], message: "Explain the answers marked Yes for review." })
    }
    if (value.projectDurationType === "temporary" && (!value.temporaryStartDate || (value.temporaryEndDate && value.temporaryEndDate < value.temporaryStartDate))) {
      context.addIssue({ code: "custom", path: [value.temporaryStartDate ? "temporaryEndDate" : "temporaryStartDate"], message: "Enter a valid project date range." })
    }
  }),
}).strict()

export function guestApplicationPayload(application: z.infer<typeof guestSubmissionSchema>["application"]): Json {
  const columnNames: Record<string, string> = {
    legalEntityHas501c3: "legal_entity_has_501c3",
    mailingStreetAddress2: "mailing_street_address_2",
  }
  const fields = Object.fromEntries(Object.entries(application).map(([key, value]) => [columnNames[key] ?? key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value ?? null]))
  return { ...fields, applicant_full_name: `${application.applicantFirstName} ${application.applicantLastName}`, estimated_budget_cents: application.fundraisingGoal.amountCents } as Json
}
