import "server-only"
import type { WorkspaceAiSourceScope } from "./workspace-ai-source-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"
import { filterAiDocumentCopies } from "./document-ai-copies"

/** Current editor sources plus known retained-copy restrictions. Parent
 * organization/canvas authorization must precede this service-side check. */
export async function inaccessibleEditorDocuments(ids: Iterable<string>, organizationId: string, actorId: string, scope?: WorkspaceAiSourceScope) {
  const requested = new Set(ids)
  if (!requested.size) return new Set<string>()
  const client = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
  const { data, error } = await client.from("organizations").select("profile")
    .eq("user_id", organizationId).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
  if (error || !data?.profile || typeof data.profile !== "object" || Array.isArray(data.profile))
    throw new Error("Document sources could not be verified. Try again.")
  const sections = resolveRoadmapSections(data.profile)
  const selected = new Map([...requested].map(id => [id,
    sections.find(section => section.id === id) ?? sections.find(section => section.slug === id),
  ]))
  const editorSections = [...new Map([...selected.values()].flatMap(section =>
    section && resolveCoreDocumentSource(section) === "editor" ? [[section.id, section] as const] : [],
  )).values()]
  const readable = new Set((await filterAiDocumentCopies(editorSections, organizationId, actorId, scope)).map(section => section.id))
  return new Set([...requested].filter(id => {
    const section = selected.get(id)
    return !section || resolveCoreDocumentSource(section) !== "editor" || !readable.has(section.id)
  }))
}
