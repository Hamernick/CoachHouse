import "server-only"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { readAiRun } from "@/features/ai-credits"
import { researchPlanOperations, type ParticleBatch } from "@/features/workspace-particles"
import { researchResultSchema, newObjectiveTargetSchema } from "../research-types"
import { loadResearchContext } from "./research-context"
import { researchRunSchema } from "./research-run"
import { assertResearchProvenance, assertResearchSourcesAccessible } from "./research-result-access"

import { applyResearchDraft, researchDraftSchema } from "../lib/research-draft"
import { assertResearchCapabilities } from "../lib/research-capabilities"
import { assertResearchOutputAvailability } from "./research-output-config"
import { requireResearchOutputDraft } from "./research-output-draft"
import { inspectResearchDataViewEffects } from "./research-data-view-effects"

/** The ledger owns evidence/target; typed preview edits cannot supply canonical IDs or authority. */
export async function loadResearchApplication(input: unknown) {
  const request = z.union([
    z.strictObject({ runId: z.uuid(), draft: researchDraftSchema.optional(), objectiveId: z.uuid(), organizationId: z.uuid(), target: z.never().optional() }),
    z.strictObject({ runId: z.uuid(), draft: researchDraftSchema.optional(), organizationId: z.uuid(), objectiveId: z.never().optional(), target: newObjectiveTargetSchema }),
  ]).parse(input)
  if (request.target && request.target.organizationId !== request.organizationId) throw new Error("Workspace unavailable.")
  const context = await loadResearchContext(request.target ?? { revision: 0, organizationId: request.organizationId, objectiveId: request.objectiveId! }, false)
  const run = researchRunSchema.parse(await readAiRun(request.runId, request.organizationId, context.user.id))
  if (run.id !== request.runId || run.status !== "succeeded" || !run.proposal ||
      run.target.organizationId !== request.organizationId || run.target.mode !== request.target?.mode || run.target.objectiveId !== request.objectiveId ||
      run.target.userId !== context.user.id || run.target.canvasId !== context.canvasId)
    throw new Error("This research is unavailable for this objective.")
  const result = researchResultSchema.parse(JSON.parse(run.proposal))
  assertResearchProvenance(result, run.id, run.target)
  return { request, context, run, result }
}

export async function prepareResearchApplication(input: unknown, { prepareSources = false } = {}) {
  const { request, context, run, result } = await loadResearchApplication(input)
  const edited = applyResearchDraft(result, request.draft)
  const operations = researchPlanOperations(context.graph, edited, context.user.id, new Date().toISOString(), randomUUID)
  const objectiveId = operations.flatMap(operation => operation.kind === "put_particle" && operation.particle.type === "objective" ? [operation.particle.id] : [])[0]
    ?? context.graph.particles.find(p => p.type === "objective" && [...(p.data.planning?.plans ?? []), ...(p.data.planning?.proposals ?? [])].some(plan => plan.researchRunId === run.id))?.id
  if (!objectiveId) throw new Error("Research objective unavailable.")
  if (!operations.length) return { context, batch: null, runId: run.id, objectiveId, sourceResult: edited }
  const dataViews = edited.items.some(item => item.kind === "data_view")
  assertResearchCapabilities(undefined, edited.items.some(item => item.kind === "form"), dataViews, edited.items.some(item=>item.kind==="data_view"&&item.dataView?.kind!=="projects"))
  assertResearchOutputAvailability(edited.items)
  await assertResearchSourcesAccessible(context, result)
  if (dataViews) {
    await requireResearchOutputDraft(result, context.user.id, request.draft)
    if (!prepareSources && (await inspectResearchDataViewEffects(edited)).some(effect => effect.status !== "created"))
      throw new Error("Some source effects are not confirmed. Recover the saved views before adding this plan.")
  }
  const batch: ParticleBatch = { id: randomUUID(), workspaceId: request.organizationId, baseRevision: context.graph.revision, requireExactRevision: true, operations }
  return { context, batch, runId: run.id, objectiveId, sourceResult: edited }
}
