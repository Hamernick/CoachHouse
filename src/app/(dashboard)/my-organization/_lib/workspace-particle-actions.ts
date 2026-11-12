"use server"

import { readWorkspaceBoardForProjection } from "@/lib/organization/particle-board-read"
import { selectWorkspaceState, workspaceIdSchema } from "@/features/workspace-management"
import { readParticleGraph, type ParticleCommit, type ParticleGraph, type ParticleResult } from "@/features/workspace-particles"
import { resolveActor } from "./workspace-actions-support"
import { writeWorkspaceParticleBatch } from "./workspace-particle-write"
import { projectParticleGraphAudience } from "@/features/workspace-particles/server"

export async function loadWorkspaceParticleGraphAction(workspaceCanvasId?: string): Promise<
  ParticleResult<ParticleGraph>
> {
  if (workspaceCanvasId !== undefined && !workspaceIdSchema.safeParse(workspaceCanvasId).success) return { ok: false, code: "invalid", error: "Invalid workspace." }
  const actor = await resolveActor()
  if ("error" in actor) return { ok: false, code: "scope", error: actor.error }
  const { data, error } = await readWorkspaceBoardForProjection(actor.supabase, actor.activeOrg.orgId, actor.user.id)
  if (error)
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to load Particles. Try again.",
    }
  let state
  try { state = selectWorkspaceState(data?.state, workspaceCanvasId) }
  catch { return { ok: false, code: "scope", error: "Workspace not found." } }
  const graph = readParticleGraph(
    state && typeof state === "object" && !Array.isArray(state)
      ? state.particleGraph
      : undefined,
    actor.activeOrg.orgId
  )
  if (!graph.ok) return graph
  try { return { ok: true, value: await projectParticleGraphAudience(graph.value, actor.user.id) } }
  catch { return { ok: false, code: "unavailable", error: "Unable to load Particles. Try again." } }
}

export async function applyWorkspaceParticleBatchAction(input: unknown, workspaceCanvasId?: string): Promise<ParticleResult<ParticleCommit>> {
  return writeWorkspaceParticleBatch(input, workspaceCanvasId)
}
