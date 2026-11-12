"use server"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveDocumentCapabilities } from "@/lib/organization/document-capabilities"
import { readOrganizationProfileForProjection } from "@/lib/organization/profile-read"
import { filterAiDocumentCopies } from "@/lib/organization/document-ai-copies"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"

const inputSchema = z.object({
  organizationId: z.string().uuid(), userId: z.string().uuid(),
  sectionIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/)).max(100),
}).strict()

/** Revalidate retained native core editors without returning or replacing bodies.
 * Expected user is a scope assertion, never an authentication credential. */
export async function revalidateCoreDocuments(input: z.input<typeof inputSchema>) {
  const scope = inputSchema.parse(input)
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.id !== scope.userId) throw new Error("Document unavailable.")
  const resolved = await resolveDocumentCapabilities(client, user.id, scope.organizationId)
  if ("error" in resolved || resolved.access.orgId !== scope.organizationId) throw new Error("Document unavailable.")
  const current = await readOrganizationProfileForProjection(resolved.access.supabase, scope.organizationId, user.id, AbortSignal.timeout(10000))
  if (current.error || !current.data) throw new Error("Document unavailable.")
  const sections = resolveRoadmapSections(current.data.profile ?? {})
  const selected = [...new Set(scope.sectionIds)].map(id => sections.find(section => section.id === id))
  if (selected.some(section => !section || resolveCoreDocumentSource(section) !== "editor")) throw new Error("Document unavailable.")
  const ids = selected.flatMap(section => section ? [{ id: section.id }] : [])
  const readable = await filterAiDocumentCopies(ids, scope.organizationId, user.id)
  if (readable.length !== ids.length) throw new Error("Document unavailable.")
  return { userId: user.id, organizationId: scope.organizationId, canEdit: resolved.capabilities.canEdit }
}
