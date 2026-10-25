import type { FundingNeed, OfficialOpportunityNotice } from "@/features/workspace-finance/matching-types"
export const now = "2026-10-25T12:00:00.000Z"
export const period = { startsOn: "2027-01-01", endsOn: "2027-12-31" }
export function notice(): OfficialOpportunityNotice {
  const originalUrl = "https://www.grants.gov/search-results-detail/123"
  return { provider: "grants_gov", externalId: "123", title: "Fictional test notice", agency: "Fixture", originalUrl, status: "posted", summary: "Test only", valueKind: "cash", currency: "USD", awardFloorCents: 10000, awardCeilingCents: 1000000, fundingPoolCents: 100000000, awardPeriod: period, inKind: null, applicantTypes: [{ id: "12", description: "Nonprofits" }], eligibilityText: "Review all conditions", costSharing: false, costShareRateBps: null, costShareBasis: null, postedDate: "2026-10-01", updatedDate: "2026-10-20", deadlineDate: "2026-12-01", deadlineTimezone: null, deadlineDescription: null, discoveredAt: now, verifiedAt: now, sourceRevision: "1", evidence: ["awardFloorCents", "awardCeilingCents", "applicantTypes", "costSharing", "awardPeriod"].map(field => ({ field, path: field, url: originalUrl, verifiedAt: now })) }
}
export function need(): FundingNeed {
  return { resourceId: "00000000-0000-4000-8000-000000000001", resourceRevision: 3, requestedCents: 2500000, currency: "USD", period, eligibleUnfundedCost: { state: "known", cents: 2500000 }, matchingFunds: { state: "unknown" }, eligibilityReview: "confirmed", restrictedCosts: "confirmed", overlap: "clear", applicantTypeCode: "12" }
}
