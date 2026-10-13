import { organizationProfileBrandTypographySchema } from "@/lib/organization/profile-persistence-validation"
import { isFormationStatus } from "@/lib/organization/formation-status"
import type { FormationStatus } from "@/lib/organization/org-profile-brand-types"
import type { BrandTypographyConfig } from "@/lib/organization/org-profile-brand-types"
import {
  resolveOrganizationActivityKind,
  type OrganizationActivityKind,
} from "@/lib/organization/primary-objects"
import {
  resolveProgramBannerImageUrl,
  resolveProgramCardChips,
  resolveProgramSummary,
} from "@/lib/programs/display"
import {
  inferPublicMapGroups,
  type PublicMapGroupKey,
} from "@/lib/public-map/groups"
import {
  organizationNarrativeHtmlToPlainText,
  resolvePublicOrganizationProfileNarratives,
} from "@/lib/roadmap"

export type PublicMapProgramPreview = {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  activityKind: OrganizationActivityKind
  chips: string[]
  ctaLabel: string | null
  ctaUrl: string | null
  durationLabel: string | null
  imageUrl: string | null
  locationUrl: string | null
  locationType: "in_person" | "online" | null
  startDate: string | null
}

export type PublicMapActivityLinkSource = Pick<
  PublicMapProgramPreview,
  | "activityKind"
  | "chips"
  | "ctaLabel"
  | "ctaUrl"
  | "description"
  | "durationLabel"
  | "id"
  | "locationType"
  | "locationUrl"
  | "subtitle"
  | "title"
>

export type PublicMapOrganization = {
  id: string
  name: string
  tagline: string | null
  description: string | null
  boilerplate: string | null
  vision: string | null
  mission: string | null
  values: string | null
  needStatement: string | null
  originStory: string | null
  theoryOfChange: string | null
  formationStatus: FormationStatus | null
  contactName: string | null
  logoUrl: string | null
  brandMarkUrl: string | null
  headerUrl: string | null
  website: string | null
  donateUrl: string | null
  email: string | null
  phone: string | null
  twitter: string | null
  facebook: string | null
  linkedin: string | null
  instagram: string | null
  brandPrimary: string | null
  brandColors: string[]
  brandThemePresetId: string | null
  brandAccentPresetId: string | null
  brandTypographyPresetId: string | null
  brandTypography: BrandTypographyConfig | null
  brandKitAvailable: boolean
  latitude: number | null
  longitude: number | null
  address: string | null
  addressStreet: string | null
  addressPostal: string | null
  city: string | null
  state: string | null
  country: string | null
  locationUrl: string | null
  publicSlug: string | null
  activityLinks: PublicMapActivityLinkSource[]
  programPreview: PublicMapProgramPreview | null
  programs: PublicMapProgramPreview[]
  programCount: number
  groups: PublicMapGroupKey[]
  primaryGroup: PublicMapGroupKey
  isOnlineOnly: boolean
}

function readProfileString(
  profile: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = profile[key]
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (trimmed.length > 0) return trimmed
  }
  return null
}

