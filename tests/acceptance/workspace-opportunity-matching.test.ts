import { describe, expect, it } from "vitest"
import { matchOpportunity, opportunityValueLabel } from "@/features/workspace-finance/lib/opportunity-matching"
import { normalizeGrantsGovDetail } from "@/features/workspace-finance/lib/grants-gov-detail"
import { discoverOfficialOpportunities } from "@/features/workspace-finance/server/opportunity-discovery"

import { now, notice, need } from "./fixtures/opportunity-match-fixtures"
describe("evidence-based resource opportunity matching", () => {
  it("limits possible coverage to the published award, never the total pool", () => {
    expect(matchOpportunity(notice(), need(), now).coverage).toEqual({ kind: "comparable", maximumCents: 1000000, gapCents: 2500000, maximumCoverageBps: 4000, currency: "USD" })
    expect(opportunityValueLabel({ ...notice(), awardFloorCents: null, awardCeilingCents: null })).toBe("Amount not published")
  })
  it.each(["currency", "period", "missing_need", "share", "restricted", "overlap", "eligibility", "amount_evidence"])("keeps %s uncertainty out of coverage", kind => {
    const n = notice(), f = need()
    if (kind === "currency") f.currency = "CAD"
    if (kind === "period") n.awardPeriod = null
    if (kind === "missing_need") f.eligibleUnfundedCost = { state: "unknown" }
    if (kind === "share") { n.costSharing = true; f.matchingFunds = { state: "known", cents: 9000000 } }
    if (kind === "restricted") f.restrictedCosts = "unknown"
    if (kind === "overlap") f.overlap = "overlapping"
    if (kind === "eligibility") f.eligibilityReview = "unknown"
    if (kind === "amount_evidence") n.evidence = n.evidence.filter(e => e.field !== "awardCeilingCents")
    expect(matchOpportunity(n, f, now).coverage.kind).toBe("unavailable")
  })
  it("does not clip below the published minimum or invent applicant eligibility", () => {
    const f = need(); f.requestedCents = 50; f.applicantTypeCode = "01"
    const match = matchOpportunity(notice(), f, now)
    expect(match.fit).toBe("not_eligible")
    expect(match.criteria.filter(c => c.outcome === "fail").map(c => c.id)).toEqual(expect.arrayContaining(["minimum", "applicant"]))
  })
  it.each(["expired", "withdrawn", "stale"])("excludes %s notices from active matches", kind => {
    const n = notice()
    if (kind === "expired") n.deadlineDate = "2026-10-20"
    if (kind === "withdrawn") n.status = "withdrawn"
    if (kind === "stale") n.verifiedAt = "2026-10-01T00:00:00.000Z"
    expect(matchOpportunity(n, need(), now).active).toBe(false)
  })
  it("calculates published project cost share with integer rounding", () => {
    const n = notice(), f = need(); n.costSharing = true; n.costShareBasis = "project"; n.costShareRateBps = 2000
    for (const field of ["costShareBasis", "costShareRateBps"]) n.evidence.push({ field, path: field, url: n.originalUrl, verifiedAt: now })
    f.matchingFunds = { state: "known", cents: 249999 }
    expect(matchOpportunity(n, f, now).criteria.find(c => c.id === "cost_share")?.outcome).toBe("fail")
    f.matchingFunds.cents = 250000
    expect(matchOpportunity(n, f, now).coverage.kind).toBe("comparable")
  })
  it("caps project awards and matching funds against the actual eligible project and requested amount", () => {
    const n=notice(),f=need()
    n.costSharing=true;n.costShareBasis="project";n.costShareRateBps=2000
    for(const field of ["costShareBasis","costShareRateBps"])n.evidence.push({field,path:field,url:n.originalUrl,verifiedAt:now})
    f.eligibleUnfundedCost={state:"known",cents:100000};f.matchingFunds={state:"known",cents:20000}
    expect(matchOpportunity(n,f,now).coverage).toMatchObject({kind:"comparable",maximumCents:80000,maximumCoverageBps:8000})
    f.requestedCents=40000;f.matchingFunds.cents=10000
    expect(matchOpportunity(n,f,now).coverage).toMatchObject({kind:"comparable",maximumCents:40000})
    f.eligibleUnfundedCost.cents=100
    expect(matchOpportunity(n,f,now).fit).toBe("not_eligible")
  })
  it("does not compare dollar minima or matching funds across currencies", () => {
    const f=need();f.currency="CAD";f.requestedCents=1
    expect(matchOpportunity(notice(),f,now).criteria.find(c=>c.id==="minimum")?.outcome).toBe("unknown")
    expect(matchOpportunity(notice(),f,now).fit).toBe("needs_review")
  })
  it("requires period evidence and refuses unsupported in-kind valuations", async () => {
    const n=notice();n.evidence=n.evidence.filter(e=>e.field!=="awardPeriod")
    expect(matchOpportunity(n,need(),now).coverage.kind).toBe("unavailable")
    const {officialOpportunityNoticeSchema}=await import("@/features/workspace-finance/matching-types")
    expect(()=>officialOpportunityNoticeSchema.parse({...n,inKind:{quantity:"100 items",valuationCents:50000,method:null,sourceUrl:null,valuedAt:null}})).toThrow()
  })
})
const raw = () => ({ errorcode: 0, data: { id: 123, revision: 2, opportunityTitle: "Fixture", docType: "synopsis", ost: "POSTED", listed: "L", synopsis: { opportunityId: 123, awardFloor: "100.01", awardCeiling: "25000", estimatedFunding: "5000000", costSharing: false, postingDateStr: "2026-10-01-00-00-00", applicantTypes: [{ id: "12", description: "Nonprofits" }] } } })
describe("official notice normalization and discovery", () => {
  it("keeps exact cents, a separate pool, unknown cutoff/period and field evidence", () => {
    const value = normalizeGrantsGovDetail(raw(), "123", now)
    expect(value).toMatchObject({ awardFloorCents: 10001, awardCeilingCents: 2500000, fundingPoolCents: 500000000, awardPeriod: null, deadlineDate: null, deadlineTimezone: null })
    expect(value.evidence.find(e => e.field === "awardCeilingCents")?.path).toBe("data.synopsis.awardCeiling")
  })
  it("rejects identity confusion and malformed monetary data", () => {
    expect(() => normalizeGrantsGovDetail(raw(), "124", now)).toThrow(/identity/)
    const value = raw(); value.data.synopsis.awardFloor = "1.001"
    expect(() => normalizeGrantsGovDetail(value, "123", now)).toThrow(/amount/)
  })
  it("deduplicates public IDs, distinguishes unavailable details and bounds requests", async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async url => {
      calls.push(String(url))
      if (String(url).endsWith("search2")) return Response.json({ errorcode: 0, data: { oppHits: [{ id: "123", title: "Fixture", oppStatus: "posted" }, { id: "123", title: "Duplicate", oppStatus: "posted" }, { id: "124", title: "Unavailable", oppStatus: "posted" }] } })
      return calls.length === 2 ? Response.json(raw()) : new Response("Unavailable", { status: 503 })
    }
    const result = await discoverOfficialOpportunities({ keyword: "community", observedAt: now, fetchImpl })
    expect(result.notices).toHaveLength(1); expect(result.unavailable).toBe(1); expect(calls).toHaveLength(3)
    await expect(discoverOfficialOpportunities({ keyword: "community", limit: 6, fetchImpl })).rejects.toThrow()
  })
})
