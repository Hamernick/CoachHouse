import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type WorkspaceAiSourceScope = { organizationId: string; canvasId: string | null }
const response = z.strictObject({ fileIds: z.array(z.uuid()).max(500), sectionIds: z.array(z.string()).max(500) })

/** Eligibility is checked afresh, including on extraction-cache hits and saved
 * conversation reads. Personal access never substitutes for workspace context. */
export async function filterWorkspaceAiSourceIds(
  ids: string[], kind: "file" | "document", actorId: string, scope: WorkspaceAiSourceScope,
) {
  if (!ids.length) return []
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  const allowed = new Set<string>()
  const unique = [...new Set(ids)]
  for (let offset = 0; offset < unique.length; offset += 500) {
    const batch = unique.slice(offset, offset + 500)
    const { data, error } = await admin.rpc("filter_workspace_ai_sources", {
      p_org_id: scope.organizationId, p_canvas_id: scope.canvasId ?? "default", p_actor_id: actorId,
      p_file_ids: kind === "file" ? batch : [], p_section_ids: kind === "document" ? batch : [],
    })
    const parsed = response.safeParse(data)
    if (error || !parsed.success) throw new Error("Workspace context could not be verified. Try again.")
    const values = kind === "file" ? parsed.data.fileIds : parsed.data.sectionIds
    const other = kind === "file" ? parsed.data.sectionIds : parsed.data.fileIds
    if (other.length || new Set(values).size !== values.length || values.some(id => !batch.includes(id)))
      throw new Error("Workspace context could not be verified. Try again.")
    for (const id of values) allowed.add(id)
  }
  return ids.filter(id => allowed.has(id))
}
