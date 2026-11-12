import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/** Additive to the caller's existing organization/project scope. Retained audit
 * events are not authority to disclose a private or permanently deleted file. */
export async function filterDocumentActivityAudience<T extends { id: string }>(rows: T[], actorId: string): Promise<T[]> {
  if (!rows.length) return rows
  const allowed = new Set<string>()
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  const ids = [...new Set(rows.map(row => row.id))]
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const result = await admin.rpc("filter_document_activity_audience", { p_event_ids: batch, p_actor_id: actorId })
    if (result.error || !Array.isArray(result.data) || result.data.some(id => !batch.includes(id)))
      throw new Error("Activity access could not be verified. Try again.")
    result.data.forEach(id => allowed.add(id))
  }
  return rows.filter(row => allowed.has(row.id))
}
