"use server"

import { documentContext } from "./context"
import { syncOrganizationDocument as syncDocument } from "./sync-document"
import type { DocumentScope, DocumentSyncInput, DocumentVersion } from "../types"

export async function syncOrganizationDocument(input: DocumentSyncInput) { return syncDocument(input) }

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load document history."
}

export async function loadOrganizationDocumentVersions(scope: DocumentScope): Promise<{ versions: DocumentVersion[] } | { error: string }> {
  try {
    const { admin } = await documentContext(scope)
    const { data, error } = await admin.from("organization_core_document_versions")
      .select("id,created_at,actor_id,content").eq("org_id", scope.organizationId).eq("section_id", scope.sectionId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(130)
    if (error) throw new Error("Version history is unavailable.")
    const actorIds = [...new Set((data ?? []).flatMap(version => version.actor_id ? [version.actor_id] : []))]
    const { data: actors } = actorIds.length ? await admin.from("profiles").select("id,full_name").in("id", actorIds) : { data: [] }
    const names = new Map((actors ?? []).map(actor => [actor.id, actor.full_name?.trim()]))
    return { versions: (data ?? []).map(version => ({ ...version,
      actor_name: version.actor_id ? names.get(version.actor_id) || "Team member" : "Original" })) }
  } catch (error) { return { error: message(error) } }
}

export async function leaveOrganizationDocument(scope: DocumentScope, clientId: string) {
  try {
    const { user, admin } = await documentContext(scope)
    await admin.from("organization_core_document_presence").delete()
      .eq("org_id", scope.organizationId).eq("section_id", scope.sectionId)
      .eq("session_id", clientId).eq("actor_id", user.id)
  } catch { /* Presence expires even after permission revocation or disconnect. */ }
}
