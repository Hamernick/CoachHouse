import { z } from "zod"
import { buildFiscalSponsorshipApplicationDraft, FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS } from "./application-draft"
import { guestSubmissionSchema } from "./guest-submission-schema"

const applicationSchema = guestSubmissionSchema.shape.application
export type GuestApplicationAnswers = z.infer<typeof applicationSchema>
export const guestFollowupRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("read"), reference: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("resubmit"), reference: z.string().uuid(), requestId: z.string().uuid(),
    version: z.string().regex(/^[a-f0-9]{32}$/), application: applicationSchema }).strict(),
])
export const guestFollowupSchema = z.object({
  reference: z.string().uuid(), projectName: z.string(),
  status: z.enum(FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS.map((item) => item.value)),
  reviewNote: z.string().nullable(), version: z.string().regex(/^[a-f0-9]{32}$/),
  application: applicationSchema.nullable(),
}).strict()
export type GuestFollowup = z.infer<typeof guestFollowupSchema>
export const guestFollowupHref = (reference: string) => `/documentation/fiscal-sponsorship/application?application=${encodeURIComponent(reference)}`

export function parseGuestFollowup(value: unknown): GuestFollowup {
  const raw = z.object({ application: z.record(z.string(), z.unknown()).nullable() }).passthrough().parse(value)
  const application = raw.application === null ? null : Object.fromEntries(Object.entries(raw.application)
    .filter(([key]) => !["applicant_full_name", "estimated_budget_cents"].includes(key))
    .map(([key, field]) => [key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase()), field]))
  return guestFollowupSchema.parse({ ...raw, application })
}
export function guestCorrectionDraft(answers: GuestApplicationAnswers) {
  const { fundraisingGoal, ...fields } = answers
  const draft = buildFiscalSponsorshipApplicationDraft({ data: { projectId: "", projectName: "", applicantName: "" } })
  const values = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key,
    typeof value === "boolean" ? (value ? "yes" : "no") : value ?? (key === "legalEntityHas501c3" ? "unknown" : "")]))
  return { ...draft, ...values, fundraisingGoalDollars: (fundraisingGoal.amountCents / 100).toFixed(2), fundraisingGoalPeriod: fundraisingGoal.period }
}
