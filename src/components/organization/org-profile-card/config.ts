import { normalizeOrganizationLocationFields } from "@/lib/location/organization-location"
import type {
  BrandTypographyConfig,
  BrandTypographyTracking,
  OrgProfile,
  ProfileTab,
} from "./types"

export const ORG_PROFILE_TABS: Array<{
  value: ProfileTab
  label: string
}> = [
  { value: "company", label: "Organization" },
  { value: "programs", label: "Activity" },
  { value: "brand-kit", label: "Brand kit" },
]

function isTrackingValue(value: unknown): value is BrandTypographyTracking {
  return (
    value === "tighter" ||
    value === "tight" ||
    value === "normal" ||
    value === "wide" ||
    value === "wider"
  )
}

function normalizeTypography(source: OrgProfile): BrandTypographyConfig | null {
  const candidate = source.brandTypography
  if (!candidate || typeof candidate !== "object") return null

  const headings = candidate.headings
  const body = candidate.body
  const code = candidate.code

  if (
    !headings ||
    typeof headings !== "object" ||
    !body ||
    typeof body !== "object" ||
    !code ||
    typeof code !== "object"
  ) {
    return null
  }

  const headingsFamily =
    typeof headings.family === "string" ? headings.family : ""
  const headingsWeight =
    typeof headings.weight === "string" ? headings.weight : ""
  const headingsTracking = isTrackingValue(headings.tracking)
    ? headings.tracking
    : "normal"
  const bodyFamily = typeof body.family === "string" ? body.family : ""
  const bodyWeight = typeof body.weight === "string" ? body.weight : ""
  const bodyTracking = isTrackingValue(body.tracking) ? body.tracking : "normal"
  const codeFamily = typeof code.family === "string" ? code.family : ""

  if (
    !headingsFamily ||
    !headingsWeight ||
    !bodyFamily ||
    !bodyWeight ||
    !codeFamily
  ) {
    return null
  }

  return {
    headings: {
      family: headingsFamily,
      weight: headingsWeight,
      tracking: headingsTracking,
    },
    body: {
      family: bodyFamily,
      weight: bodyWeight,
      tracking: bodyTracking,
    },
    code: {
      family: codeFamily,
    },
  }
}

export function normalizeCompanyProfile(source: OrgProfile): OrgProfile {
  const website =
    source.publicUrl?.trim() ||
    (source.locationType === "online" ? source.locationUrl ?? "" : "")
  const normalizedLocation = normalizeOrganizationLocationFields({
    street: source.addressStreet,
    city: source.addressCity,
    state: source.addressState,
    postal: source.addressPostal,
    country: source.addressCountry,
  })

  return {
    name: source.name ?? "",
    description: source.description ?? "",
    tagline: source.tagline ?? "",
    ein: source.ein ?? "",
    formationStatus:
      source.formationStatus === "pre_501c3" ||
      source.formationStatus === "in_progress" ||
      source.formationStatus === "approved"
        ? source.formationStatus
        : "in_progress",
    rep: source.rep ?? "",
    email: source.email ?? "",
    phone: source.phone ?? "",
    address: source.address ?? "",
    addressStreet: normalizedLocation.street,
    addressCity: normalizedLocation.city,
    addressState: normalizedLocation.state,
    addressPostal: normalizedLocation.postal,
    addressCountry: normalizedLocation.country,
    locationType: source.locationType === "online" ? "online" : "in_person",
    locationUrl:
      source.locationType === "online" ? website : source.locationUrl ?? "",
    logoUrl: source.logoUrl ?? "",
    brandMarkUrl: source.brandMarkUrl ?? "",
    headerUrl: source.headerUrl ?? "",
    publicUrl: website,
    donateUrl: source.donateUrl ?? "",
    twitter: source.twitter ?? "",
    facebook: source.facebook ?? "",
    linkedin: source.linkedin ?? "",
    instagram: source.instagram ?? "",
    youtube: source.youtube ?? "",
    tiktok: source.tiktok ?? "",
    newsletter: source.newsletter ?? "",
    github: source.github ?? "",
    vision: source.vision ?? "",
    mission: source.mission ?? "",
    need: source.need ?? "",
    values: source.values ?? "",
    originStory: source.originStory ?? "",
    theoryOfChange: source.theoryOfChange ?? "",
    programs: source.programs ?? "",
    reports: source.reports ?? "",
    boilerplate: source.boilerplate ?? "",
    brandVoiceAudience: source.brandVoiceAudience ?? "",
    brandVoiceTone: source.brandVoiceTone ?? "",
    brandVoiceStyle: source.brandVoiceStyle ?? "",
    brandVoicePersonality: source.brandVoicePersonality ?? "",
    brandVoiceGuidelines: source.brandVoiceGuidelines ?? "",
    brandVoiceAvoid: source.brandVoiceAvoid ?? "",
    narrativeRevisions: source.narrativeRevisions ?? {
      mission: null,
      vision: null,
      values: null,
    },
    brandPrimary: source.brandPrimary ?? "",
    brandColors: Array.isArray(source.brandColors) ? source.brandColors : [],
    brandThemePresetId: source.brandThemePresetId ?? "",
    brandAccentPresetId: source.brandAccentPresetId ?? "",
    brandTypographyPresetId: source.brandTypographyPresetId ?? "",
    brandTypography: normalizeTypography(source),
    publicSlug: source.publicSlug ?? "",
    isPublic: Boolean(source.isPublic ?? false),
  }
}
