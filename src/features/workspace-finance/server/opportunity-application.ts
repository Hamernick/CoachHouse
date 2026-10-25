import "server-only"
import { z } from "zod"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { resolveRoadmapSections, type RoadmapSection } from "@/lib/roadmap"
import { canEditOrganization } from "@/lib/organization/active-org"
import { requireOrganizationDocumentStorage } from "@/lib/organization/document-storage-access"
import type { Json } from "@/lib/supabase"
import { resourceMatchTargetSchema } from "../matching-types"
import { applicationSectionId, opportunityApplicationSeed } from "../lib/opportunity-application"
import { resourceMatchContext, resourceMatchRpc } from "./resource-matches"
import { fetchOfficialOpportunity } from "./opportunity-discovery"
import { needForNotice, noticeFingerprint } from "./match-review"
import { matchOpportunity } from "../lib/opportunity-matching"
import { fetchApplicationInstructions } from "./application-instructions"

const reference = (section: RoadmapSection) => ({ id: section.id, title: section.title, slug: section.slug })
export async function prepareResourceApplication(input: unknown) {
  const request = z.strictObject({ target: resourceMatchTargetSchema, id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }) }).parse(input)
  const ctx = await resourceMatchContext(request.target, true)
  if (!canEditOrganization(ctx.activeOrg.role)) throw new Error("Organization document editing access is required to prepare an application.")
  const storage = await requireOrganizationDocumentStorage({ supabase: ctx.supabase, orgId: ctx.target.organizationId })
  if ("error" in storage) throw new Error(storage.error)
  const state = await resourceMatchRpc(ctx, "list"), match = state.matches.find(item => item.id === request.id)
  if (!match || match.updatedAt !== request.updatedAt) throw new Error("Match changed. Reopen opportunities before preparing a draft.")
  if (match.status !== "saved" || !match.opportunityId) throw new Error("Save this opportunity before preparing an application.")
  const sectionId = applicationSectionId(match.id)
  const readExisting = async () => {
    const { data, error } = await ctx.supabase.from("organizations").select("profile").eq("user_id", ctx.target.organizationId).maybeSingle()
    if (error || !data) throw new Error("Organization documents could not be loaded.")
    return resolveRoadmapSections((data.profile ?? {}) as Record<string, unknown>).find(section => section.id === sectionId)
  }
  // Reopening is independent of provider availability; never regenerate over manual work.
  const existing = await readExisting()
  if (existing) return { ...state, document: reference(existing), reviewRequired: false }
  if (match.stale) throw new Error("Resource changed. Search again before preparing a new application.")
  const notice = { ...await fetchOfficialOpportunity(match.notice.externalId), discoveredAt: match.notice.discoveredAt }
  const need = needForNotice(match.need, notice), assessment = matchOpportunity(notice, need)
  const noticeChanged = noticeFingerprint(notice) !== noticeFingerprint(match.notice) || !assessment.active || notice.status !== "posted"
  const instructions = noticeChanged ? null : await fetchApplicationInstructions(notice.applicationSourceUrl)
  // Recheck the resource and match CAS after all source reads, before creating the document.
  const refreshed = await resourceMatchRpc(ctx, "put", [{ notice, need, assessment, expectedUpdatedAt: match.updatedAt }] as unknown as Json)
  if (noticeChanged || !instructions)
    return { ...refreshed, document: null, reviewRequired: true }
  if (instructions.acceptingProposals === "not_accepting") return { ...refreshed, document: null, reviewRequired: true, preparationWarning: "The funder's official solicitation says it is not accepting proposals. This conflicts with the listing; confirm availability with the funder before preparing a new application." }
  if (instructions.state === "unavailable") return { ...refreshed, document: null, reviewRequired: true, preparationWarning: "The funder's official instructions could not be verified. No document was created. Retry when the source is available." }
  const seed = opportunityApplicationSeed(notice, instructions)
  const saved = await saveRoadmapSectionAction({ ...seed, sectionId, createOnly: true, expectedLastUpdated: null,
    expectedOrganizationId: ctx.target.organizationId, expectedUserId: ctx.user.id, isPublic: false, status: "in_progress" })
  if ("error" in saved) {
    // A competing create may have won the organization CAS. Recover only this stable ID.
    if (saved.code === "conflict") {
      const concurrent = await readExisting()
      if (concurrent) return { ...refreshed, document: reference(concurrent), reviewRequired: false }
    }
    throw new Error(saved.error)
  }
  return { ...refreshed, document: reference(saved.section), reviewRequired: false }
}
