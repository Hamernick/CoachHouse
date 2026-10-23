import "server-only"
import { organizationDocumentCollaborationEnabled } from "@/lib/feature-flags"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveDocumentCapabilities } from "@/lib/organization/document-capabilities"
import { DOCUMENT_STORAGE_UPGRADE_MESSAGE } from "@/lib/organization/document-storage-access"
import { DocumentOperationError, documentTrace } from "./diagnostics"
import type { DocumentScope } from "../types"

export async function documentContext(scope: DocumentScope, write = false, trace?: ReturnType<typeof documentTrace>) {
  if (!organizationDocumentCollaborationEnabled) throw new Error("Document collaboration is not enabled yet.")
  if (!/^[0-9a-f-]{36}$/i.test(scope.organizationId) || !/^[a-zA-Z0-9_-]{1,160}$/.test(scope.sectionId)) throw new DocumentOperationError("invalid", "Invalid document.")
  const client = await createSupabaseServerClient()
  const authenticate = () => client.auth.getUser()
  const { data: { user }, error } = await (trace ? trace.measure("authenticate", authenticate) : authenticate())
  if (error && (!error.status || error.status === 429 || error.status >= 500)) {
    throw new DocumentOperationError("unavailable", "Sign-in verification is temporarily unavailable. Your edits are retained; try again shortly.")
  }
  if (error || !user) throw new DocumentOperationError("unauthenticated", "Sign in again to access this document.")
  const authorize = () => resolveDocumentCapabilities(client, user.id, scope.organizationId)
  const resolved = await (trace ? trace.measure("capabilities", authorize) : authorize())
  if ("error" in resolved) throw new DocumentOperationError(resolved.code ?? "unavailable", resolved.code === "denied"
    ? "You no longer have access to edit this document. Your local copy is retained."
    : "Unable to verify document access. Try again.")
  const { access, capabilities } = resolved
  if (write && !capabilities.canEdit) throw new DocumentOperationError("denied", capabilities.reason === "upgrade" ? DOCUMENT_STORAGE_UPGRADE_MESSAGE : "This document is read-only.")
  return { user, client, capabilities, admin: createSupabaseAdminClient({ actorId: user.id }) as SupabaseClient, role: "staffAccessLevel" in access ? access.staffAccessLevel === "coach" ? "Coach" : "Coach House admin" : access.role }
}
