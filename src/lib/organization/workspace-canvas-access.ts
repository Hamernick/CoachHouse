import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { selectWorkspaceState } from "@/features/workspace-management"

export const WORKSPACE_CANVAS_ACCESS_ERROR = "Workspace access could not be verified. Refresh and try again."

/** Fresh service-actor admission, never a canonical save snapshot. The database
 * projection checks parent and canvas access; selecting also rejects tombstones.
 * Only a genuinely absent board can use the existing starter-canvas contract. */
export async function assertWorkspaceCanvasAccess({
  supabase, orgId, userId, workspaceCanvasId, allowAbsent = false,
}: {
  supabase: SupabaseClient<Database>
  orgId: string
  userId: string
  workspaceCanvasId?: string
  allowAbsent?: boolean
}) {
  try {
    const { data, error } = await supabase.rpc("read_workspace_canvas_projection", {
      p_org_id: orgId, p_actor_id: userId,
    })
    if (error) throw error
    if (data === null && allowAbsent) {
      selectWorkspaceState(undefined, workspaceCanvasId)
      return
    }
    if (!data || typeof data !== "object" || Array.isArray(data) ||
      !data.state || typeof data.state !== "object" || Array.isArray(data.state)) throw new Error()
    selectWorkspaceState(data.state, workspaceCanvasId)
  } catch {
    throw new Error(WORKSPACE_CANVAS_ACCESS_ERROR)
  }
}
