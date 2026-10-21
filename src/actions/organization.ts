/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { persistOrganizationProfile } from "@/lib/organization/profile-persistence-write"
import { prepareOrganizationBrandIdentitySave, matchesBrandOrganizationContext } from "@/lib/organization/brand-identity-persistence"
import type { OrganizationBrandIdentity } from "@/lib/organization/brand-identity-schema"

import { revalidatePath, revalidateTag } from "next/cache"

import { resolveCoreDocumentPublication, type CoreDocumentPublicationPatch } from "@/lib/roadmap/core-document-publication"
import { ORGANIZATION_CORE_DOCUMENT_SECTION_IDS, updateRoadmapSection } from "@/lib/roadmap"
import { requireServerSession } from "@/lib/auth"
import { geocodeOrganizationLocation } from "@/lib/geocoding/geocode"
import { buildOrganizationAddress } from "@/lib/geocoding/organization-address"
import {
  normalizeOrganizationLocationFields,
  normalizeWhitespace,
} from "@/lib/location/organization-location"
import type { BrandTypographyConfig } from "@/lib/organization/org-profile-brand-types"
import type { Database } from "@/lib/supabase"
import {
  sanitizeOrgProfileText,
  shouldStripOrgProfileHtml,
} from "@/lib/organization/profile-cleanup"
import { normalizeExternalUrl } from "@/lib/organization/urls"
import {
  findOrganizationNarrativeRevisionConflict,
  normalizeOrganizationNarrativeHtml,
  resolveOrganizationCoreDocuments,
  type OrganizationNarratives,
  type OrganizationCoreDocuments,
  type OrganizationNarrativeRevisions,
  resolveOrganizationNarrativeRevisions,
  resolveOrganizationNarratives,
  updateOrganizationNarratives,
  updateOrganizationCoreDocuments,
} from "@/lib/roadmap"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { getApprovedFormationEinError } from "@/lib/organization/formation-status"
import { validateOrganizationProfilePersistencePatch } from "@/lib/organization/profile-persistence-validation"
import {
  ORG_MEDIA_BUCKET,
  resolveOrgMediaCleanupPath,
} from "@/lib/storage/org-media"

type OrgProfilePayload = {
  name?: string | null
  description?: string | null
  tagline?: string | null
  ein?: string | null
  formationStatus?: "pre_501c3" | "in_progress" | "approved" | null
  rep?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  addressStreet?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressPostal?: string | null
  addressCountry?: string | null
  locationType?: "in_person" | "online" | null
  locationUrl?: string | null
  logoUrl?: string | null
  brandMarkUrl?: string | null
  headerUrl?: string | null
  publicUrl?: string | null
  donateUrl?: string | null
  twitter?: string | null
  facebook?: string | null
  linkedin?: string | null
  instagram?: string | null
  youtube?: string | null
  tiktok?: string | null
  newsletter?: string | null
  github?: string | null
  vision?: string | null
  mission?: string | null
  need?: string | null
  values?: string | null
  originStory?: string | null
  theoryOfChange?: string | null
  programs?: string | null
  reports?: string | null
  boilerplate?: string | null
  brandVoiceAudience?: string | null
  brandVoiceTone?: string | null
  brandVoiceStyle?: string | null
  brandVoicePersonality?: string | null
  brandVoiceGuidelines?: string | null
  brandVoiceAvoid?: string | null
  brandPrimary?: string | null
  brandColors?: string[] | null
  brandThemePresetId?: string | null
  brandAccentPresetId?: string | null
  brandTypographyPresetId?: string | null
  brandTypography?: BrandTypographyConfig | null
  publicSlug?: string | null
  isPublic?: boolean | null
  coreDocumentPublication?: CoreDocumentPublicationPatch
  brandIdentity?: OrganizationBrandIdentity
  expectedOrganizationId?: string
  narrativeRevisions?: OrganizationNarrativeRevisions
}

