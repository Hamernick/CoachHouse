"use server"

import { prepareResearchApplication } from "@/features/workspace-ai"
import type { ParticleCommit, ParticleResult } from "@/features/workspace-particles"
import { writeWorkspaceParticleBatch } from "./workspace-particle-write"

export async function applyWorkspaceResearchAction(input: unknown, workspaceCanvasId?: string): Promise<ParticleResult<ParticleCommit>> {
  try {
    const prepared = await prepareResearchApplication(input)
    if (prepared.context.canvasId !== (workspaceCanvasId ?? null))
      return { ok: false, code: "scope", error: "Open the workspace where this research began." }
    if (!prepared.batch) return { ok: true, value: { graph: prepared.context.graph, inverse: [], replayed: true } }
    return await writeWorkspaceParticleBatch(prepared.batch, workspaceCanvasId, {
      runId: prepared.runId, objectiveId: prepared.context.objective.id,
    })
  } catch (error) {
    return { ok: false, code: "invalid", error: error instanceof Error ? error.message : "Research could not be added. Try again." }
  }
}
