import "server-only"

import { resolvePaidTeamAccessForOrgSubscription } from "@/lib/billing/subscription-access"

export const DOCUMENT_STORAGE_UPGRADE_MESSAGE =
  "Upgrade to create, edit, or upload Coach House documents. Google Drive files remain available on Free."

export async function resolveOrganizationDocumentStorageAccess(
  args: Parameters<typeof resolvePaidTeamAccessForOrgSubscription>[0]
): Promise<{ error: string } | { hasStorageAccess: boolean }> {
  const result = await resolvePaidTeamAccessForOrgSubscription(args)
  if (result.error) return { error: result.error }
  return { hasStorageAccess: result.hasPaidTeamAccess }
}

export async function requireOrganizationDocumentStorage(
  args: Parameters<typeof resolveOrganizationDocumentStorageAccess>[0]
): Promise<{ error: string } | { ok: true }> {
  const result = await resolveOrganizationDocumentStorageAccess(args)
  if ("error" in result) return { error: result.error }
  return result.hasStorageAccess
    ? { ok: true as const }
    : { error: DOCUMENT_STORAGE_UPGRADE_MESSAGE }
}
