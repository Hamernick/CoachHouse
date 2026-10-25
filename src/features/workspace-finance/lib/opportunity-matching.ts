import { fundingNeedSchema, officialOpportunityNoticeSchema, opportunityMatchSnapshotSchema, type FundingNeed, type OfficialOpportunityNotice, type OpportunityMatchSnapshot } from "../matching-types"

export const MATCH_FRESHNESS_MS = 7 * 86400000
/** Source facts and user assertions stay distinct; unknown requirements never become eligibility. */
export function matchOpportunity(input: OfficialOpportunityNotice, funding: FundingNeed, matchedAt = new Date().toISOString()): OpportunityMatchSnapshot {
  const notice = officialOpportunityNoticeSchema.parse(input), need = fundingNeedSchema.parse(funding)
  const now = Date.parse(matchedAt)
  if (!Number.isFinite(now)) throw new Error("Invalid match time.")
  const criteria: OpportunityMatchSnapshot["criteria"] = []
  const add = (id: string, outcome: "pass" | "fail" | "unknown", explanation: string, evidenceFields: string[] = []) => criteria.push({ id, outcome, explanation, evidenceFields })
  const evidenced = (field: string) => notice.evidence.some(item => item.field === field && item.url === notice.originalUrl && item.verifiedAt === notice.verifiedAt)
  const fresh = now - Date.parse(notice.verifiedAt) <= MATCH_FRESHNESS_MS && now >= Date.parse(notice.verifiedAt) - 300000
  const expired = notice.deadlineDate !== null && Date.parse(`${notice.deadlineDate}T00:00:00Z`) + 36 * 3600000 < now
  add("status", notice.status === "posted" ? "pass" : notice.status === "forecasted" ? "unknown" : "fail", notice.status === "forecasted" ? "Forecast only; the final notice may change." : `Official notice status: ${notice.status}.`, ["status"])
  add("freshness", fresh ? "pass" : "unknown", fresh ? "Official details were retrieved within seven days." : "Refresh the official notice before relying on these details.")
  const safelyBeforeDeadline = notice.deadlineDate !== null && now < Date.parse(`${notice.deadlineDate}T00:00:00Z`) - 14 * 3600000
  add("deadline", expired ? "fail" : safelyBeforeDeadline ? "pass" : "unknown", expired ? "The published deadline has passed." : safelyBeforeDeadline ? `Deadline: ${notice.deadlineDate}; confirm the notice's cutoff time.` : "The exact deadline or cutoff time needs confirmation.", ["deadlineDate"])
  const unrestricted = notice.applicantTypes.some(type => type.id === "99" && /unrestricted/i.test(type.description))
  const categoryKnown = evidenced("applicantTypes") && notice.applicantTypes.length > 0 && need.applicantTypeCode !== null
  const categoryMatches = unrestricted || notice.applicantTypes.some(type => type.id === need.applicantTypeCode)
  add("applicant", categoryKnown ? categoryMatches ? "pass" : "fail" : "unknown", categoryKnown ? categoryMatches ? "Your stated applicant category is listed in the notice; other requirements still apply." : "Your stated applicant category is not listed in the notice." : "Confirm your applicant category against the official notice.", ["applicantTypes"])
  add("eligibility", need.eligibilityReview === "confirmed" ? "pass" : need.eligibilityReview === "not_met" ? "fail" : "unknown", need.eligibilityReview === "confirmed" ? "You confirmed the full published requirements; this is a user assertion, not independent verification." : need.eligibilityReview === "not_met" ? "You reported that the published requirements are not met." : "Full eligibility, service area and project restrictions require review.", ["eligibilityText"])
  add("costs", need.restrictedCosts === "confirmed" ? "pass" : need.restrictedCosts === "excluded" ? "fail" : "unknown", need.restrictedCosts === "confirmed" ? "You confirmed these costs are eligible under this notice." : "Confirm whether the notice permits these costs.")
  add("overlap", need.overlap === "clear" ? "pass" : need.overlap === "overlapping" ? "fail" : "unknown", need.overlap === "clear" ? "You confirmed the stated need excludes already funded costs." : "Exclude already funded or overlapping costs before estimating coverage.")
  const gap = need.eligibleUnfundedCost.state === "known" ? need.eligibleUnfundedCost.cents : null
  const requested = need.requestedCents === null ? gap : gap === null ? need.requestedCents : Math.min(need.requestedCents,gap)
  add("minimum", notice.currency !== need.currency || notice.awardFloorCents === null || requested === null || !evidenced("awardFloorCents") ? "unknown" : requested < notice.awardFloorCents ? "fail" : "pass", notice.currency === need.currency && notice.awardFloorCents !== null && requested !== null && requested < notice.awardFloorCents ? "The published minimum exceeds your eligible request; it cannot be silently reduced." : "Compare the published award minimum with your eligible request.", ["awardFloorCents"])
  const periodMatches = Boolean(evidenced("awardPeriod") && notice.awardPeriod && need.period && notice.awardPeriod.startsOn === need.period.startsOn && notice.awardPeriod.endsOn === need.period.endsOn)
  const comparable = notice.currency === need.currency && periodMatches
  add("comparison", comparable ? "pass" : "unknown", comparable ? "Currency and funding period match." : "Currency and funding period must match; no exchange rate or period was assumed.", ["awardPeriod"])
  const cap = notice.awardCeilingCents
  const projectCap = notice.costSharing && notice.costShareBasis === "project" && notice.costShareRateBps !== null && gap !== null
    ? Number(BigInt(gap) * BigInt(10000 - notice.costShareRateBps) / BigInt(10000)) : Number.MAX_SAFE_INTEGER
  const maximum = Math.min(cap ?? 0, gap ?? 0, requested ?? Number.MAX_SAFE_INTEGER, projectCap)
  let share: "pass" | "fail" | "unknown" = "unknown"
  if (evidenced("costSharing") && notice.costSharing === false) share = "pass"
  else if (notice.currency === need.currency && notice.costSharing === true && notice.costShareRateBps !== null && notice.costShareBasis !== null && evidenced("costShareRateBps") && evidenced("costShareBasis") && gap !== null && cap !== null && need.matchingFunds.state === "known") {
    const award = BigInt(maximum), rate = BigInt(notice.costShareRateBps)
    const denominator = notice.costShareBasis === "award" ? BigInt(10000) : BigInt(10000) - rate
    if (denominator > BigInt(0)) {
      const required = (award * rate + denominator - BigInt(1)) / denominator
      share = BigInt(need.matchingFunds.cents) >= required ? "pass" : "fail"
    }
  }
  add("cost_share", share, share === "pass" ? notice.costSharing ? "Your stated matching funds cover the published share at this upper bound." : "The notice states no cost share is required." : share === "fail" ? "Your stated matching funds do not cover the published share." : "The cost-share amount, basis or available matching funds is unknown.", ["costSharing", "costShareRateBps", "costShareBasis"])
  if (notice.currency === need.currency && gap !== null && cap !== null && notice.awardFloorCents !== null && maximum < notice.awardFloorCents && evidenced("awardFloorCents"))
    add("minimum_after_restrictions", "fail", "The maximum eligible request after restrictions is below the published minimum.", ["awardFloorCents"])
  const reasons = criteria.filter(item => item.outcome !== "pass").map(item => item.id)
  if (notice.valueKind !== "cash" || cap === null || !evidenced("awardCeilingCents")) reasons.push("per_award_amount")
  if (gap === null || gap <= 0) reasons.push("eligible_unfunded_need")
  const coverage: OpportunityMatchSnapshot["coverage"] = reasons.length ? { kind: "unavailable", reasons } : {
    kind: "comparable", maximumCents: maximum, gapCents: gap!, maximumCoverageBps: Number(BigInt(maximum) * BigInt(10000) / BigInt(gap!)), currency: need.currency,
  }
  return opportunityMatchSnapshotSchema.parse({ provider: notice.provider, externalId: notice.externalId, resourceId: need.resourceId, resourceRevision: need.resourceRevision, noticeRevision: notice.sourceRevision, matchedAt, rankingVersion: "deterministic-v1", criteria,
    active: fresh && !expired && ["posted", "forecasted"].includes(notice.status), fit: criteria.some(item => item.outcome === "fail") ? "not_eligible" : criteria.some(item => item.outcome === "unknown") ? "needs_review" : "potential", coverage })
}

export function opportunityValueLabel(notice: OfficialOpportunityNotice) {
  const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: notice.currency, maximumFractionDigits: 2 }).format(cents / 100)
  if (notice.valueKind === "in_kind") return notice.inKind?.quantity ? `In-kind: ${notice.inKind.quantity}` : "In-kind support; value not published"
  if (notice.awardCeilingCents !== null) return notice.awardFloorCents !== null && notice.awardFloorCents > 0 ? `${money(notice.awardFloorCents)}–${money(notice.awardCeilingCents)} per award` : `Up to ${money(notice.awardCeilingCents)} per award`
  if (notice.awardFloorCents !== null) return `From ${money(notice.awardFloorCents)} per award; maximum not published`
  return "Amount not published"
}
