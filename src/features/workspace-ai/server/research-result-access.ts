import "server-only"
import type { KnowledgeKind, ResearchResult, ResearchTarget } from "../research-types"
import type { ResearchContext } from "./research-context"
import { knowledgeFingerprint, researchContextFingerprint } from "./research-dependencies"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader } from "./knowledge-records"
import { ResearchRecoveryError } from "./research-recovery"

export function assertResearchProvenance(result: ResearchResult, id: string, target: ResearchTarget) {
  if (result.target.mode !== target.mode || (target.mode === "new_objective" && (result.target.mode !== "new_objective" || result.target.canvasId !== target.canvasId)) || result.runId !== id || result.target.organizationId !== target.organizationId ||
      result.target.objectiveId !== target.objectiveId || result.target.revision !== target.revision ||
      result.target.plan?.id !== target.plan?.id || result.target.plan?.revision !== target.plan?.revision)
    throw new ResearchRecoveryError("invalid_result")
}

/** Reauthorize all observed inputs, including uncited evidence. Never return derived
 * prose after stripping an inaccessible citation. Old runs cannot prove full access.
 */
export async function assertResearchSourcesAccessible(context: ResearchContext, result: ResearchResult) {
  if (!result.dependencies) throw new ResearchRecoveryError("legacy_result")
  const load = knowledgeLoader(context)
  const kinds: Record<string, KnowledgeKind> = { organization: "organization", person: "person", document: "document", file: "document", particle: "particle", calendar: "calendar", opportunity: "opportunity" }
  const sources = result.dependencies.records
  const citations = result.sources.filter(source => source.kind === "workspace")
  try {
    if (researchContextFingerprint(context, result.target) !== result.dependencies.contextFingerprint)
      throw new ResearchRecoveryError("sources_changed")
    if (citations.some(source => !sources.some(dependency => dependency.id === source.id)))
      throw new ResearchRecoveryError("sources_changed")
    const particles = sources.some(source => source.id.startsWith("particle:"))
      ? new Map((await load("particle", "")).map(source => [source.id, source])) : new Map()
    for (let offset = 0; offset < sources.length; offset += 4) {
      await Promise.all(sources.slice(offset, offset + 4).map(async source => {
        const kind = kinds[source.id.split(":")[0]]
        const current = kind === "particle" ? particles.get(source.id)
          : kind ? (await load(kind, "", source.id)).find(record => record.id === source.id) : undefined
        if (!current || kind !== source.kind || knowledgeFingerprint(current) !== source.fingerprint)
          throw new ResearchRecoveryError("sources_changed")
        if (source.detailFingerprint && knowledgeFingerprint(await readKnowledgeFile(context, current)) !== source.detailFingerprint)
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
