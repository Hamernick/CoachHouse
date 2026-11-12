import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { PageActor } from "./page-context"
import { WorkspaceSharingError } from "./page-projection"

/** Current management authority, including deleted-canvas recovery. Never use
 * this for public or explicitly invited snapshot readers. */
export async function pageManagementCanvases(actor: PageActor, canvases: (string | null)[]) {
  const requested = [...new Set(canvases.map(id => id ?? "default"))]
  try {
    const admin = createSupabaseAdminClient({ actorId: actor.actorId, requestTimeoutMs: 15_000 })
    const { data, error } = await admin.rpc("filter_workspace_page_management_canvases", {
      p_org_id: actor.orgId, p_actor_id: actor.actorId, p_canvas_ids: requested,
    })
    if (error || !Array.isArray(data) || data.some(id => typeof id !== "string" || !requested.includes(id)) ||
      new Set(data).size !== data.length) throw new Error()
    return new Set(data)
  } catch {
    throw new WorkspaceSharingError("scope", "Page access could not be verified. Reload and try again.")
  }
}

export async function assertPageCanvasManagement(actor: PageActor, canvasId: string | null) {
  if (!(await pageManagementCanvases(actor, [canvasId])).has(canvasId ?? "default"))
    throw new WorkspaceSharingError("scope", "You no longer have permission to manage this page.")
}
