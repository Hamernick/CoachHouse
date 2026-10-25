import { z } from "zod"

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const date = z.iso.date()
const instant = z.iso.datetime()
const url = z.url({ protocol: /^https?$/ })
const periodSchema = z.strictObject({ startsOn: date, endsOn: date }).refine(value => value.startsOn <= value.endsOn, "Period must end after it starts.")
const knownAmountSchema = z.discriminatedUnion("state", [z.strictObject({ state: z.literal("known"), cents }), z.strictObject({ state: z.literal("unknown") })])
export const officialOpportunityNoticeSchema = z.strictObject({
  provider: z.literal("grants_gov"), externalId: z.string().min(1).max(200), title: z.string().min(1).max(500), agency: z.string().max(500), originalUrl: url,
  status: z.enum(["posted", "forecasted", "closed", "archived", "withdrawn", "unknown"]), summary: z.string().max(30000),
  valueKind: z.enum(["cash", "in_kind", "not_published"]), currency: z.string().regex(/^[A-Z]{3}$/),
  awardFloorCents: cents.nullable(), awardCeilingCents: cents.nullable(), fundingPoolCents: cents.nullable(), awardPeriod: periodSchema.nullable(),
  inKind: z.strictObject({ quantity: z.string().min(1).max(300), valuationCents: cents.nullable(), method: z.string().min(1).max(1000).nullable(), sourceUrl: url.nullable(), valuedAt: instant.nullable() }).nullable(),
  applicantTypes: z.array(z.strictObject({ id: z.string().min(1).max(80), description: z.string().max(1000) })).max(100), eligibilityText: z.string().max(30000),
  costSharing: z.boolean().nullable(), costShareRateBps: z.number().int().min(0).max(10000).nullable(), costShareBasis: z.enum(["award", "project"]).nullable(),
  postedDate: date.nullable(), updatedDate: date.nullable(), deadlineDate: date.nullable(), deadlineTimezone: z.string().min(1).max(100).nullable(), deadlineDescription: z.string().max(5000).nullable(),
  discoveredAt: instant, verifiedAt: instant, sourceRevision: z.string().max(500).nullable(),
  evidence: z.array(z.strictObject({ field: z.string().min(1).max(100), path: z.string().min(1).max(300), url, verifiedAt: instant })).max(100),
}).superRefine((value, ctx) => {
  if (value.awardFloorCents !== null && value.awardCeilingCents !== null && value.awardFloorCents > value.awardCeilingCents)
    ctx.addIssue({ code: "custom", message: "Award floor exceeds ceiling.", path: ["awardFloorCents"] })
  if (value.inKind?.valuationCents !== null && value.inKind?.valuationCents !== undefined && (!value.inKind.method || !value.inKind.sourceUrl || !value.inKind.valuedAt))
    ctx.addIssue({ code: "custom", message: "In-kind valuation requires a method, date and source.", path: ["inKind"] })
})
export const fundingNeedSchema = z.strictObject({
  resourceId: z.uuid(), resourceRevision: z.number().int().nonnegative(), requestedCents: cents.nullable(), currency: z.string().regex(/^[A-Z]{3}$/), period: periodSchema.nullable(),
  eligibleUnfundedCost: knownAmountSchema, matchingFunds: knownAmountSchema,
  eligibilityReview: z.enum(["confirmed", "not_met", "unknown"]).default("unknown"),
  restrictedCosts: z.enum(["confirmed", "excluded", "unknown"]), overlap: z.enum(["clear", "overlapping", "unknown"]), applicantTypeCode: z.string().min(1).max(80).nullable(),
  review: z.strictObject({ actorId: z.uuid(), reviewedAt: instant, noticeFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
})
export const fundingReviewInputSchema = fundingNeedSchema.omit({ review: true })
export type FundingReviewInput = z.infer<typeof fundingReviewInputSchema>
export const opportunityMatchSnapshotSchema = z.strictObject({
  provider: z.literal("grants_gov"), externalId: z.string().min(1).max(200), resourceId: z.uuid(), resourceRevision: z.number().int().nonnegative(), noticeRevision: z.string().max(500).nullable(),
  matchedAt: instant, rankingVersion: z.literal("deterministic-v1"), fit: z.enum(["potential", "needs_review", "not_eligible"]), active: z.boolean(),
  criteria: z.array(z.strictObject({ id: z.string().min(1).max(80), outcome: z.enum(["pass", "fail", "unknown"]), explanation: z.string().min(1).max(1500), evidenceFields: z.array(z.string().max(100)).max(10) })).max(30),
  coverage: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("comparable"), maximumCents: cents, gapCents: cents.positive(), maximumCoverageBps: z.number().int().min(0).max(10000), currency: z.string().regex(/^[A-Z]{3}$/) }),
    z.strictObject({ kind: z.literal("unavailable"), reasons: z.array(z.string().max(80)).max(30) }),
  ]),
})
export type OfficialOpportunityNotice = z.infer<typeof officialOpportunityNoticeSchema>
export type FundingNeed = z.infer<typeof fundingNeedSchema>
export type OpportunityMatchSnapshot = z.infer<typeof opportunityMatchSnapshotSchema>
export const resourceMatchTargetSchema = z.strictObject({ organizationId:z.uuid(), resourceId:z.uuid(), resourceRevision:z.number().int().nonnegative() })
export type ResourceMatchTarget = z.infer<typeof resourceMatchTargetSchema>
export type ResourceOpportunityMatch = { id:string; updatedAt:string; notice:OfficialOpportunityNotice; need:FundingNeed; assessment:OpportunityMatchSnapshot; status:"new"|"saved"|"dismissed"; stale:boolean; opportunityId:string|null }
