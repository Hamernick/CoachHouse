import "server-only"
import { filterWorkspaceAiSourceIds, type WorkspaceAiSourceScope } from "./workspace-ai-source-context"
import { z } from "zod"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { omitDocumentProfileSections } from "@/lib/roadmap/document-profile-projection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { projectLegacyDocumentBindings } from "./legacy-document-bindings"

const sourcesSchema = z.strictObject({
  blockedSectionIds: z.array(z.string().min(1).max(120)).max(500), complete: z.literal(false),
})

/** Filter known invalid saved AI lineage after the caller's current source and
 * storage authorization. This does not certify unknown copies or grant access. */
export async function filterAiDocumentCopies<T extends { id: string }>(
  sections: T[], organizationId: string, actorId: string, scope?: WorkspaceAiSourceScope,
): Promise<T[]> {
  if (!sections.length) return sections
  if (scope) {
    if (scope.organizationId !== organizationId) throw new Error("Workspace context could not be verified. Try again.")
    const allowed = new Set(await filterWorkspaceAiSourceIds(sections.map(section => section.id), "document", actorId, scope))
    return sections.filter(section => allowed.has(section.id))
  }
  const ids = [...new Set(sections.map(section => section.id))]
  const blocked = new Set<string>()
  const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const { data, error } = await admin.rpc("read_workspace_ai_document_copy_sources", {
      p_org_id: organizationId, p_actor_id: actorId, p_section_ids: batch,
    })
    const parsed = sourcesSchema.safeParse(data)
    if (error || !parsed.success || parsed.data.blockedSectionIds.some(id => !batch.includes(id)) ||
      new Set(parsed.data.blockedSectionIds).size !== parsed.data.blockedSectionIds.length)
      throw new Error("Document sources could not be verified. Try again.")
    for (const id of parsed.data.blockedSectionIds) blocked.add(id)
  }
  return sections.filter(section => !blocked.has(section.id))
}

/** Presentation only. Never pass this projection to canonical profile/CAS writes.
 * Remove both stored sections and their legacy aliases before deriving client props. */
export async function projectReadableDocumentProfile(
  profile: Record<string, unknown>, organizationId: string, actorId: string, scope?: WorkspaceAiSourceScope,
) {
  const sections = resolveRoadmapSections(profile)
  const [roadmapSections, boundProfile] = await Promise.all([
    filterAiDocumentCopies(sections, organizationId, actorId, scope),
    projectLegacyDocumentBindings(profile, organizationId, actorId, scope),
  ])
  return { profile: omitDocumentProfileSections(boundProfile, sections, roadmapSections), roadmapSections }
}
