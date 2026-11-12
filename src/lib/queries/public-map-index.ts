import { filterPublicOrganizationProfiles } from "@/lib/organization/public-document-audience"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { env } from "@/lib/env"
import { unstable_cache } from "next/cache"
import { projectPublicMapOrganizations, type PublicMapOrganizationRow, type PublicMapProgramRow, type PublicMapOrganization } from "@/lib/public-map/organization-projection"
export type { PublicMapProgramPreview, PublicMapActivityLinkSource, PublicMapOrganization } from "@/lib/public-map/organization-projection"

type PublicMapInputs = { organizations: PublicMapOrganizationRow[]; programs: PublicMapProgramRow[] }

// Server-only cache of inputs. Never cache or return an admitted projection here.
async function fetchPublicMapOrganizationsUncached(): Promise<PublicMapInputs> {
  const supabase = createSupabaseAdminClient()
  const { data: orgRows, error: orgError } = await supabase
    .from("organizations")
    .select("user_id, ein, profile, location_lat, location_lng, public_slug")
    .eq("is_public", true)
    .returns<
      Array<{
        user_id: string
        ein: string | null
        profile: unknown
        location_lat: number | null
        location_lng: number | null
        public_slug: string | null
      }>
    >()

  if (orgError) {
    console.error("[public-map] organization query failed", {
      code: orgError.code,
      message: orgError.message,
    })
    throw new Error("Unable to load public map organizations.")
  }

  if (!orgRows || orgRows.length === 0) {
    return { organizations: [], programs: [] }
  }

  const orgIds = orgRows.map((row) => row.user_id)
  const { data: programRows } = await supabase
    .from("programs")
    .select(
      "id, user_id, title, subtitle, description, created_at, image_url, location_type, location_url, duration_label, features, cta_label, cta_url, start_date, wizard_snapshot"
    )
    .in("user_id", orgIds)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .returns<PublicMapProgramRow[]>()

  return { organizations: orgRows, programs: programRows ?? [] }
}

const fetchPublicMapOrganizationsCached = unstable_cache(
  async (): Promise<PublicMapInputs> =>
    fetchPublicMapOrganizationsUncached(),
  ["public-map-organization-inputs-v10"],
  { revalidate: 300, tags: ["public-map-organizations"] }
)

export async function fetchPublicMapOrganizations(): Promise<
  PublicMapOrganization[]
> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }

  const inputs = await fetchPublicMapOrganizationsCached()
  const organizations = await filterPublicOrganizationProfiles(inputs.organizations)
  return projectPublicMapOrganizations(organizations, inputs.programs)
}
