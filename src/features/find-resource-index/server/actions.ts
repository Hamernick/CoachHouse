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

const fetchFindResourceIndexItemsCached = unstable_cache(
  async () => {
    const items = await fetchPublicResourceMapItems()
    return items.map(serializeFindResourceIndexItem)
  },
  ["find-resource-index-v2"],
  { revalidate: 300 }
)

const fetchFindResourceDetailItemCached = unstable_cache(
  async (id: string) => {
    const item = await fetchPublicResourceMapItemById(id)
    return item ? resolveFindResourceDetailItem([item], id) : null
  },
  ["find-resource-detail-v2"],
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
