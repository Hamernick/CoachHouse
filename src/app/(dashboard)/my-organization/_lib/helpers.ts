import { resolveCoreDocumentPublication } from "@/lib/roadmap/core-document-publication"
import type { ModuleCardStatus } from "@/lib/accelerator/progress"
import { normalizeOrganizationLocationFields } from "@/lib/location/organization-location"
import {
  resolveOrganizationNarrativeRevisions,
  resolveOrganizationCoreDocuments,
} from "@/lib/roadmap"
import type {
  BrandTypographyConfig,
  BrandTypographyTracking,
  OrgProfile,
  FormationStatus,
} from "@/components/organization/org-profile-card/types"

import type { FormationStepState, MyOrganizationSearchParams } from "./types"

type OrganizationRow = {
  ein: string | null
  public_slug: string | null
  is_public: boolean | null
} | null

const COMPACT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 0,
})

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function safeDateLabel(value: string, withTime = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date pending"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date)
}

export function formatFundingGoal(cents: number) {
  if (!Number.isFinite(cents) || cents <= 0) return "Not set"
  return COMPACT_USD.format(cents / 100)
}

export function parseMonthParam(value: string) {
  const trimmed = value.trim()
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    return null
  const date = new Date(year, month - 1, 1)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1) return null
  return date
}

function formatMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function withMonthParam(
  params: MyOrganizationSearchParams | undefined,
  monthDate: Date
) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "month") continue
    if (typeof value === "string" && value.trim()) {
      query.set(key, value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          query.append(key, item)
        }
      }
    }
  }
  query.set("month", formatMonthParam(monthDate))
  return `/organization?${query.toString()}`
}

export function resolveFormationStepState(
  status: ModuleCardStatus
): FormationStepState {
  if (status === "completed") return "completed"
  if (status === "in_progress") return "active"
  return "pending"
}

function isFormationStatus(value: unknown): value is FormationStatus {
  return (
    value === "pre_501c3" || value === "in_progress" || value === "approved"
  )
}

function isTrackingValue(value: unknown): value is BrandTypographyTracking {
  return (
    value === "tighter" ||
    value === "tight" ||
    value === "normal" ||
    value === "wide" ||
    value === "wider"
  )
}

function readTypographyConfig(value: unknown): BrandTypographyConfig | null {
  if (!isRecord(value)) return null
  const headings = value["headings"]
  const body = value["body"]
  const code = value["code"]
  if (!isRecord(headings) || !isRecord(body) || !isRecord(code)) return null

  const headingsFamily =
    typeof headings["family"] === "string" ? headings["family"] : ""
  const headingsWeight =
    typeof headings["weight"] === "string" ? headings["weight"] : ""
  const headingsTracking = isTrackingValue(headings["tracking"])
    ? headings["tracking"]
    : "normal"
  const bodyFamily = typeof body["family"] === "string" ? body["family"] : ""
  const bodyWeight = typeof body["weight"] === "string" ? body["weight"] : ""
  const bodyTracking = isTrackingValue(body["tracking"])
    ? body["tracking"]
    : "normal"
  const codeFamily = typeof code["family"] === "string" ? code["family"] : ""

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

export function buildInitialOrganizationProfile({
  profile,
  organization,
}: {
  profile: Record<string, unknown>
  organization: OrganizationRow
}): OrgProfile {
  const formationStatusRaw = profile["formationStatus"]
  const formationStatus: FormationStatus = isFormationStatus(formationStatusRaw)
    ? formationStatusRaw
    : "in_progress"
  const normalizedLocation = normalizeOrganizationLocationFields({
    street: profile["address_street"],
    city: profile["address_city"],
    state: profile["address_state"],
    postal: profile["address_postal"],
    country: profile["address_country"],
  })
  const coreDocuments = resolveOrganizationCoreDocuments(profile)

  return {
    name: String(profile["name"] ?? ""),
    description: String(profile["description"] ?? profile["entity"] ?? ""),
    tagline: String(profile["tagline"] ?? ""),
    ein: String(organization?.ein ?? profile["ein"] ?? ""),
    formationStatus,
    rep: String(profile["rep"] ?? ""),
    email: String(profile["email"] ?? ""),
    phone: String(profile["phone"] ?? ""),
    address: String(profile["address"] ?? ""),
    addressStreet: normalizedLocation.street,
    addressCity: normalizedLocation.city,
    addressState: normalizedLocation.state,
    addressPostal: normalizedLocation.postal,
    addressCountry: normalizedLocation.country,
    locationType:
      profile["location_type"] === "online" ||
      profile["locationType"] === "online"
        ? "online"
        : "in_person",
    locationUrl: String(
      profile["location_url"] ?? profile["locationUrl"] ?? ""
    ),
    logoUrl: String(profile["logoUrl"] ?? ""),
    brandMarkUrl: String(profile["brandMarkUrl"] ?? ""),
    headerUrl: String(profile["headerUrl"] ?? ""),
    publicUrl: String(profile["publicUrl"] ?? ""),
    twitter: String(profile["twitter"] ?? ""),
    facebook: String(profile["facebook"] ?? ""),
    linkedin: String(profile["linkedin"] ?? ""),
    instagram: String(profile["instagram"] ?? ""),
    youtube: String(profile["youtube"] ?? ""),
    tiktok: String(profile["tiktok"] ?? ""),
    newsletter: String(profile["newsletter"] ?? ""),
    github: String(profile["github"] ?? ""),
    vision: coreDocuments.vision,
    mission: coreDocuments.mission,
    need: coreDocuments.need,
    values: coreDocuments.values,
    originStory: coreDocuments.originStory,
    theoryOfChange: coreDocuments.theoryOfChange,
    programs: String(profile["programs"] ?? ""),
    reports: String(profile["reports"] ?? ""),
    boilerplate: String(profile["boilerplate"] ?? ""),
    brandVoiceAudience: String(profile["brandVoiceAudience"] ?? ""),
    brandVoiceTone: String(profile["brandVoiceTone"] ?? ""),
    brandVoiceStyle: String(profile["brandVoiceStyle"] ?? ""),
    brandVoicePersonality: String(profile["brandVoicePersonality"] ?? ""),
    brandVoiceGuidelines: String(profile["brandVoiceGuidelines"] ?? ""),
    brandVoiceAvoid: String(profile["brandVoiceAvoid"] ?? ""),
    brandPrimary: String(profile["brandPrimary"] ?? ""),
    brandColors: Array.isArray(profile["brandColors"])
      ? (profile["brandColors"] as unknown[]).map((color) => String(color))
      : [],
    brandThemePresetId: String(profile["brandThemePresetId"] ?? ""),
    brandAccentPresetId: String(profile["brandAccentPresetId"] ?? ""),
    brandTypographyPresetId: String(profile["brandTypographyPresetId"] ?? ""),
    brandTypography: readTypographyConfig(profile["brandTypography"]),
    publicSlug: String(organization?.public_slug ?? ""),
    isPublic: Boolean(organization?.is_public ?? false),
    coreDocumentPublication: resolveCoreDocumentPublication(profile),
    narrativeRevisions: resolveOrganizationNarrativeRevisions(profile),
  }
}
