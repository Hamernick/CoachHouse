import { assertParticleSourceReferenceAccess, assertParticleAudienceMutation } from "@/features/workspace-particles/server"
import "server-only"
import { assertWorkspaceCanvasAccess } from "@/lib/organization/workspace-canvas-access"

import { workspaceIdSchema } from "@/features/workspace-management"

import { revalidatePath } from "next/cache"
import {
  readParticleGraph,
  particleCalendarChanged,
  type ParticleGraph,
  type ParticleCommit,
  type ParticleResult,
} from "@/features/workspace-particles"
import {
  ParticleMutationError,
  prepareAuthorizedParticleMutation,
} from "@/features/workspace-particles"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveCalendarAccess } from "@/actions/roadmap-calendar-helpers"
import { buildDefaultBoardState } from "../_components/workspace-board/workspace-board-layout"
import {
  canEditWorkspaceLayout,
  resolveActor,
} from "./workspace-actions-support"
import { persistWorkspaceBoardState } from "./workspace-board-state-write"

export async function writeWorkspaceParticleBatch(
  input: unknown,
  workspaceCanvasId?: string,
  authorizedResearch?: { runId: string; objectiveId: string }
): Promise<ParticleResult<ParticleCommit>> {
  if (workspaceCanvasId !== undefined && !workspaceIdSchema.safeParse(workspaceCanvasId).success) return { ok: false, code: "invalid", error: "Invalid workspace." }
  const actor = await resolveActor()
  if ("error" in actor) return { ok: false, code: "scope", error: actor.error }
  const canEdit = await canEditWorkspaceLayout({
    activeOrgRole: actor.activeOrg.role,
    supabase: actor.supabase,
    userId: actor.user.id,
  })
  const mutation = await prepareAuthorizedParticleMutation({
    input,
    workspaceId: actor.activeOrg.orgId,
    canEdit,
    now: new Date().toISOString(),
    authorizedResearch,
    planningActor: { userId: actor.user.id, isOrganizationOwner: actor.activeOrg.role === "owner" },
  })
  if (!mutation.ok) return mutation
  let supabase = actor.supabase
  try {
    supabase = createSupabaseAdminClient({ actorId: actor.user.id, requestTimeoutMs: 10000 })
  } catch {
    /* Local environments can omit service-role credentials. */
  }
  try {
    let commit: ParticleCommit | undefined
    let previousGraph: ParticleGraph | undefined
    let calendarAccess: ReturnType<typeof resolveCalendarAccess> | undefined
    const result = await persistWorkspaceBoardState({
      supabase,
      orgId: actor.activeOrg.orgId,
      workspaceCanvasId,
      userId: actor.user.id,
      buildState: (persisted) => persisted ?? buildDefaultBoardState(),
      updateParticleGraph: async (stored) => {
        commit = mutation.value(stored)
        const previous = readParticleGraph(stored, actor.activeOrg.orgId)
        if (!previous.ok) throw new ParticleMutationError(previous.code, previous.error)
        previousGraph = previous.value
        await assertParticleAudienceMutation(previous.value, commit.graph, actor.user.id)
        if (!commit.replayed) await assertParticleSourceReferenceAccess({
          supabase: actor.supabase,
          assigneeClient: supabase,
          previous: previous.value,
          next: commit.graph,
        })
        if (particleCalendarChanged(previous.value, commit.graph)) {
          calendarAccess ??= resolveCalendarAccess(actor.supabase, actor.user.id)
          const access = await calendarAccess
          if (access.orgId !== actor.activeOrg.orgId || !access.canManageCalendar)
            throw new ParticleMutationError("scope", "You do not have permission to manage this calendar.")
        }
        return commit.graph
      },
    })
    if ("error" in result)
      return { ok: false, code: "unavailable", error: result.error }
    if (!commit || !previousGraph)
      return {
        ok: false,
        code: "unavailable",
        error: "Unable to save Particles. Try again.",
      }
    revalidatePath("/workspace")
    revalidatePath("/my-organization")
    revalidatePath("/organization/workspace")
    // Recheck disclosure after persistence, including old values in undo.
    // A lost response remains recoverable through the existing batch receipt.
    const graph = await assertParticleAudienceMutation(previousGraph, commit.graph, actor.user.id)
    // Source/undo checks above may await other services. Recheck the canvas at
    // the final disclosure boundary too, even for an idempotent batch replay.
    await assertWorkspaceCanvasAccess({ supabase, orgId: actor.activeOrg.orgId, userId: actor.user.id, workspaceCanvasId })
    return { ok: true, value: { ...commit, graph } }
  } catch (error) {
    if (error instanceof ParticleMutationError)
      return { ok: false, code: error.code, error: error.message }
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to save Particles. Try again.",
    }
  }
}
