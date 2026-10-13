import "server-only"

import type { OrganizationPublicationReviewData } from "../types"
import { createHash } from "node:crypto"
import { requireServerSession } from "@/lib/auth"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { projectPublicMapOrganizations, type PublicMapOrganizationRow, type PublicMapProgramRow } from "@/lib/public-map/organization-projection"
import { resolvePublicationLocation } from "../lib/publication-status"

export async function loadOrganizationPublicationReview(): Promise<OrganizationPublicationReviewData> {
  const { supabase, session } = await requireServerSession("/workspace/profile-preview")
  const { orgId, role } = await resolveActiveOrganization(supabase, session.user.id)
  if (!canEditOrganization(role)) return { error: "An organization editor can review and publish this profile." } as const

  const [organizationResult, programsResult] = await Promise.all([
    supabase.from("organizations")
      .select("user_id, profile, location_lat, location_lng, public_slug, is_public, updated_at")
      .eq("user_id", orgId)
      .maybeSingle<PublicMapOrganizationRow & { is_public: boolean; updated_at: string }>(),
    supabase.from("programs")
      .select("id, user_id, title, subtitle, description, created_at, image_url, location_type, location_url, duration_label, features, cta_label, cta_url, start_date, wizard_snapshot")
      .eq("user_id", orgId).eq("is_public", true)
      .order("created_at", { ascending: false }).returns<PublicMapProgramRow[]>(),
  ])
  if (organizationResult.error || programsResult.error) return { error: "We couldn’t load your saved profile. Reload to try again." } as const
  const row = organizationResult.data
  if (!row) return { error: "Add your organization details before reviewing your public profile." } as const
  const organization = projectPublicMapOrganizations([row], programsResult.data ?? [])[0]
  const location = resolvePublicationLocation({
    isPublic: row.is_public,
    online: organization.isOnlineOnly,
    hasAddress: Boolean(organization.address || organization.addressStreet || organization.city),
    latitude: organization.latitude,
    longitude: organization.longitude,
  })
  // Only the allowlisted anonymous projection crosses the server/client boundary.
  // Version also covers selected programs so a stale review cannot publish unseen changes.
  const revision = createHash("sha256").update(JSON.stringify({ organization, updatedAt: row.updated_at, isPublic: row.is_public })).digest("hex")
  return { organization, isPublic: row.is_public, updatedAt: row.updated_at, revision, location } as const
}
