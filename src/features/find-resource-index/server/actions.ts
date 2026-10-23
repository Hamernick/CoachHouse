import { getFindResourceCatalog } from "./catalog"

import { unstable_cache } from "next/cache"

import {
  fetchPublicResourceMapItemById,
  fetchPublicResourceMapItems,
} from "@/lib/queries/resource-map-public-items"

import {
  resolveFindResourceDetailItem,
  serializeFindResourceIndexItem,
} from "../lib"

import { groupResourcePlaces, mergeResourcePlace } from "../lib/resource-place-groups"

const fetchFindResourceIndexItemsCached = unstable_cache(
  async () => {
    const items = await fetchPublicResourceMapItems()
    return items.map(serializeFindResourceIndexItem)
  },
  ["find-resource-index-v4"],
  { revalidate: 300 }
)

const fetchFindResourceDetailItemCached = unstable_cache(
  async (id: string) => {
    const item = await fetchPublicResourceMapItemById(id)
    if (!item) return null
    const catalog = await getFindResourceCatalog().catch(() => null)
    const entry = catalog?.items.find((row) => row.id === id || row.relatedResourceIds?.includes(id))
    const siblings = await Promise.all((entry?.relatedResourceIds ?? []).filter((other) => other !== id).map((other) => fetchPublicResourceMapItemById(other)))
    // Recheck current publication/address evidence; cached membership cannot publish a removed record.
    const candidates = [item, ...siblings.filter((other): other is NonNullable<typeof other> => other !== null)]
    const group = groupResourcePlaces(candidates).find((members) => members.some((member) => member.id === id))!
    return resolveFindResourceDetailItem([mergeResourcePlace(group, id)], id)
  },
  ["find-resource-detail-v6"],
  { revalidate: 300 }
)

export async function fetchFindResourceIndexItems() {
  return fetchFindResourceIndexItemsCached()
}

export async function fetchFindResourceDetailItem(id: string) {
  return fetchFindResourceDetailItemCached(id)
}

export async function fetchFindResourceIndexPage({
  cursor,
  limit,
}: {
  cursor: string | null
  limit: number
}) {
  const catalog = await getFindResourceCatalog()
  const ordered = [...catalog.items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const start = cursor ? ordered.findIndex((item) => item.id > cursor) : 0
  return { items: start < 0 ? [] : ordered.slice(start, start + limit + 1), totalCount: ordered.length }
}