export async function updateOrganizationProfileAction(
  payload: OrgProfilePayload,
  expectedReview?: { organizationId: string; updatedAt: string },
) {
  const { supabase, session } = await requireServerSession("/organization")

  const userId = session.user.id
  const { orgId, role } = await resolveActiveOrganization(supabase, userId)
  const canEdit = canEditOrganization(role)
  if (!canEdit) return { error: "Forbidden" }
  if (!matchesBrandOrganizationContext(payload, orgId)) {
    return { error: "Your active organization changed. Reload before saving the brand kit." }
  }
  if (expectedReview && expectedReview.organizationId !== orgId) return { error: "Your active organization changed. Reload the preview before publishing." }

  const validation = validateOrganizationProfilePersistencePatch(payload)
  if (!validation.success) {
    return { error: validation.error, field: validation.field }
  }

  if (typeof payload.name === "string") {
    payload = { ...payload, name: payload.name.trim() }
  }

  if (typeof payload.ein === "string") {
    payload = { ...payload, ein: payload.ein.trim() }
  }

  // Load existing profile to merge
  const { data: orgRow, error: orgErr } = await supabase
    .from("organizations")
    .select(
      "ein, profile, location_lat, location_lng, public_slug, is_public, updated_at"
    )
    .eq("user_id", orgId)
    .maybeSingle<{
      ein: string | null
      profile: Record<string, unknown> | null
      location_lat: number | null
      location_lng: number | null
      public_slug: string | null
      is_public: boolean | null
      updated_at: string
    }>()

  if (orgErr) {
    return { error: orgErr.message }
  }

  if (expectedReview && expectedReview.updatedAt !== orgRow?.updated_at) return { error: "This organization was updated elsewhere. Reload before publishing." }

  const current = (orgRow?.profile ?? {}) as Record<string, unknown>
  const brandSave = await prepareOrganizationBrandIdentitySave({ supabase, orgId, incoming: payload.brandIdentity })
  if ("error" in brandSave) return { error: brandSave.error, field: "brandIdentity" }
  // Only formation/EIN writes enforce this rule; unrelated partial saves must
  // remain usable for legacy approved profiles that have not supplied an EIN.
  if (Object.hasOwn(payload, "formationStatus") || Object.hasOwn(payload, "ein")) {
    const formationStatus = Object.hasOwn(payload, "formationStatus")
      ? payload.formationStatus
      : current.formationStatus
    const ein = Object.hasOwn(payload, "ein") ? payload.ein : (orgRow?.ein ?? current.ein)
    const einError = getApprovedFormationEinError(formationStatus, ein)
    if (einError) return { error: einError, field: "ein" }
  }
  const currentPublication = resolveCoreDocumentPublication(current)
  for (const key of Object.keys(currentPublication) as Array<keyof typeof currentPublication>) {
    const expected = payload.coreDocumentPublication?.[key]
    if (expected && expected.lastUpdated !== currentPublication[key].lastUpdated) {
      return { error: "This core document was updated elsewhere. Reload before saving.", conflict: key }
    }
  }
  const previousLogoUrl = profileString(current, "logoUrl")
  const previousBrandMarkUrl = profileString(current, "brandMarkUrl")
  const previousHeaderUrl = profileString(current, "headerUrl")
  const logoTouched = Object.prototype.hasOwnProperty.call(payload, "logoUrl")
  const brandMarkTouched = Object.prototype.hasOwnProperty.call(
    payload,
    "brandMarkUrl"
  )
  const headerTouched = Object.prototype.hasOwnProperty.call(
    payload,
    "headerUrl"
  )
  let next: Record<string, unknown> = { ...current }
  const currentNarratives = resolveOrganizationNarratives(current)
  const narrativeUpdates: Partial<OrganizationNarratives> = {}
  for (const key of ["mission", "vision", "values"] as const) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
    const value = payload[key]
    const normalized = normalizeOrganizationNarrativeHtml(
      typeof value === "string" ? value : ""
    )
    if (normalized !== currentNarratives[key])
      narrativeUpdates[key] = normalized
  }
  const currentCoreDocuments = resolveOrganizationCoreDocuments(current)
  const coreDocumentUpdates: Partial<OrganizationCoreDocuments> = {}
  for (const key of ["need", "originStory", "theoryOfChange"] as const) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
    const value = payload[key]
    const normalized = normalizeOrganizationNarrativeHtml(
      typeof value === "string" ? value : ""
    )
    if (normalized !== currentCoreDocuments[key]) {
      coreDocumentUpdates[key] = normalized
    }
  }
  const narrativeConflict = findOrganizationNarrativeRevisionConflict({
    profile: current,
    updates: narrativeUpdates,
    expectedRevisions: payload.narrativeRevisions,
  })
  if (narrativeConflict) {
    return {
      error: `${narrativeConflict[0].toUpperCase()}${narrativeConflict.slice(1)} was updated elsewhere. Reload before saving.`,
      conflict: narrativeConflict,
    }
  }
  const urlFields = new Set([
    "publicUrl",
    "donateUrl",
    "newsletter",
    "twitter",
    "facebook",
    "linkedin",
    "instagram",
    "youtube",
    "tiktok",
    "github",
    "logoUrl",
    "brandMarkUrl",
    "headerUrl",
  ])

  for (const [k, v] of Object.entries(payload)) {
    if (["expectedOrganizationId", "brandIdentity", "narrativeRevisions", "coreDocumentPublication"].includes(k)) continue
    if (k === "mission" || k === "vision" || k === "values") continue
    if (k === "need" || k === "originStory" || k === "theoryOfChange") continue
    // Store EIN in both the column and profile for now (column is canonical)
    if (k === "ein") {
      next[k] = v ?? null
    } else if (k === "formationStatus") {
      const trimmed = typeof v === "string" ? v.trim() : ""
      next[k] =
        trimmed === "pre_501c3" ||
        trimmed === "in_progress" ||
        trimmed === "approved"
          ? trimmed
          : null
    } else if (k === "locationType") {
      const trimmed = typeof v === "string" ? v.trim() : ""
      next.location_type =
        trimmed === "online" || trimmed === "in_person" ? trimmed : null
    } else if (k === "locationUrl") {
      next.location_url = typeof v === "string" ? normalizeExternalUrl(v) : null
    } else {
      if (typeof v === "string") {
        if (urlFields.has(k)) {
          next[k] = normalizeExternalUrl(v)
          continue
        }
        if (shouldStripOrgProfileHtml(k)) {
          next[k] = sanitizeOrgProfileText(v)
        } else {
          next[k] = v.length === 0 ? null : v
        }
      } else if (Array.isArray(v)) {
        next[k] = v.filter((x) => typeof x === "string" && x.trim().length > 0)
      } else {
        next[k] = v
      }
    }
  }

  next = updateOrganizationNarratives(next, narrativeUpdates).nextProfile
  next = updateOrganizationCoreDocuments(next, coreDocumentUpdates).nextProfile
  for (const key of Object.keys(currentPublication) as Array<keyof typeof currentPublication>) {
    const status = payload.coreDocumentPublication?.[key]?.status
    if (status) {
      next = updateRoadmapSection(next, ORGANIZATION_CORE_DOCUMENT_SECTION_IDS[key], { status }).nextProfile
    }
  }

  const addressMapping: Array<[keyof OrgProfilePayload, string]> = [
    ["addressStreet", "address_street"],
    ["addressCity", "address_city"],
    ["addressState", "address_state"],
    ["addressPostal", "address_postal"],
    ["addressCountry", "address_country"],
  ]

  for (const [camel, snake] of addressMapping) {
    const raw = payload[camel]
    let normalized: string | null
    if (typeof raw === "string") {
      const trimmed = normalizeWhitespace(raw)
      normalized = trimmed.length > 0 ? trimmed : null
    } else if (raw === null) {
      normalized = null
    } else {
      const existing = next[snake] as string | null | undefined
      const trimmed = normalizeWhitespace(existing)
      normalized = trimmed.length > 0 ? trimmed : null
    }
    next[snake] = normalized
    delete next[camel as string]
  }

  const normalizedLocation = normalizeOrganizationLocationFields({
    street: next["address_street"],
    city: next["address_city"],
    state: next["address_state"],
    postal: next["address_postal"],
    country: next["address_country"],
  })
  next["address_street"] = normalizedLocation.street || null
  next["address_city"] = normalizedLocation.city || null
  next["address_state"] = normalizedLocation.state || null
  next["address_postal"] = normalizedLocation.postal || null
  next["address_country"] = normalizedLocation.country || null

  const fallbackAddress =
    typeof payload.address === "string" &&
    normalizeWhitespace(payload.address).length > 0
      ? normalizeWhitespace(payload.address)
      : typeof current["address"] === "string" &&
          normalizeWhitespace(current["address"]).length > 0
        ? normalizeWhitespace(current["address"])
        : null

  next.address = buildOrganizationAddress({
    street: normalizedLocation.street,
    city: normalizedLocation.city,
    state: normalizedLocation.state,
    postal: normalizedLocation.postal,
    country: normalizedLocation.country,
    fallbackAddress,
  })

  // Do not delete unknown keys; preserve previously stored profile fields for forward compatibility.

  // Normalize slug if provided, or derive from name when publishing
  const desiredSlug =
    typeof payload.publicSlug === "string" && payload.publicSlug.length > 0
      ? payload.publicSlug
      : payload.isPublic
        ? String(payload.name ?? current["name"] ?? "")
        : ""
  const normalizedSlugRaw = desiredSlug ? slugify(desiredSlug) : undefined
  const normalizedSlug =
    normalizedSlugRaw && normalizedSlugRaw.length > 0
      ? normalizedSlugRaw
      : undefined

  let locationLat = orgRow?.location_lat ?? null
  let locationLng = orgRow?.location_lng ?? null

  const nextLogoUrl =
    typeof next["logoUrl"] === "string" ? (next["logoUrl"] as string) : null
  const nextBrandMarkUrl =
    typeof next["brandMarkUrl"] === "string"
      ? (next["brandMarkUrl"] as string)
      : null
  const nextHeaderUrl =
    typeof next["headerUrl"] === "string" ? (next["headerUrl"] as string) : null
  const cleanupPaths = new Set<string>()
  if (logoTouched) {
    const cleanupPath = resolveOrgMediaCleanupPath({
      previousUrl: previousLogoUrl,
      nextUrl: nextLogoUrl,
      userId: orgId,
    })
    if (cleanupPath) cleanupPaths.add(cleanupPath)
  }
  if (brandMarkTouched) {
    const cleanupPath = resolveOrgMediaCleanupPath({
      previousUrl: previousBrandMarkUrl,
      nextUrl: nextBrandMarkUrl,
      userId: orgId,
    })
    if (cleanupPath) cleanupPaths.add(cleanupPath)
  }
  if (headerTouched) {
    const cleanupPath = resolveOrgMediaCleanupPath({
      previousUrl: previousHeaderUrl,
      nextUrl: nextHeaderUrl,
      userId: orgId,
    })
    if (cleanupPath) cleanupPaths.add(cleanupPath)
  }

  const isOnlineOnly = next.location_type === "online"
  if (isOnlineOnly || (typeof next.address !== "string" && !fallbackAddress)) {
    locationLat = null
    locationLng = null
  } else if (!orgRow || ["address", "addressStreet", "addressCity", "addressState", "addressPostal", "addressCountry", "locationType"].some((key) => key in payload)) {
    const coords = await geocodeOrganizationLocation({
      street: normalizedLocation.street,
      city: normalizedLocation.city,
      state: normalizedLocation.state,
      postal: normalizedLocation.postal,
      country: normalizedLocation.country,
      fallbackAddress,
    })
    const addressChanged = normalizeWhitespace(next.address) !== normalizeWhitespace(current.address)
    if (coords || addressChanged) {
      locationLat = coords?.lat ?? null
      locationLng = coords?.lng ?? null
    }
  }

  const insertPayload: any = {
    user_id: orgId,
    ein: typeof payload.ein === "string" ? payload.ein : (orgRow?.ein ?? null),
    public_slug: normalizedSlug ?? undefined,
    is_public: payload.isPublic ?? undefined,
    profile:
      next as unknown as Database["public"]["Tables"]["organizations"]["Insert"]["profile"],
    location_lat: locationLat,
    location_lng: locationLng,
  }

  const persistence = await persistOrganizationProfile({
    supabase, orgId, expectedUpdatedAt: orgRow?.updated_at, brandIdentity: brandSave.value,
    expectedBrandRevision: payload.brandIdentity?.revision, profilePatch: insertPayload,
  })
  if ("error" in persistence) return persistence

  if (cleanupPaths.size > 0) {
    await supabase.storage
      .from(ORG_MEDIA_BUCKET)
      .remove(Array.from(cleanupPaths))
  }

  const previousSlug =
    typeof orgRow?.public_slug === "string" && orgRow.public_slug.length > 0
      ? orgRow.public_slug
      : null
  const nextSlug = normalizedSlug ?? previousSlug
  const wasPublic = Boolean(orgRow?.is_public)
  const isPublic =
    typeof payload.isPublic === "boolean" ? payload.isPublic : wasPublic

  revalidateOrganizationViews({
    previousSlug,
    nextSlug,
    wasPublic,
    isPublic,
  })
  return {
    ok: true,
    ...(brandSave.value ? { brandIdentity: brandSave.value } : {}),
    coreDocumentPublication: resolveCoreDocumentPublication(next),
    narrativeRevisions: resolveOrganizationNarrativeRevisions(next),
    location: { latitude: locationLat, longitude: locationLng },
  }
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
  return base.slice(0, 60).replace(/^-+|-+$/g, "")
}

function revalidateOrganizationViews({
  previousSlug,
  nextSlug,
  wasPublic,
  isPublic,
}: {
  previousSlug: string | null
  nextSlug: string | null
  wasPublic: boolean
  isPublic: boolean
}) {
  revalidatePath("/workspace")
  revalidatePath("/workspace/roadmap", "layout")
  revalidatePath("/my-organization")
  revalidatePath("/organization")
  revalidatePath("/map")
  revalidatePath("/resources")

  if (isPublic || wasPublic) {
    revalidateTag("public-map-organizations", { expire: 0 })
    revalidateTag("public-profiles", { expire: 0 })
    revalidatePath("/community")
  }

  if (previousSlug) {
    revalidatePath(`/${previousSlug}`)
    revalidatePath(`/${previousSlug}`)
  }

  if (nextSlug && nextSlug !== previousSlug) {
    revalidatePath(`/${nextSlug}`)
    revalidatePath(`/${nextSlug}`)
  }
}

function profileString(profile: Record<string, unknown>, key: string) {
  return typeof profile[key] === "string" ? profile[key] : null
}
