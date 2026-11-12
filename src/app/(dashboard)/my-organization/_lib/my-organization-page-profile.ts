import { readOrganizationProfileForProjection } from "@/lib/organization/profile-read"
import { loadOrganizationBrandIdentity } from "@/lib/organization/brand-identity-persistence"
import { cleanupOrgProfileHtml } from "@/lib/organization/profile-cleanup"
import { projectReadableDocumentProfile } from "@/lib/organization/document-ai-copies"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { supabaseErrorToError } from "@/lib/supabase/errors"

import { buildInitialOrganizationProfile } from "./helpers"

type MyOrganizationSupabase = NonNullable<
  Awaited<ReturnType<typeof resolveOptionalAuthenticatedAppContext>>
>["supabase"]

export async function loadMyOrganizationProfileContext({
  orgId,
  actorId,
  supabase,
}: {
  orgId: string
  actorId: string
  supabase: MyOrganizationSupabase
}) {
  const { data: orgRow, error } = await readOrganizationProfileForProjection(supabase, orgId, actorId)

  if (error) throw supabaseErrorToError(error, "Unable to load organization setup.")
  const { profile, roadmapSections } = await projectReadableDocumentProfile(
    cleanupOrgProfileHtml(orgRow?.profile ?? {}).nextProfile, orgId, actorId,
  )

  const initialProfile = buildInitialOrganizationProfile({
    organizationId: orgId,
    brandIdentity: await loadOrganizationBrandIdentity(supabase, orgId),
    profile,
    organization: orgRow ?? null,
  })

  return {
    initialProfile,
    orgRow: orgRow ? { ...orgRow, profile } : null,
    profile,
    roadmapSections,
  }
}
