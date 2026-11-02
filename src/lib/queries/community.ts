import { currentlyPublicOrganizationIds } from "@/lib/organization/public-read-admission"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type CommunityOrganization = {
  id: string
  name: string
  tagline: string | null
  logoUrl: string | null
  website: string | null
  email: string | null
  latitude: number
  longitude: number
  city: string | null
  state: string | null
  country: string | null
  publicSlug: string | null
}

export async function fetchCommunityOrganizations(): Promise<CommunityOrganization[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("user_id, profile, location_lat, location_lng, public_slug")
    .eq("is_public", true)
    .not("location_lat", "is", null)
    .not("location_lng", "is", null)
    .returns<Array<{
      user_id: string
      profile: unknown
      location_lat: number | null
      location_lng: number | null
      public_slug: string | null
    }>>()

  if (error || !data) {
    return []
  }

  const allowed = await currentlyPublicOrganizationIds(data.map((row) => row.user_id))
  return data
    .filter((row) => allowed.has(row.user_id))
    .map((row) => {
      if (row.location_lat == null || row.location_lng == null) return null
      const profile = (row.profile ?? {}) as Record<string, unknown>
      return {
        id: row.user_id,
        name: String(profile["name"] ?? ""),
        tagline: typeof profile["tagline"] === "string" ? profile["tagline"] : null,
        logoUrl: typeof profile["logoUrl"] === "string" ? profile["logoUrl"] : null,
        website: typeof profile["publicUrl"] === "string" ? profile["publicUrl"] : null,
        email: typeof profile["email"] === "string" ? profile["email"] : null,
        latitude: row.location_lat,
        longitude: row.location_lng,
        city: typeof profile["address_city"] === "string" ? profile["address_city"] : null,
        state: typeof profile["address_state"] === "string" ? profile["address_state"] : null,
        country: typeof profile["address_country"] === "string" ? profile["address_country"] : null,
        publicSlug: typeof row.public_slug === "string" ? row.public_slug : null,
      } satisfies CommunityOrganization
    })
    .filter((item): item is CommunityOrganization => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}
