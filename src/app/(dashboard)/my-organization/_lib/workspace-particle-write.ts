import "server-only"

import { workspaceIdSchema } from "@/features/workspace-management"

import { revalidatePath } from "next/cache"
import {
  readParticleGraph,
  particleCalendarChanged,
  assertParticleSourceReferenceAccess,
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
    supabase = createSupabaseAdminClient()
  } catch {
    /* Local environments can omit service-role credentials. */
  }
  try {
    let commit: ParticleCommit | undefined
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
        if (!commit.replayed) await assertParticleSourceReferenceAccess({
          supabase: actor.supabase,
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
    if (!commit)
      return {
        ok: false,
        code: "unavailable",
        error: "Unable to save Particles. Try again.",
      }
    revalidatePath("/workspace")
    revalidatePath("/my-organization")
    revalidatePath("/organization/workspace")
    return { ok: true, value: commit }
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
