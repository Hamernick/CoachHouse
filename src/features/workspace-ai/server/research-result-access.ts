import "server-only"
import { assertTableAnalysesCurrent } from "./knowledge-table-analysis"
import { assertPersonalMemoryCurrent, assertOrganizationMemoryCurrent } from "./personal-memory"
import { validateResearchResponse } from "../lib/research-response"
import { assertResearchDataViewSources } from "./research-data-view-sources"
import { knowledgePersonFieldFingerprint } from "./knowledge-person"
import type { KnowledgeKind, ResearchResult, ResearchTarget } from "../research-types"
import type { ResearchContext } from "./research-context"
import { knowledgeFingerprint, researchContextFingerprint } from "./research-dependencies"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader } from "./knowledge-records"
import { ResearchRecoveryError } from "./research-recovery"
import { inaccessibleNativeFiles } from "@/lib/organization/particle-file-dependencies"

export function assertResearchProvenance(result: ResearchResult, id: string, target: ResearchTarget) {
  validateResearchResponse(result)
  if (result.target.mode !== target.mode || (target.mode === "new_objective" && (result.target.mode !== "new_objective" || result.target.canvasId !== target.canvasId)) || result.runId !== id || result.target.organizationId !== target.organizationId ||
      result.target.objectiveId !== target.objectiveId || result.target.revision !== target.revision ||
      result.target.plan?.id !== target.plan?.id || result.target.plan?.revision !== target.plan?.revision)
    throw new ResearchRecoveryError("invalid_result")
}

/** Reauthorize all observed inputs, including uncited evidence. Never return derived
 * prose after stripping an inaccessible citation. Old runs cannot prove full access.
 */
export async function assertResearchSourcesAccessible(context: ResearchContext, result: ResearchResult, purpose: "apply" | "history" = "apply") {
  if (!result.dependencies) throw new ResearchRecoveryError("legacy_result")
  const load = knowledgeLoader(context)
  const kinds: Record<string, KnowledgeKind> = { organization: "organization", person: "person", document: "document", file: "document", particle: "particle", calendar: "calendar", opportunity: "opportunity" }
  const sources = result.dependencies.records
  const citations = result.sources.filter(source => source.kind === "workspace")
  try {
    await assertPersonalMemoryCurrent(context, result.dependencies.personalMemory)
    await assertOrganizationMemoryCurrent(context, result.dependencies.organizationMemory)
    if ((await inaccessibleNativeFiles(result.dependencies.nativeFileIds ?? [], context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })).size)
      throw new ResearchRecoveryError("sources_changed")
    await assertResearchDataViewSources(context,result.dependencies.dataViews??[])
    await assertTableAnalysesCurrent(context,result.dependencies.tableAnalyses??[])
    // An unrelated objective/plan edit invalidates a proposal, not the transcript.
    // Observed source fingerprints below still protect revoked/redacted content.
    if (purpose === "apply" && researchContextFingerprint(context, result.target) !== result.dependencies.contextFingerprint)
      throw new ResearchRecoveryError("sources_changed")
    if (citations.some(source => !sources.some(dependency => dependency.id === source.id)))
      throw new ResearchRecoveryError("sources_changed")
    const contextParticleIds = result.dependencies.contextParticleIds ?? []
    const particles = contextParticleIds.length || sources.some(source => source.id.startsWith("particle:"))
      ? new Map((await load("particle", "")).map(source => [source.id, source])) : new Map()
    // Implicit titles/overviews are access dependencies, not full-record reads.
    // Ordinary edits must not hide history; apply still checks the exact prompt
    // fingerprint, and explicit tool observations still check full fingerprints.
    for (const id of contextParticleIds) {
      // Reviewed proposals remain stored but disappear from the context picker.
      // An exact authorized read keeps ordinary review from hiding old replies.
      if (!particles.has(id) && !(await load("particle", "", id)).some(record => record.id === id))
        throw new ResearchRecoveryError("sources_changed")
    }
    for (let offset = 0; offset < sources.length; offset += 4) {
      await Promise.all(sources.slice(offset, offset + 4).map(async source => {
        const kind = kinds[source.id.split(":")[0]]
        const current = kind === "particle" ? particles.get(source.id)
          : kind ? (await load(kind, "", source.id)).find(record => record.id === source.id) : undefined
        if (!current || kind !== source.kind || knowledgeFingerprint(current) !== source.fingerprint)
          throw new ResearchRecoveryError("sources_changed")
        for (const field of source.contactFields ?? []) if (knowledgePersonFieldFingerprint(current,field.field) !== field.fingerprint)
          throw new ResearchRecoveryError("sources_changed")
        if (source.detailFingerprint && knowledgeFingerprint(await readKnowledgeFile(context, current, undefined, undefined, source.pdfStartPage)) !== source.detailFingerprint)
          throw new ResearchRecoveryError("sources_changed")
      }))
    }
  } catch (error) {
    if (error instanceof ResearchRecoveryError) throw error
    // A failed reader proves neither change nor revocation. Withhold all content
    // and retry the same authorized read; never disclose its exception details.
    throw new ResearchRecoveryError("verification_unavailable")
  }
}
