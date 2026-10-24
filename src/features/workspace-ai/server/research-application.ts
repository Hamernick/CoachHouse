import "server-only"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { readAiRun } from "@/features/ai-credits"
import { researchPlanOperations, type ParticleBatch } from "@/features/workspace-particles"
import { researchResultSchema, type KnowledgeKind } from "../research-types"
import { loadResearchContext } from "./research-context"
import { researchRunSchema } from "./research-run"
import { knowledgeLoader } from "./knowledge-records"

/** Only identifiers enter from the browser; proposal content comes from the ledger. */
export async function prepareResearchApplication(input: unknown) {
  const request = z.strictObject({ runId: z.uuid(), objectiveId: z.uuid(), organizationId: z.uuid() }).parse(input)
  const context = await loadResearchContext({ revision: 0, organizationId: request.organizationId, objectiveId: request.objectiveId }, false)
  const run = researchRunSchema.parse(await readAiRun(request.runId, request.organizationId, context.user.id))
  if (run.id !== request.runId || run.status !== "succeeded" || !run.proposal ||
      run.target.organizationId !== request.organizationId || run.target.objectiveId !== request.objectiveId ||
      run.target.userId !== context.user.id || run.target.canvasId !== context.canvasId)
    throw new Error("This research is unavailable for this objective.")
  const result = researchResultSchema.parse(JSON.parse(run.proposal))
  if (result.runId !== run.id || result.target.organizationId !== run.target.organizationId ||
      result.target.objectiveId !== run.target.objectiveId || result.target.revision !== run.target.revision)
    throw new Error("Research provenance does not match its saved run.")
  const operations = researchPlanOperations(context.graph, result, context.user.id, new Date().toISOString(), randomUUID)
  if (!operations.length) return { context, batch: null, runId: run.id }
  const load = knowledgeLoader(context)
  const kinds: Record<string, KnowledgeKind> = { organization: "organization", person: "person", document: "document", file: "document", particle: "particle", calendar: "calendar", opportunity: "opportunity" }
  // Recheck actor-visible evidence and versions before entering the canonical writer.
  for (const source of result.sources.filter(value => value.kind === "workspace")) {
    const kind = kinds[source.id.split(":")[0]]
    const current = kind ? (await load(kind, source.title)).find(value => value.id === source.id) : undefined
    if (!current || current.revision !== source.revision)
      throw new Error("A research source changed or is no longer accessible. Research again before adding this proposal.")
  }
  const batch: ParticleBatch = { id: randomUUID(), workspaceId: request.organizationId, baseRevision: context.graph.revision, requireExactRevision: true, operations }
  return { context, batch, runId: run.id }
}
