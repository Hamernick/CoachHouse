import { resourceStreetKey } from "@/lib/public-map/resource-street-key"
import { auditedResourcePlaceIdentity } from "./resource-place-aliases"
import { getPublicMapResourceCategoryDefinition } from "@/lib/public-map/resource-categories"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

const normalize = (value: string | null) => (value ?? "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim()

function nearby(first: ExternalResourceMapItem, second: ExternalResourceMapItem) {
  if (first.verificationStatus !== second.verificationStatus) return false
  if (first.subtitle && second.subtitle && normalize(first.subtitle) !== normalize(second.subtitle)) return false
  if (![first.latitude, first.longitude, second.latitude, second.longitude].every((n) => typeof n === "number" && Number.isFinite(n))) return false
  const latitude = (first.latitude! + second.latitude!) * Math.PI / 360
  const dy = (first.latitude! - second.latitude!) * 111_320
  const dx = (((first.longitude! - second.longitude! + 540) % 360) - 180) * 111_320 * Math.cos(latitude)
  const identity = auditedResourcePlaceIdentity(first)
  const maxDistance = identity && identity === auditedResourcePlaceIdentity(second) ? 250 : 60
  return Math.hypot(dx, dy) <= maxDistance
}

// Only published records with the same name, street/locality and nearby coordinates.
// Names, provider-wide domains, or rounded coordinates alone never establish identity.
export function groupResourcePlaces(items: ExternalResourceMapItem[]) {
  const groups: ExternalResourceMapItem[][] = []
  const byKey = new Map<string, ExternalResourceMapItem[][]>()
  const seen = new Set<string>()
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const street = resourceStreetKey(item)
    const key = item.visibility === "published" && street ? `${auditedResourcePlaceIdentity(item) ?? normalize(item.title)}|${street}` : null
    const candidates = key ? byKey.get(key) ?? [] : []
    const existing = candidates.find((group) => group.every((other) => nearby(item, other)))
    if (existing) existing.push(item)
    else {
      const group = [item]
      groups.push(group)
      if (key) byKey.set(key, [...candidates, group])
    }
  }
  return groups
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()]
}

export function mergeResourcePlace(group: ExternalResourceMapItem[], requestedId = group[0].id): ExternalResourceMapItem {
  if (group.length === 1) return { ...group[0], id: requestedId }
  const first = group[0]
  return {
    ...first,
    id: requestedId,
    resourceCategories: [...new Set(group.flatMap((item) => item.resourceCategories))],
    description: [...new Set(group.map((item) => item.description).filter(Boolean))].join("\n\n") || null,
    // Services at one place can have different hours and eligibility. Keep each schedule below.
    availability: undefined,
    hoursLabel: null,
    sourceLabel: [...new Set(group.map((item) => item.sourceLabel).filter(Boolean))].join("; ") || null,
    sourceUrl: group.every((item) => item.sourceUrl === first.sourceUrl) ? first.sourceUrl : null,
    links: uniqueBy(group.flatMap((item) => item.links ?? []), (link) => link.url),
    contacts: uniqueBy(group.flatMap((item) => item.contacts ?? []), (contact) => `${contact.type}:${contact.type === "phone" ? contact.value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "") : contact.value.trim().toLowerCase()}`),
    services: uniqueBy(group.flatMap((item) => (item.services ?? []).map((service) => ({
      ...service,
      title: `${service.title} — ${getPublicMapResourceCategoryDefinition(item.primaryResourceCategory).label}`,
      description: service.description ?? item.description,
    }))), (service) => service.id),
  }
}
