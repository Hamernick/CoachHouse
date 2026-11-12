import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/** Server-only canvas-filtered input for readers that subsequently project source
 * audiences. Never return its unfiltered state to a client or persist a projection.
 * Ordinary readers keep RLS; only exact source/canvas denials take this path.
 * The RPC independently checks current parent access and the verified actor. */
export async function readWorkspaceBoardForProjection(supabase: SupabaseClient<Database>, orgId: string, actorId: string, signal?: AbortSignal) {
  const query = supabase.from("organization_workspace_boards").select("state").eq("org_id", orgId)
  const result = await (signal ? query.abortSignal(signal) : query).maybeSingle()
  if (result.error?.code !== "42501" || !["Board source access required.", "Workspace audience access required."].includes(result.error.message)) return result
  try {
    const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
    const fallback = await admin.rpc("read_workspace_canvas_projection", { p_org_id: orgId, p_actor_id: actorId })
    if (fallback.error) return { data: null, error: fallback.error }
    if (fallback.data === null) return { data: null, error: null }
    if (typeof fallback.data !== "object" || Array.isArray(fallback.data) ||
      !("state" in fallback.data) || typeof fallback.data.state !== "object" ||
      !fallback.data.state || Array.isArray(fallback.data.state)) return { data: null, error: result.error }
    return { data: { state: fallback.data.state as Json }, error: null }
  } catch { return { data: null, error: result.error } }
}
