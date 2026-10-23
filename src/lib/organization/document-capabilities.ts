import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { canEditOrganization } from "./active-org"
import { resolveOrganizationDocumentAccess } from "./document-access"
import { resolveOrganizationDocumentStorageAccess } from "./document-storage-access"
import type { DocumentCapabilities } from "./document-capability-types"

/** userId must come from the authenticated session. Never cache grants across requests. */
export async function resolveDocumentCapabilities(client: SupabaseClient<Database>, userId: string, organizationId: string) {
  const access = await resolveOrganizationDocumentAccess(client, userId, organizationId)
  if ("error" in access) return { error: access.error || "Document access denied.", code: "code" in access && access.code === "unavailable" ? "unavailable" as const : "denied" as const }
  const roleCanEdit = canEditOrganization(access.role)
  if (!roleCanEdit) return { access, capabilities: { canView: true, canViewHistory: true, canEdit: false, reason: "viewer" } satisfies DocumentCapabilities }
  const storage = "supportAccess" in access && access.supportAccess
    ? { hasStorageAccess: true }
    : await resolveOrganizationDocumentStorageAccess({ supabase: access.supabase, orgId: organizationId })
  if ("error" in storage) return { ...storage, code: "unavailable" as const }
  const capabilities: DocumentCapabilities = { canView: true, canViewHistory: true,
    canEdit: roleCanEdit && storage.hasStorageAccess,
    reason: !roleCanEdit ? "viewer" : !storage.hasStorageAccess ? "upgrade" : "editable" }
  return { access, capabilities }
}
