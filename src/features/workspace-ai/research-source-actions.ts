"use server"

import { z } from "zod"
import { researchTargetSchema } from "./research-types"
import { loadResearchApplication, prepareResearchApplication } from "./server/research-application"
import { readResearchOutputDraft } from "./server/research-output-draft"
import { applyResearchDraft, createResearchDraft } from "./lib/research-draft"
import { applyResearchDataViewEffects, inspectResearchDataViewEffects } from "./server/research-data-view-effects"
import { researchSourceEffectsSchema } from "./lib/research-data-view"
import type { ResearchTarget } from "./research-types"

const requestSchema = z.strictObject({ runId: z.uuid(), target: researchTargetSchema })
function applicationRequest(input: z.infer<typeof requestSchema>) {
  return { runId: input.runId, organizationId: input.target.organizationId,
    ...(input.target.mode === "new_objective" ? { target: input.target } : { objectiveId: input.target.objectiveId }) }
}
function assertSourceEffectScope(actual: ResearchTarget, requested: ResearchTarget) {
  if (actual.organizationId !== requested.organizationId || actual.mode !== requested.mode || actual.objectiveId !== requested.objectiveId ||
      actual.plan?.id !== requested.plan?.id || (actual.mode === "new_objective" && requested.mode === "new_objective" && actual.canvasId !== requested.canvasId))
    throw new Error("Research scope changed")
  // Read-only receipt recovery survives a newer plan revision. Creating or
  // attaching effects still uses the original proposal's strict preflight.
}

export async function readWorkspaceResearchSourceEffects(input: unknown) {
  try {
    const request = requestSchema.parse(input)
    const loaded = await loadResearchApplication(applicationRequest(request))
    assertSourceEffectScope(loaded.result.target, request.target)
    const checkpoint = await readResearchOutputDraft(loaded.result, loaded.context.user.id)
    const edited = applyResearchDraft(loaded.result, checkpoint.draft ?? undefined)
    const planApplied = loaded.context.graph.particles.some(item => item.type === "objective" &&
      [...(item.data.planning?.plans ?? []), ...(item.data.planning?.proposals ?? [])].some(plan => plan.researchRunId === loaded.run.id))
    return researchSourceEffectsSchema.parse({ effects: await inspectResearchDataViewEffects(edited), planApplied })
  } catch { return { error: "Saved source effects could not be verified. No effects were run. Retry after restoring access." } }
}

export async function applyWorkspaceResearchSourceEffects(input: unknown) {
  try {
    const request = requestSchema.parse(input), application = applicationRequest(request)
    const loaded = await loadResearchApplication(application)
    assertSourceEffectScope(loaded.result.target, request.target)
    const checkpoint = await readResearchOutputDraft(loaded.result, loaded.context.user.id)
    const draft = checkpoint.draft ?? createResearchDraft(loaded.result)
    const prepared = await prepareResearchApplication({ ...application, draft }, { prepareSources: true })
    // An already-applied plan is recovery only, even if a capability was disabled.
    const effects = prepared.batch ? await applyResearchDataViewEffects(prepared.sourceResult) : await inspectResearchDataViewEffects(prepared.sourceResult)
    return researchSourceEffectsSchema.parse({ effects, planApplied: prepared.batch === null })
  } catch { return { error: "Source application could not be verified. Earlier source effects may already be saved. Check status before retrying the same draft." } }
}
