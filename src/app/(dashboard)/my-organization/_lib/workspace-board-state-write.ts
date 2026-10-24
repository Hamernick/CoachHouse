import { selectWorkspaceState, mergeWorkspaceState } from "@/features/workspace-management"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase"

import type { WorkspaceBoardState } from "../_components/workspace-board/workspace-board-types"
import { readWorkspaceBoardStateValue } from "./workspace-state"

const MAX_WORKSPACE_BOARD_WRITE_ATTEMPTS = 4

export const WORKSPACE_BOARD_WRITE_CONFLICT_ERROR =
  "Workspace changed while you were saving. Refresh and try again."

type WorkspaceBoardSnapshot = {
  stored?: Json
  exists: boolean
  revision: string | null
  state: WorkspaceBoardState | null
}

type WorkspaceBoardSnapshotReadResult =
  | { snapshot: WorkspaceBoardSnapshot }
  | { error: string }

type WorkspaceBoardSnapshotWriteResult =
  | { status: "written" }
  | { status: "conflict" }
  | { status: "error"; error: string }

export async function commitWorkspaceBoardState({
  buildState,
  maxAttempts = MAX_WORKSPACE_BOARD_WRITE_ATTEMPTS,
  readSnapshot,
  writeSnapshot,
  updateParticleGraph,
}: {
  buildState: (
    persistedState: WorkspaceBoardState | null
  ) => WorkspaceBoardState
  updateParticleGraph?: (stored: Json | undefined) => Json | Promise<Json>
  maxAttempts?: number
  readSnapshot: () => Promise<WorkspaceBoardSnapshotReadResult>
  writeSnapshot: (
    snapshot: WorkspaceBoardSnapshot,
    nextState: WorkspaceBoardState
  ) => Promise<WorkspaceBoardSnapshotWriteResult>
}): Promise<{ ok: true; boardState: WorkspaceBoardState } | { error: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const readResult = await readSnapshot()
    if ("error" in readResult) return readResult

    const candidate = buildState(readResult.snapshot.state)
    // Whole-board clients never own this field. Preserve even unknown versions;
    // only the dedicated authenticated mutation path may replace it.
    const { particleGraph: _untrustedParticleGraph, particles: _untrustedLegacyParticles, ...boardFields } = candidate
    const particleGraph = updateParticleGraph
      ? await updateParticleGraph(readResult.snapshot.state?.particleGraph)
      : readResult.snapshot.state?.particleGraph
    const legacyParticles = readResult.snapshot.state?.particles
    const boardState = {
      ...boardFields,
      ...(legacyParticles !== undefined ? { particles: legacyParticles } : {}),
      ...(particleGraph !== undefined ? { particleGraph } : {}),
      updatedAt: new Date().toISOString(),
    }
    const writeResult = await writeSnapshot(readResult.snapshot, boardState)
    if (writeResult.status === "written") {
      return { ok: true, boardState }
    }
    if (writeResult.status === "error") {
      return { error: writeResult.error }
    }
  }

  return { error: WORKSPACE_BOARD_WRITE_CONFLICT_ERROR }
}

function isForeignKeyViolation(error: { code?: string } | null) {
  return error?.code === "23503"
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505"
}

export async function persistWorkspaceBoardState({
  buildState,
  orgId,
  workspaceCanvasId,
  supabase,
  userId,
  updateParticleGraph,
}: {
  buildState: (
    persistedState: WorkspaceBoardState | null
  ) => WorkspaceBoardState
  updateParticleGraph?: (stored: Json | undefined) => Json | Promise<Json>
  orgId: string
  workspaceCanvasId?: string
  supabase: SupabaseClient<Database>
  userId: string
}) {
  return commitWorkspaceBoardState({
    buildState,
    updateParticleGraph,
    readSnapshot: async () => {
      const { data, error } = await supabase
        .from("organization_workspace_boards")
        .select("state, updated_at")
        .eq("org_id", orgId)
        .maybeSingle<{ state: unknown; updated_at: string }>()

      if (error) return { error: "Unable to save workspace layout." }
      try {
        return {
          snapshot: {
            stored: data?.state as Json | undefined,
            exists: Boolean(data),
            revision: data?.updated_at ?? null,
            state: data?.state || workspaceCanvasId
              ? readWorkspaceBoardStateValue(selectWorkspaceState(data?.state, workspaceCanvasId))
              : null,
          },
        }
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to load workspace." }
      }
    },
    writeSnapshot: async (snapshot, nextState) => {
      const state = mergeWorkspaceState(snapshot.stored, nextState, workspaceCanvasId)

      if (!snapshot.exists) {
        const insertWithActor = (updatedBy: string | null) =>
          supabase
            .from("organization_workspace_boards")
            .insert({ org_id: orgId, state, updated_by: updatedBy })
            .select("updated_at")
            .maybeSingle<{ updated_at: string }>()

        let { data, error } = await insertWithActor(userId)
        if (isForeignKeyViolation(error)) {
          const fallbackResult = await insertWithActor(null)
          data = fallbackResult.data
          error = fallbackResult.error
        }
        if (isUniqueViolation(error)) return { status: "conflict" }
        if (error) {
          return { status: "error", error: "Unable to save workspace layout." }
        }
        return data ? { status: "written" } : { status: "conflict" }
      }

      const revision = snapshot.revision
      if (!revision) return { status: "conflict" }
      const updateWithActor = (updatedBy: string | null) =>
        supabase
          .from("organization_workspace_boards")
          .update({ state, updated_by: updatedBy })
          .eq("org_id", orgId)
          .eq("updated_at", revision)
          .select("updated_at")
          .maybeSingle<{ updated_at: string }>()

      let { data, error } = await updateWithActor(userId)
      if (isForeignKeyViolation(error)) {
        const fallbackResult = await updateWithActor(null)
        data = fallbackResult.data
        error = fallbackResult.error
      }
      if (error) {
        return { status: "error", error: "Unable to save workspace layout." }
      }
      return data ? { status: "written" } : { status: "conflict" }
    },
  })
}
