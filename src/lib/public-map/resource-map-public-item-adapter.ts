import type { ResourceMapPublicItemsView } from "@/lib/supabase/schema/views"

import { resolveResourceAvailability } from "./resource-availability"
import {
  PUBLIC_MAP_RESOURCE_ALL_CATEGORY_ORDER,
  resolvePublicMapResourceCategoryInputKey,
  type PublicMapResourceCategoryKey,
} from "./resource-categories"
import type {
  ExternalResourceMapItem,
  PublicMapResourceContact,
  PublicMapResourceContactType,
  PublicMapResourceDeliveryMode,
  PublicMapResourceLink,
  PublicMapResourceLinkType,
  PublicMapVerificationStatus,
} from "./resource-map-items"
import { shouldShowPublicMapResourceLink } from "./resource-link-visibility"

type ResourceMapPublicItemRow = Partial<ResourceMapPublicItemsView["Row"]>

const PUBLIC_MAP_RESOURCE_CATEGORY_KEYS = new Set<string>(
  PUBLIC_MAP_RESOURCE_ALL_CATEGORY_ORDER
)
const PUBLIC_MAP_RESOURCE_DELIVERY_MODES = new Set<string>([
  "in_person",
  "online",
  "phone",
  "hybrid",
  "mobile",
])
const PUBLIC_MAP_RESOURCE_LINK_TYPES = new Set<string>([
  "website",
  "donate",
  "intake",
  "apply",
  "referral",
  "resource",
  "calendar",
  "social",
  "source",
  "other",
])
const PUBLIC_MAP_RESOURCE_CONTACT_TYPES = new Set<string>([
  "email",
  "phone",
  "sms",
  "whatsapp",
  "contact_form",
  "person",
  "other",
])

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readStringOrNull(value: unknown) {
  const trimmed = readString(value)
  return trimmed.length > 0 ? trimmed : null
}

function normalizeDisplayText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? ""
}

function resolvePublicResourceSubtitle({
  subtitle,
  title,
}: {
  subtitle: string | null
  title: string
}) {
  return normalizeDisplayText(subtitle) === normalizeDisplayText(title)
    ? null
    : subtitle
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => readString(entry))
    .filter((entry) => entry.length > 0)
}

function isResourceCategoryKey(
  value: string
): value is PublicMapResourceCategoryKey {
  return PUBLIC_MAP_RESOURCE_CATEGORY_KEYS.has(value)
}

function normalizeResourceCategories(
  row: ResourceMapPublicItemRow
): PublicMapResourceCategoryKey[] {
  const categories = (row.resource_categories ?? [])
    .flatMap((value) => {
      const category = resolvePublicMapResourceCategoryInputKey(value)
      return category && isResourceCategoryKey(category) ? [category] : []
    })
    .filter((value, index, array) => array.indexOf(value) === index)
  const primary = resolvePublicMapResourceCategoryInputKey(
    row.primary_resource_category
  )
  const stripBroadEmergencyParent = (
    values: PublicMapResourceCategoryKey[]
  ) => {
    if (
      !values.includes("emergency_cooling_centers") &&
      !values.includes("emergency_warming_centers")
    ) {
      return values
    }
    return values.filter((value) => value !== "emergency")
  }

  if (primary && isResourceCategoryKey(primary)) {
    return stripBroadEmergencyParent(
      categories.includes(primary) ? categories : [primary, ...categories]
    )
  }
  return categories.length > 0
    ? stripBroadEmergencyParent(categories)
    : ["community"]
}

function normalizeDeliveryModes(
  values: string[]
): PublicMapResourceDeliveryMode[] {
  return values.filter((value): value is PublicMapResourceDeliveryMode =>
    PUBLIC_MAP_RESOURCE_DELIVERY_MODES.has(value)
  )
}

function normalizeLinkType(value: unknown): PublicMapResourceLinkType {
  const type = readString(value)
  return PUBLIC_MAP_RESOURCE_LINK_TYPES.has(type)
    ? (type as PublicMapResourceLinkType)
    : "other"
}

function normalizeContactType(value: unknown): PublicMapResourceContactType {
  const type = readString(value)
  return PUBLIC_MAP_RESOURCE_CONTACT_TYPES.has(type)
    ? (type as PublicMapResourceContactType)
    : "other"
}

function normalizeVerificationStatus(
  value: string | undefined
): PublicMapVerificationStatus {
  return value === "verified_platform" ||
    value === "external_data" ||
    value === "pending_review"
    ? value
    : "external_data"
}

function buildResourceAddress(row: ResourceMapPublicItemRow) {
  const street = [row.address_line1, row.address_line2]
    .map(readStringOrNull)
    .filter(Boolean)
    .join(", ")
  const locality = [row.city, row.state, row.postal_code]
    .map(readStringOrNull)
    .filter(Boolean)
    .join(", ")
  const address = [street, locality, row.country]
    .map(readStringOrNull)
    .filter(Boolean)
    .join("\n")

  return {
    address: address.length > 0 ? address : null,
    addressStreet: street.length > 0 ? street : null,
  }
}

