import { filterAiDocumentCopies } from "@/lib/organization/document-ai-copies"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"
import "server-only"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { requireOrganizationDocumentStorage } from "@/lib/organization/document-storage-access"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { aiDocumentTargetSchema } from "../lib"
import type { AiDocumentTarget } from "../types"

export async function requireAiActor(target: Pick<AiDocumentTarget, "userId" | "organizationId">) {
  aiDocumentTargetSchema.pick({ userId: true, organizationId: true }).parse({ userId: target.userId, organizationId: target.organizationId })
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.id !== target.userId) throw new Error("Sign in again before using this document.")
  const active = await resolveActiveOrganization(client,user.id)
  if (active.orgId !== target.organizationId || !canEditOrganization(active.role))
    throw new Error("Reopen this document in your current organization.")
  const storage = await requireOrganizationDocumentStorage({ supabase: client, orgId: active.orgId })
  if ("error" in storage) throw new Error(storage.error)
  return { client, userId: user.id, organizationId: active.orgId }
}
// Recheck source availability independently of revision conflicts: an old draft
// may still be reviewed after an ordinary edit, but not after switching sources.
export async function loadAiDocumentSource(target: AiDocumentTarget, authorizedActor?: Awaited<ReturnType<typeof requireAiActor>>) {
  aiDocumentTargetSchema.parse(target)
  const actor = authorizedActor ?? await requireAiActor(target)
  const { data, error } = await actor.client.from("organizations").select("profile").eq("user_id",actor.organizationId).single()
  if (error) throw new Error("This document could not be loaded.")
  const section = resolveRoadmapSections((data.profile ?? {}) as Record<string,unknown>).find(item => item.id === target.sectionId)
  if (!section || resolveCoreDocumentSource(section) !== "editor" || ["budget","calendar"].includes(section.id))
    throw new Error("Open an editable core document to use AI assistance.")
  if (!(await filterAiDocumentCopies([section], actor.organizationId, actor.userId)).length)
    throw new Error("This document’s sources are unavailable. Choose another document.")
  return { ...actor, section }
}

export async function loadAiDocument(target: AiDocumentTarget) {
  const loaded = await loadAiDocumentSource(target)
  const { section } = loaded
  if (section.lastUpdated !== target.revision) throw new Error("This document changed. Reopen it before asking for a draft.")
  if (Buffer.byteLength(section.content,"utf8") > 60000) throw new Error("This document exceeds the current AI context limit.")
  return loaded
}

// Metadata only; document bodies are loaded after deliberate selection.
export async function listAiDocuments(scope: Pick<AiDocumentTarget, "userId" | "organizationId">) {
  const actor = await requireAiActor(scope)
  const { data, error } = await actor.client.from("organizations").select("profile").eq("user_id", actor.organizationId).single()
  if (error) throw new Error("Unable to load available documents.")
  const sections = resolveRoadmapSections((data.profile ?? {}) as Record<string, unknown>)
    .filter(section => resolveCoreDocumentSource(section) === "editor" && !["budget", "calendar"].includes(section.id) && section.content.trim())
  return (await filterAiDocumentCopies(sections, actor.organizationId, actor.userId))
    .map(section => ({ sectionId: section.id, title: section.title, revision: section.lastUpdated }))
}

// Explicitly supplied selection text is not a request to read a stored document.
// Its canonical save continues through the owning editor's authorization path.
export async function resolveAiSelectionActor() {
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error("Sign in before using AI assistance.")
  const active = await resolveActiveOrganization(client, user.id)
  if (!active.orgId) throw new Error("Select an organization before using AI assistance.")
  return requireAiActor({ userId: user.id, organizationId: active.orgId })
}
