import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { z } from "zod"
import { documentSourceSchema } from "../lib"
import { documentRoomError, DocumentRoomError } from "../lib/room-client"
import type { DocumentSource } from "../types"

/** Use the session client and canonical file RLS. No caller-supplied actor,
 * service-role fallback or canvas-invite privilege escalation. */
export async function requireDocumentRoomActor(input: DocumentSource) {
  const source = documentSourceSchema.parse(input)
  if (source.provider !== "coach_house")
    throw new DocumentRoomError("unavailable", "Drive rooms require the validated provider adapter.")
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new DocumentRoomError("access", "Sign in to open the shared document.")
  const { data, error } = await supabase.from("organization_document_files")
    .select("id,name,updated_at,deleted_at")
    .eq("id", source.fileId).eq("org_id", source.organizationId)
    .is("document_kind", null).maybeSingle()
  if (error) throw documentRoomError(error)
  if (!data) throw new DocumentRoomError("access", "This document is unavailable or outside your access.")
  const file = z.object({ id: z.uuid(), name: z.string(), updated_at: z.string(), deleted_at: z.string().nullable() }).parse(data)
  if (file.deleted_at) throw new DocumentRoomError("access", "Restore this file before opening its shared document.")
  if (!/\.(md|markdown)$/i.test(file.name)) throw new DocumentRoomError("unavailable", "This format needs its shared editing adapter.")
  const permission = await supabase.rpc("can_edit_uploaded_document", { p_file_id: source.fileId })
  if (permission.error) throw documentRoomError(permission.error)
  return { supabase, source, userId: user.id, file, editable: permission.data === true }
}