function readProfileTypography(profile: Record<string, unknown>) {
  const value = profile["brandTypography"] ?? profile["brand_typography"]
  const parsed = organizationProfileBrandTypographySchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function readProfileFormationStatus(profile: Record<string, unknown>) {
  const value = profile["formationStatus"] ?? profile["formation_status"]
  return isFormationStatus(value) ? value : null
}

export type PublicMapProgramRow = {
  id: string
  user_id: string
  title: string | null
  subtitle: string | null
  description: string | null
  created_at: string | null
  image_url: string | null
  location_type: "in_person" | "online" | null
  location_url: string | null
  duration_label: string | null
  features: string[] | null
  cta_label: string | null
  cta_url: string | null
  start_date: string | null
  wizard_snapshot: Record<string, unknown> | null
}

function buildPublicMapProgramPreview(row: PublicMapProgramRow) {
  const chips = resolveProgramCardChips(row)
  const activityKind = resolveOrganizationActivityKind(chips[0])
  const imageUrl =
    resolveProgramBannerImageUrl(row) ?? row.image_url?.trim() ?? null

  return {
    id: row.id,
    title: row.title?.trim() ?? "",
    subtitle: row.subtitle?.trim() || null,
    description: resolveProgramSummary(row) ?? null,
    activityKind,
    chips,
    ctaLabel: row.cta_label?.trim() || null,
    ctaUrl: row.cta_url?.trim() || null,
    durationLabel: row.duration_label?.trim() || null,
    imageUrl,
    locationUrl: row.location_url?.trim() || null,
    locationType: row.location_type,
    startDate: row.start_date,
  } satisfies PublicMapProgramPreview
}

function buildPublicMapActivityLinkSource(
  preview: PublicMapProgramPreview
): PublicMapActivityLinkSource {
  return {
    activityKind: preview.activityKind,
    chips: preview.chips,
    ctaLabel: preview.ctaLabel,
    ctaUrl: preview.ctaUrl,
    description: preview.description,
    durationLabel: preview.durationLabel,
    id: preview.id,
    locationType: preview.locationType,
    locationUrl: preview.locationUrl,
    subtitle: preview.subtitle,
    title: preview.title,
  }
}

export type PublicMapOrganizationRow = {
  user_id: string
  profile: unknown
  location_lat: number | null
  location_lng: number | null
  public_slug: string | null
}

export function projectPublicMapOrganizations(orgRows: PublicMapOrganizationRow[], programRows: PublicMapProgramRow[]): PublicMapOrganization[] {
  const topProgramsByOrgId = new Map<string, PublicMapProgramPreview[]>()
  const activityLinksByOrgId = new Map<string, PublicMapActivityLinkSource[]>()
  const programCountByOrgId = new Map<string, number>()
  const locationModeByOrgId = new Map<
    string,
    { online: number; inPerson: number }
  >()
  for (const row of programRows ?? []) {
    const mode = locationModeByOrgId.get(row.user_id) ?? {
      online: 0,
      inPerson: 0,
    }
    if (row.location_type === "online") {
      mode.online += 1
    } else {
      mode.inPerson += 1
    }
    locationModeByOrgId.set(row.user_id, mode)

    if (!row.title || !row.title.trim()) continue

    programCountByOrgId.set(
      row.user_id,
      (programCountByOrgId.get(row.user_id) ?? 0) + 1
    )

    const preview = buildPublicMapProgramPreview(row)
    const existingActivityLinks = activityLinksByOrgId.get(row.user_id) ?? []
    activityLinksByOrgId.set(row.user_id, [
      ...existingActivityLinks,
      buildPublicMapActivityLinkSource(preview),
    ])

    const existing = topProgramsByOrgId.get(row.user_id) ?? []
    if (existing.length < 6) {
      topProgramsByOrgId.set(row.user_id, [...existing, preview])
    }
  }

  return orgRows
    .map((row) => {
      const profile = (row.profile ?? {}) as Record<string, unknown>
      const narratives = resolvePublicOrganizationProfileNarratives(profile)
      const { mission, vision, values } = narratives
      const missionPlainText =
        organizationNarrativeHtmlToPlainText(mission).trim()
      const programs = topProgramsByOrgId.get(row.user_id) ?? []
      const activityLinks = activityLinksByOrgId.get(row.user_id) ?? []
      const groups = inferPublicMapGroups({
        profile,
        name: String(profile["name"] ?? "").trim() || "Organization",
        tagline:
          typeof profile["tagline"] === "string"
            ? profile["tagline"].trim() || null
            : null,
        description:
          typeof profile["description"] === "string"
            ? profile["description"].trim() || null
            : missionPlainText || null,
        programs: activityLinks,
      })

      const profileLocationType =
        typeof profile["location_type"] === "string"
          ? profile["location_type"].trim().toLowerCase()
          : null
      const mode = locationModeByOrgId.get(row.user_id)
      const isOnlineOnly =
        profileLocationType === "online" ||
        Boolean(mode && mode.online > 0 && mode.inPerson === 0)
      const programPreview = programs.length > 0 ? programs[0]! : null

      return {
        id: row.user_id,
        name: readProfileString(profile, "name") ?? "Organization",
        tagline: readProfileString(profile, "tagline"),
        description:
          (readProfileString(profile, "description") ?? missionPlainText) ||
          null,
        boilerplate: readProfileString(profile, "boilerplate"),
        vision: vision || null,
        mission: mission || null,
        values: values || null,
        needStatement: narratives.needStatement || null,
        originStory: narratives.originStory || null,
        theoryOfChange: narratives.theoryOfChange || null,
        formationStatus: readProfileFormationStatus(profile),
        contactName: readProfileString(
          profile,
          "rep",
          "contactName",
          "contact_name"
        ),
        logoUrl: readProfileString(profile, "logoUrl", "logo_url"),
        brandMarkUrl: readProfileString(
          profile,
          "brandMarkUrl",
          "brand_mark_url"
        ),
        headerUrl: readProfileString(profile, "headerUrl", "header_url"),
        website: readProfileString(
          profile,
          "publicUrl",
          "public_url",
          "website"
        ),
        donateUrl: readProfileString(
          profile,
          "donateUrl",
          "donate_url",
          "donationUrl",
          "donation_url",
          "givingUrl",
          "giving_url"
        ),
        email: readProfileString(profile, "email"),
        phone: readProfileString(profile, "phone"),
        twitter: readProfileString(profile, "twitter"),
        facebook: readProfileString(profile, "facebook"),
        linkedin: readProfileString(profile, "linkedin"),
        instagram: readProfileString(profile, "instagram"),
        brandPrimary: readProfileString(
          profile,
          "brandPrimary",
          "brand_primary"
        ),
        brandColors: Array.isArray(profile["brandColors"])
          ? profile["brandColors"]
              .filter((entry): entry is string => typeof entry === "string")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          : [],
        brandThemePresetId: readProfileString(
          profile,
          "brandThemePresetId",
          "brand_theme_preset_id"
        ),
        brandAccentPresetId: readProfileString(
          profile,
          "brandAccentPresetId",
          "brand_accent_preset_id"
        ),
        brandTypographyPresetId: readProfileString(
          profile,
          "brandTypographyPresetId",
          "brand_typography_preset_id"
        ),
        brandTypography: readProfileTypography(profile),
        brandKitAvailable: Boolean(
          readProfileString(profile, "logoUrl", "logo_url") ||
          readProfileString(profile, "brandMarkUrl", "brand_mark_url")
        ),
        latitude: row.location_lat,
        longitude: row.location_lng,
        address: readProfileString(profile, "address"),
        addressStreet: readProfileString(
          profile,
          "address_street",
          "addressStreet"
        ),
        addressPostal: readProfileString(
          profile,
          "address_postal",
          "addressPostal"
        ),
        city: readProfileString(profile, "address_city", "addressCity"),
        state: readProfileString(profile, "address_state", "addressState"),
        country: readProfileString(
          profile,
          "address_country",
          "addressCountry"
        ),
        locationUrl: readProfileString(profile, "location_url", "locationUrl"),
        publicSlug:
          typeof row.public_slug === "string" ? row.public_slug : null,
        activityLinks,
        programPreview,
        programs,
        programCount: programCountByOrgId.get(row.user_id) ?? 0,
        groups,
        primaryGroup: groups[0] ?? "community",
        isOnlineOnly,
      } satisfies PublicMapOrganization
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    )
}
