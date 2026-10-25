"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { normalizeDocumentEditingInput } from "../lib"
import { readLocalDocument } from "./read-local-document"
import { readDocumentRoom } from "../lib/room-client"
import { documentWindowSchema, type DocumentWindowView } from "../lib/window-contracts"
import type { DocumentEditingInput } from "../types"

/** Explicit open only. No polling, upload, subscription or save side effects. */
export async function loadDocumentEditing(input: DocumentEditingInput) {
  return (await loadDocumentFileView(input)).snapshot
}

/** Return the verified viewer with the read, so a retained client window cannot
 * display a response initiated by the previous signed-in account. */
export async function loadDocumentFileView(input: DocumentEditingInput) {
  const { viewerId, snapshot } = await loadAuthorizedFileView(input)
  return { viewerId, snapshot }
}

/** Discover only an existing room using the real session's RLS. Coach-scoped
 * saved-file reads do not confer direct shared-room privileges. */
export async function loadDocumentWindowView(input: DocumentEditingInput): Promise<DocumentWindowView> {
  const { viewerId, snapshot, sessionClient } = await loadAuthorizedFileView(input)
  let shared: DocumentWindowView["shared"] = { state: "absent" }
  if (snapshot.source.provider === "coach_house") {
    try {
      const room = await readDocumentRoom(sessionClient, snapshot.source)
      shared = !room ? { state: "absent" }
        : Date.parse(room.base_updated_at) === Date.parse(snapshot.updatedAt)
          ? { state: "ready", room } : { state: "unavailable" }
    } catch {
      // The complete authorized saved source remains readable, but never label
      // it as the live draft when direct room access/metadata is unavailable.
      shared = { state: "unavailable" }
    }
  }
  return documentWindowSchema.parse({ viewerId, snapshot, shared })
}

async function loadAuthorizedFileView(input: DocumentEditingInput) {
  const { source } = normalizeDocumentEditingInput(input)
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Sign in to open this document.")
  const active = await resolveOrganizationDocumentAccess(supabase, user.id)
  const access = "error" in active || active.orgId !== source.organizationId
    ? await resolveOrganizationDocumentAccess(supabase, user.id, source.organizationId)
    : active
  if ("error" in access || access.orgId !== source.organizationId)
    throw new Error("You do not have access to this document.")
  if (source.provider !== "coach_house")
    throw new Error("Drive editing requires the provider collaboration adapter. Open the original file in Drive.")
  return { viewerId: user.id, snapshot: await readLocalDocument(access.supabase, source), sessionClient: supabase }
}
