import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { changeWorkspaceCatalog, summarizeWorkspaces, type WorkspaceCommand } from "../lib"

/** Only exact raw-board source or canvas denials enter here. Canonical content stays
 * server-side; the commit RPC checks fresh editor authority and full-state CAS.
 * Its existing source-write fence rejects deletion of inaccessible content. */
export async function saveRestrictedWorkspaceCatalog(command: WorkspaceCommand, actorId: string) {
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  for (let attempt = 0; attempt < 4; attempt++) {
    const read = await admin.rpc("read_workspace_particle_board_for_projection", { p_org_id: command.orgId, p_actor_id: actorId })
    if (read.error || !read.data || typeof read.data !== "object" || Array.isArray(read.data) ||
      !read.data.state || typeof read.data.state !== "object" || Array.isArray(read.data.state))
      throw new Error("Unable to load workspaces. Try again.")
    const state = changeWorkspaceCatalog(read.data.state, command, new Date().toISOString())
    const write = await admin.rpc("commit_workspace_catalog", {
      p_org_id: command.orgId, p_actor_id: actorId, p_expected_state: read.data.state, p_state: state,
    })
    if (write.error?.code === "42501") throw new Error("You no longer have access to change this workspace or its contents.")
    if (write.error?.code === "40001" || (!write.error && write.data === false)) continue
    if (write.error || write.data !== true) throw new Error("Unable to confirm the save. Retry to confirm your workspace.")
    const visible = await admin.rpc("read_workspace_canvas_projection", { p_org_id: command.orgId, p_actor_id: actorId })
    if (visible.error || !visible.data || typeof visible.data !== "object" || Array.isArray(visible.data) || !visible.data.state)
      throw new Error("Unable to load saved workspaces. Refresh and try again.")
    return { ok: true as const, workspaces: summarizeWorkspaces(visible.data.state), id: command.id }
  }
  throw new Error("The workspace changed while saving. Please try again.")
}
