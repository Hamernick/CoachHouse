import { assertWorkspaceCanvasAccess, WORKSPACE_CANVAS_ACCESS_ERROR } from "@/lib/organization/workspace-canvas-access"
import { selectWorkspaceState, mergeWorkspaceState } from "@/features/workspace-management"
import { projectStoredParticleGraphAudience } from "@/features/workspace-particles/server"

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

export function workspaceBoardWriteError(error: { code?: string; message?: string }) {
  if (error.code === "42501" && ["Board source access required.", "Workspace audience access required."].includes(error.message ?? ""))
    return "This content is unavailable. Refresh and try again."
  if (error.code === "40001" && (error.message?.startsWith("Board source permission") || error.message?.startsWith("Workspace permission")))
    return "Workspace permissions changed. Refresh and try again."
  if (error.code === "42501" && error.message === "Form source manager required")
    return "You need form Edit access to change it, or primary manager access to remove it. Your changes were not saved."
  if (error.code === "22023" && error.message === "Conflicting form identity")
    return "This form has conflicting copies. Your changes were not saved."
  return "Unable to save workspace layout."
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
  const result = await commitWorkspaceBoardState({
    buildState,
    updateParticleGraph,
    readSnapshot: async () => {
      // Check before compiling canonical content, including CAS retries/replays.
      try {
        await assertWorkspaceCanvasAccess({ supabase, orgId, userId, workspaceCanvasId, allowAbsent: true })
      } catch { return { error: WORKSPACE_CANVAS_ACCESS_ERROR } }
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

      // The database rechecks editor/closure authority under locks, then compares
      // the complete snapshot and exact row revision. Never save a projection.
      const { data, error } = await supabase.rpc("commit_workspace_board", {
        p_org_id: orgId,
        p_actor_id: userId,
        p_expected_revision: snapshot.revision,
        p_expected_state: snapshot.exists ? snapshot.stored ?? null : null,
        p_state: state,
      })
      if (error) return { status: "error", error: workspaceBoardWriteError(error) }
      if (data === true) return { status: "written" }
      if (data === false) return { status: "conflict" }
      return { status: "error", error: "Unable to confirm workspace save. Refresh and try again." }
    },
  })
  if ("error" in result) return result
  try {
    const boardState = result.boardState.particleGraph === undefined ? result.boardState : {
      ...result.boardState,
      particleGraph: await projectStoredParticleGraphAudience(result.boardState.particleGraph, orgId, userId),
    }
    // Even layout-only/no-op responses require current access after persistence.
    await assertWorkspaceCanvasAccess({ supabase, orgId, userId, workspaceCanvasId })
    return { ...result, boardState }
  } catch { return { error: "Unable to load saved workspace. Refresh and try again." } }
}
