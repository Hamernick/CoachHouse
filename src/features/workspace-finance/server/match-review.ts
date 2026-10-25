import "server-only"
import { createHash } from "node:crypto"
import { officialOpportunityNoticeSchema, type FundingNeed, type OfficialOpportunityNotice } from "../matching-types"

/** Stable field ordering from the schema; retrieval timestamps are not source amendments. */
export function noticeFingerprint(input: OfficialOpportunityNotice) {
  const notice = officialOpportunityNoticeSchema.parse(input)
  return createHash("sha256").update(JSON.stringify({ ...notice, verifiedAt: "", discoveredAt: "",
    evidence: notice.evidence.map(evidence => ({ ...evidence, verifiedAt: "" })) })).digest("hex")
}

export function clearMatchReview(need: FundingNeed): FundingNeed {
  const { review: _review, ...facts } = need
  return { ...facts, eligibilityReview: "unknown", restrictedCosts: "unknown", overlap: "unknown" }
}

/** Organization budget facts survive an amendment; notice-dependent confirmations do not. */
export function needForNotice(need: FundingNeed, notice: OfficialOpportunityNotice): FundingNeed {
  return need.review?.noticeFingerprint === noticeFingerprint(notice) ? need : clearMatchReview(need)
}
