import { buildPublicMapGroupFilterCounts } from "@/lib/public-map/resource-map-counts"
import { publicMapItemMatchesGroupFilter } from "@/lib/public-map/resource-map-items"
import { isPublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import { PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS } from "@/lib/public-map/resource-guide-definitions"
import { buildPublicMapResourceGuides } from "@/lib/public-map/resource-guide-builders"
import { rankPublicMapListItems } from "@/lib/public-map/resource-search"
import { hydrateFindResourceIndexItem } from "./hydrate"
import type { FindResourceIndexItem } from "../types"

export type FindResourceBounds = [west: number, south: number, east: number, north: number]
export type FindResourceCatalogQuery = {
  ids: string[] | null
  mode: "directory" | "map" | "metadata"
  query: string
  category: string
  guide: string | null
  bounds: FindResourceBounds | null
  cursor: string | null
  limit: number
}

export function parseFindResourceCatalogQuery(params: URLSearchParams): FindResourceCatalogQuery | null {
  const mode = params.get("mode")
  if (mode !== "directory" && mode !== "map" && mode !== "metadata") return null
  const query = (params.get("q") ?? "").trim()
  const category = params.get("category") ?? "all"
  const guide = params.get("guide")
  const limit = Number(params.get("limit") ?? (mode === "map" ? 500 : 24))
  const cursor = params.get("cursor")
  if (query.length > 160 || !Number.isInteger(limit) || limit < 1 || limit > 500 || (cursor?.length ?? 0) > 256) return null
  if (category !== "all" && !isPublicMapResourceCategoryKey(category)) return null
  if (guide && !PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS.some((item) => item.id === guide)) return null
  let ids: string[] | null = null
  if (params.has("ids")) {
    try { ids = JSON.parse(params.get("ids")!) } catch { return null }
    if (!Array.isArray(ids) || ids.length > 100 || !ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)) return null
  }
  let bounds: FindResourceBounds | null = null
  if (params.has("bounds")) {
    const parts = params.get("bounds")!.split(",")
    if (parts.some((part) => !part.trim())) return null
    const numbers = parts.map(Number)
    if (numbers.length !== 4 || !numbers.every(Number.isFinite)) return null
    const [west, south, east, north] = numbers
    if (west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || north > 90 || south > north) return null
    bounds = numbers as FindResourceBounds
  }
  if (mode === "map" && !bounds) return null
  return { ids, mode, query, category, guide, bounds, cursor, limit }
}

export function resourceIndexItemInBounds(item: FindResourceIndexItem, [west, south, east, north]: FindResourceBounds) {
  if (item.latitude === null || item.longitude === null) return false
  const lng = ((item.longitude + 180) % 360 + 360) % 360 - 180
  return item.latitude >= south && item.latitude <= north &&
    (west <= east ? lng >= west && lng <= east : lng >= west || lng <= east)
}

export function buildFindResourceCatalog(items: FindResourceIndexItem[], revision: string) {
  const resources = items.map(hydrateFindResourceIndexItem)
  return {
    revision,
    items,
    resources,
    counts: buildPublicMapGroupFilterCounts(resources),
    guides: buildPublicMapResourceGuides(resources).map(({ items: _items, ...guide }) => guide),
  }
}

export type FindResourceCatalog = ReturnType<typeof buildFindResourceCatalog>

export function queryFindResourceCatalog(catalog: FindResourceCatalog, options: FindResourceCatalogQuery) {
  const indexById = new Map(catalog.items.map((item) => [item.id, item]))
  const requestedIds = options.ids ? new Set(options.ids) : null
  const matched = rankPublicMapListItems({ items: requestedIds ? catalog.resources.filter((item) => requestedIds.has(item.id)) : catalog.resources, query: options.query })
  const guide = PUBLIC_MAP_RESOURCE_GUIDE_DEFINITIONS.find((entry) => entry.id === options.guide)
  const category = options.category === "all" || !isPublicMapResourceCategoryKey(options.category) ? "all" : options.category
  const filtered = matched.filter((item) => guide ? guide.matches(item) : publicMapItemMatchesGroupFilter({ item, activeGroup: category }))
    .map((item) => indexById.get(item.id)!)
    .filter((item) => !options.bounds || resourceIndexItemInBounds(item, options.bounds))
  const cursorIndex = options.cursor ? filtered.findIndex((item) => item.id === options.cursor) : -1
  // A removed cursor must not restart page one and duplicate the list.
  const start = options.cursor && cursorIndex < 0 ? filtered.length : cursorIndex + 1
  const items = options.mode === "metadata" ? [] : filtered.slice(start, start + options.limit)
  const hasMore = options.mode !== "metadata" && start + items.length < filtered.length
  return {
    version: 3 as const,
    revision: catalog.revision,
    resourceItems: items,
    page: { hasMore, limit: options.limit, nextCursor: hasMore ? items.at(-1)!.id : null, totalCount: filtered.length },
    counts: options.query ? buildPublicMapGroupFilterCounts(matched) : catalog.counts,
    discoveryCounts: catalog.counts,
    guides: catalog.guides,
    totalCount: catalog.items.length,
  }
}

export type FindResourceCatalogResponse = ReturnType<typeof queryFindResourceCatalog>
