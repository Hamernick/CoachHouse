"use server"

import { revalidatePath } from "next/cache"
import {
  readParticleGraph,
  type ParticleCommit,
  type ParticleGraph,
  type ParticleResult,
} from "@/features/workspace-particles"
import {
  ParticleMutationError,
  prepareAuthorizedParticleMutation,
} from "@/features/workspace-particles"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { buildDefaultBoardState } from "../_components/workspace-board/workspace-board-layout"
import {
  canEditWorkspaceLayout,
  resolveActor,
} from "./workspace-actions-support"
import { persistWorkspaceBoardState } from "./workspace-board-state-write"

export async function loadWorkspaceParticleGraphAction(): Promise<
  ParticleResult<ParticleGraph>
> {
  const actor = await resolveActor()
  if ("error" in actor) return { ok: false, code: "scope", error: actor.error }
  const { data, error } = await actor.supabase
    .from("organization_workspace_boards")
    .select("state")
    .eq("org_id", actor.activeOrg.orgId)
    .maybeSingle()
  if (error)
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to load Particles. Try again.",
    }
  const state = data?.state
  return readParticleGraph(
    state && typeof state === "object" && !Array.isArray(state)
      ? state.particleGraph
      : undefined,
    actor.activeOrg.orgId
  )
}

export async function applyWorkspaceParticleBatchAction(
  input: unknown
): Promise<ParticleResult<ParticleCommit>> {
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
    const result = await persistWorkspaceBoardState({
      supabase,
      orgId: actor.activeOrg.orgId,
      userId: actor.user.id,
      buildState: (persisted) => persisted ?? buildDefaultBoardState(),
      updateParticleGraph: (stored) => {
        commit = mutation.value(stored)
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