function buildResourceAgeRange({
  maximumAge,
  minimumAge,
}: {
  maximumAge: number | null
  minimumAge: number | null
}) {
  if (typeof minimumAge === "number" && typeof maximumAge === "number") {
    return `Ages ${minimumAge}-${maximumAge}`
  }
  if (typeof minimumAge === "number") return `Ages ${minimumAge}+`
  if (typeof maximumAge === "number") return `Up to age ${maximumAge}`
  return null
}

function normalizePublicResourceLinks(value: unknown): PublicMapResourceLink[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return []
      const record = entry as Record<string, unknown>
      const id = readString(record["id"])
      const url = readString(record["url"])
      if (!id || !url) return []
      const type = normalizeLinkType(record["type"])

      return [
        {
          id,
          label:
            readStringOrNull(record["label"]) ??
            (type === "website" ? "Website" : "Resource"),
          url,
          type,
          domain: readStringOrNull(record["domain"]),
          isPrimary: record["isPrimary"] === true,
        },
      ]
    })
    .filter(shouldShowPublicMapResourceLink)
}

function normalizePublicResourceContacts(
  value: unknown
): PublicMapResourceContact[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const record = entry as Record<string, unknown>
    const id = readString(record["id"])
    const contactValue = readString(record["value"])
    if (!id || !contactValue) return []

    return [
      {
        id,
        label: readStringOrNull(record["label"]),
        value: contactValue,
        type: normalizeContactType(record["type"]),
        url: readStringOrNull(record["url"]),
        isPrimary: record["isPrimary"] === true,
      },
    ]
  })
}

export function buildExternalResourceMapItemFromPublicRow(
  row: ResourceMapPublicItemRow
): ExternalResourceMapItem | null {
  const title = readString(row.title)
  const itemId = readString(row.item_id)
  if (!title || !itemId) return null

  const resourceCategories = normalizeResourceCategories(row)
  const primaryResourceCategory = resourceCategories[0] ?? "community"
  const { address, addressStreet } = buildResourceAddress(row)
  const deliveryModes = normalizeDeliveryModes(row.delivery_modes ?? [])
  const links = normalizePublicResourceLinks(row.public_links)
  const contacts = normalizePublicResourceContacts(row.public_contacts)
  const serviceArea = readStringArray(row.coverage_area)
  const languages = readStringArray(row.languages)
  const documentsNeeded = readStringArray(row.documents_needed)
  const availability = resolveResourceAvailability({
    hours: row.hours,
    timezone: row.timezone,
    appointmentRequired: row.appointment_required,
    availabilityStatus: row.availability_status,
    availabilityNotes: row.availability_notes,
    temporaryClosedUntil: row.temporary_closed_until,
  })
  const ageRange = buildResourceAgeRange({
    maximumAge: row.maximum_age ?? null,
    minimumAge: row.minimum_age ?? null,
  })

  return {
    id: `resource_map:${itemId}`,
    itemType: "external_resource",
    resourceOrganizationId: readStringOrNull(row.organization_id),
    title,
    subtitle: resolvePublicResourceSubtitle({
      subtitle:
        readStringOrNull(row.subtitle) ??
        readStringOrNull(row.organization_name),
      title,
    }),
    description:
      readStringOrNull(row.description) ??
      readStringOrNull(row.organization_description),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    address,
    addressStreet,
    city: readStringOrNull(row.city),
    state: readStringOrNull(row.state),
    country: readStringOrNull(row.country),
    orgCategory: null,
    resourceCategories,
    primaryResourceCategory,
    verificationStatus: normalizeVerificationStatus(row.verification_status),
    sourceLabel:
      readStringOrNull(row.source_label) ??
      readStringOrNull(row.source_attribution),
    sourceUrl: readStringOrNull(row.source_url),
    lastVerifiedAt: row.last_verified_at ?? null,
    visibility: "published",
    markerImageUrl:
      readStringOrNull(row.logo_url) ?? readStringOrNull(row.favicon_url),
    logoUrl: readStringOrNull(row.logo_url),
    faviconUrl: readStringOrNull(row.favicon_url),
    mission: readStringOrNull(row.mission),
    vision: readStringOrNull(row.vision),
    values: readStringArray(row.values),
    aliases: readStringArray(row.aliases),
    deliveryModes,
    hoursLabel: availability.label,
    availability,
    lastUpdatedAt: row.last_updated_at,
    links,
    contacts,
    services: [
      {
        id: row.service_id ?? itemId,
        title,
        description: readStringOrNull(row.description),
        whoItHelps: readStringOrNull(row.who_it_helps),
        eligibility: readStringOrNull(row.eligibility),
        cost: readStringOrNull(row.cost),
        languages,
        intakeUrl: readStringOrNull(row.intake_url),
        appointmentInfo: readStringOrNull(row.appointment_info),
        documentsNeeded,
        accessibilityNotes: readStringOrNull(row.accessibility_notes),
        urgentAvailability: readStringOrNull(row.urgent_availability),
        availability,
        ageRange,
        serviceArea,
        deliveryModes,
      },
    ],
  }
}
