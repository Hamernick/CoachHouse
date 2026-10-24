import { loadOrganizationBrandIdentity } from "@/lib/organization/brand-identity-persistence"
import { cleanupOrgProfileHtml } from "@/lib/organization/profile-cleanup"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { supabaseErrorToError } from "@/lib/supabase/errors"

import { buildInitialOrganizationProfile } from "./helpers"

type MyOrganizationSupabase = NonNullable<
  Awaited<ReturnType<typeof resolveOptionalAuthenticatedAppContext>>
>["supabase"]

export async function loadMyOrganizationProfileContext({
  orgId,
  supabase,
}: {
  orgId: string
  supabase: MyOrganizationSupabase
}) {
  const { data: orgRow, error } = await supabase
    .from("organizations")
    .select("ein, profile, public_slug, is_public, location_lat, location_lng")
    .eq("user_id", orgId)
    .maybeSingle<{
      ein: string | null
      profile: Record<string, unknown> | null
      public_slug: string | null
      is_public: boolean | null
      location_lat: number | null
      location_lng: number | null
    }>()

  if (error) throw supabaseErrorToError(error, "Unable to load organization setup.")
  const profile = cleanupOrgProfileHtml(orgRow?.profile ?? {}).nextProfile

  const initialProfile = buildInitialOrganizationProfile({
    organizationId: orgId,
    brandIdentity: await loadOrganizationBrandIdentity(supabase, orgId),
    profile,
    organization: orgRow ?? null,
  })
  const roadmapSections = resolveRoadmapSections(profile)

  return {
    initialProfile,
    orgRow,
    profile,
    roadmapSections,
  }
}
