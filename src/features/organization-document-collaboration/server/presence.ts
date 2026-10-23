import "server-only"
import { documentContext } from "./context"
import { documentTrace, DocumentOperationError } from "./diagnostics"
import type { DocumentSyncInput } from "../types"

export async function syncDocumentPresence(input: DocumentSyncInput) {
  const trace = documentTrace(input, "presence")
  try {
    const { user, client, admin, role } = await trace.measure("authorize", () => documentContext(input))
    if (!input.clientId.startsWith(`${user.id}:`) || input.clientId.length > 100) throw new DocumentOperationError("invalid", "Invalid editing session.")
    if (input.leave === true) {
      const result = await admin.from("organization_core_document_presence").delete().eq("org_id", input.organizationId)
        .eq("section_id", input.sectionId).eq("session_id", input.clientId).eq("actor_id", user.id)
      if (result.error) throw result.error
      return { participants: [] }
    }
    const { data: actor } = await trace.measure("actor", () => client.from("profiles").select("full_name").eq("id", user.id).maybeSingle())
    const selection = input.selection && Number.isSafeInteger(input.selection.anchor) && Number.isSafeInteger(input.selection.head)
      && Number.isSafeInteger(input.selection.version) && input.selection.version >= 0
      && input.selection.anchor >= 0 && input.selection.head >= 0 ? input.selection : null
    const presence = await trace.measure("presence_write", () => admin.from("organization_core_document_presence").upsert({
      org_id: input.organizationId, section_id: input.sectionId, session_id: input.clientId,
      actor_id: user.id, display_name: actor?.full_name?.trim() || "Team member", role,
      mode: input.selection ? "editing" : "viewing", selection, seen_at: new Date().toISOString(),
    }))
    if (presence.error) throw presence.error
    const { data, error } = await trace.measure("presence_read", () => admin.from("organization_core_document_presence")
      .select("session_id,actor_id,display_name,role,mode,selection").eq("org_id", input.organizationId)
      .eq("section_id", input.sectionId).gt("seen_at", new Date(Date.now() - 20_000).toISOString()).limit(50))
    if (error) throw error
    // Cleanup runs only on this optional channel; it cannot delay a document commit.
    const cleanup = await admin.from("organization_core_document_presence").delete()
      .eq("org_id", input.organizationId).lt("seen_at", new Date(Date.now() - 60_000).toISOString())
    if (cleanup.error) trace.failure(cleanup.error)
    trace.success()
    return { participants: data ?? [] }
  } catch (error) { return trace.failure(error) }
}
