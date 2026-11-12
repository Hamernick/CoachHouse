import "server-only"
import { filterWorkspaceAiSourceIds, type WorkspaceAiSourceScope } from "./workspace-ai-source-context"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/** Additive source filter AFTER the existing parent/support authorization.
 * actorId must be authenticated server-side. No cross-request authority cache.
 * Retain row order and fail the entire read if any batch cannot be verified. */
export async function filterDocumentFileAudience<T extends { id: string }>(rows: T[], actorId: string, scope?: WorkspaceAiSourceScope): Promise<T[]> {
  if (!rows.length) return rows
  if (scope) {
    const allowed = new Set(await filterWorkspaceAiSourceIds(rows.map(row => row.id), "file", actorId, scope))
    return rows.filter(row => allowed.has(row.id))
  }
  const allowed = new Set<string>()
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  const ids = [...new Set(rows.map(row => row.id))]
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const result = await admin.rpc("filter_document_file_audience", { p_file_ids: batch, p_actor_id: actorId })
    if (result.error || !Array.isArray(result.data) || result.data.some(id => !batch.includes(id)))
      throw new Error("Document access could not be verified. Try again.")
    result.data.forEach(id => allowed.add(id))
  }
  return rows.filter(row => allowed.has(row.id))
}
