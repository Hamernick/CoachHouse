import { formatCompactOrganizationLocation } from "@/lib/location/organization-location"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

export const PUBLIC_MAP_RESOURCE_STATUS_LABELS = {
  external_data: "External data",
  pending_review: "Pending review",
  verified_platform: "Verified",
} satisfies Record<ExternalResourceMapItem["verificationStatus"], string>

export const PUBLIC_MAP_RESOURCE_DELIVERY_MODE_LABELS = {
  in_person: "In person",
  online: "Online",
  phone: "Phone",
  hybrid: "Hybrid",
  mobile: "Mobile",
} satisfies Record<
  NonNullable<ExternalResourceMapItem["deliveryModes"]>[number],
  string
>

export const PUBLIC_MAP_RESOURCE_LINK_TYPE_LABELS = {
  website: "Website",
  donate: "Donate",
  intake: "Intake",
  apply: "Apply",
  referral: "Referral",
  resource: "Resource",
  calendar: "Calendar",
  social: "Social",
  source: "Source",
  other: "Link",
} satisfies Record<
  NonNullable<ExternalResourceMapItem["links"]>[number]["type"],
  string
>

export const PUBLIC_MAP_RESOURCE_CONTACT_TYPE_LABELS = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  whatsapp: "WhatsApp",
  contact_form: "Contact form",
  person: "Contact",
  other: "Contact",
} satisfies Record<
  NonNullable<ExternalResourceMapItem["contacts"]>[number]["type"],
  string
>

export function normalizeResourceHref(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/")) return trimmed
  if (/^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function normalizeResourceImageSrc(value: string | null | undefined) {
  return normalizeResourceHref(value)
}

export function isExternalHttpHref(value: string) {
  return /^https?:\/\//i.test(value)
}

export function formatResourceList(values: string[] | null | undefined) {
  const filtered = (values ?? []).map((value) => value.trim()).filter(Boolean)
  if (filtered.length === 0) return null
  return filtered.join(", ")
}

export function formatResourceVerifiedDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date)
}

export function buildResourceLocation(item: ExternalResourceMapItem) {
  return formatCompactOrganizationLocation({
    city: item.city,
    state: item.state,
    country: item.country,
  })
}

export function buildResourceAddressLines(item: ExternalResourceMapItem) {
  const fallbackAddressLines = item.address
    ?.split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!item.addressStreet?.trim() && fallbackAddressLines?.length) {
    return fallbackAddressLines
  }

  const lines = [
    item.addressStreet,
    [item.city, item.state].filter(Boolean).join(", "),
    item.country,
  ]
    .map((line) => line?.trim() ?? "")
    .filter(Boolean)

  return lines.length > 0 ? lines : fallbackAddressLines
}
