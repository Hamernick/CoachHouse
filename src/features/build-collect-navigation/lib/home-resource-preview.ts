import type { PublicMapItem } from "@/lib/public-map/resource-map-items"
import { buildPublicOrganizationProfileHref } from "@/lib/find/routes"
import { publicResourceProfileHref } from "@/lib/public-map/resource-profile-href"

export const HOME_ORGANIZATION_BADGE_LABEL = "Complete nonprofit profile · Active paid plan"
export const HOME_ORGANIZATION_BADGE_DESCRIPTION = "Vision, mission and values completed; 501(c)(3) status listed as approved; active paid platform plan."

export type HomeResource = {
  id: string
  kind: "organization" | "resource"
  title: string
  subtitle: string
  href: string
  image: string | null
  organizationBadge?: boolean
}
export type PendingHomeCollection = Pick<HomeResource, "id" | "kind"> & { query: string; createdAt: number }
export const HOME_COLLECTION_KEY = "coach-house:home-pending-collection:v1"
export const HOME_PREVIEW_ID = "home-resource-preview"
export const HOME_COLLECTION_TTL = 24 * 60 * 60 * 1000

export function toHomeResource(item: PublicMapItem): HomeResource {
  const organization = item.itemType === "platform_organization" ? item.organization : null
  return {
    id: organization?.id ?? item.id,
    kind: organization ? "organization" : "resource",
    title: item.title,
    subtitle: [item.city, item.state].filter(Boolean).join(", ") || item.subtitle || "Nonprofit resource",
    href: organization ? buildPublicOrganizationProfileHref(organization) : publicResourceProfileHref(item.id) ?? `/resources?q=${encodeURIComponent(item.title)}`,
    image: organization?.logoUrl ?? (item.itemType === "external_resource" ? item.logoUrl ?? item.faviconUrl ?? null : null),
  }
}

export function parsePendingHomeCollection(raw: string | null, now = Date.now()): PendingHomeCollection | null {
  try {
    const value = JSON.parse(raw ?? "null") as PendingHomeCollection | null
    if (!value || !["organization", "resource"].includes(value.kind) || typeof value.id !== "string" || !/^[a-zA-Z0-9:_-]{1,200}$/.test(value.id)) return null
    if (typeof value.query !== "string" || value.query.length > 160 || !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt > HOME_COLLECTION_TTL) return null
    return { id: value.id, kind: value.kind, query: value.query, createdAt: value.createdAt }
  } catch { return null }
}

export function homeCollectionReturnHref(pending: PendingHomeCollection | null, query: string) {
  const params = new URLSearchParams({ homeSearch: query.slice(0, 160) })
  if (pending) params.set("homeCollect", JSON.stringify(pending))
  return `/?${params}#${HOME_PREVIEW_ID}`
}

export function collectionIdsAfterChange(current: string[], id: string, collect: boolean) {
  if (!collect) return current.filter((value) => value !== id)
  if (current.includes(id)) return current
  if (current.length >= 120) throw new Error("Your collection is full. Remove a saved item first.")
  return [id, ...current]
}
