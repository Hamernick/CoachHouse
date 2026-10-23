"use client"

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react"
import type mapboxgl from "mapbox-gl"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { usePublicMapResourceItems } from "@/components/public/public-map-index/use-resource-map-items"
import { loadFindResourceQuery } from "../lib/client-cache"
import { hydrateFindResourceIndexItem } from "../lib/hydrate"
import { useResourceQuery } from "./use-resource-query"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import { useNonprofitDirectory } from "./use-nonprofit-directory"
import { useDirectorySummary } from "./use-directory-summary"
import { loadNonprofitMapItem } from "../lib/nonprofit-detail-client"
import { useResourceMapBounds } from "./use-resource-map-bounds"

const EMPTY_ITEMS: ExternalResourceMapItem[] = []

export function useResourceDirectory({ endpoint, initialResourceItems, query, category, guide, mapRef, mapLoadVersion, retainedIds }: {
  endpoint?: string
  initialResourceItems: ExternalResourceMapItem[]
  query: string
  category: PublicMapResourceCategoryKey | "all"
  guide: string | null
  mapRef: RefObject<mapboxgl.Map | null>
  mapLoadVersion: number
  retainedIds: string[]
}) {
  const enabled = Boolean(endpoint?.startsWith("/api/public/resource-map/index"))
  const legacy = usePublicMapResourceItems({ initialResourceItems, resourceItemsEndpoint: enabled ? undefined : endpoint })
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query), 200); return () => clearTimeout(timer) }, [query])
  const nonprofit = useNonprofitDirectory(debouncedQuery, category, enabled && !guide)
  const summary = useDirectorySummary(enabled)
  const bounds = useResourceMapBounds(mapRef, mapLoadVersion)
  const params = new URLSearchParams({ q: debouncedQuery.trim(), category, ...(guide ? { guide } : {}) })
  const base = endpoint?.split("?")[0]
  const directory = useResourceQuery(enabled ? `${base}?mode=directory&limit=24&${params}` : null, true)
  const map = useResourceQuery(enabled && bounds ? `${base}?mode=map&limit=500&${params}&bounds=${bounds}` : null, "all")
  const [retainedRetry, setRetainedRetry] = useState(0)
  const [retained, setRetained] = useState<ExternalResourceMapItem[]>(initialResourceItems)
  const retainedKey = [...new Set(retainedIds)].sort().join("|")
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const allIds = retainedKey ? retainedKey.split("|") : []
    const ids = allIds.filter((id) => !id.startsWith("nonprofit:"))
    const items: ExternalResourceMapItem[] = []
    const loadSavedSummaries = async () => {
      for (let offset = 0; offset < ids.length; offset += 100) {
        const search = new URLSearchParams({ mode: "directory", limit: "100", ids: JSON.stringify(ids.slice(offset, offset + 100)) })
        const response = await loadFindResourceQuery(`${base}?${search}`)
        items.push(...response.resourceItems.map(hydrateFindResourceIndexItem))
        if (cancelled) return
      }
      const nonprofitIds = allIds.filter((id) => id.startsWith("nonprofit:"))
      for (let offset = 0; offset < nonprofitIds.length; offset += 4) {
        const batch = await Promise.all(nonprofitIds.slice(offset, offset + 4).map(loadNonprofitMapItem))
        if (cancelled) return
        items.push(...batch.filter((item): item is ExternalResourceMapItem => item !== null))
      }
      if (!cancelled) setRetained((previous) => [...new Map([...previous, ...items].map((item) => [item.id, item])).values()].slice(-160))
    }
    // Saved/selected records need compact summaries; only an opened detail fetches its body.
    void loadSavedSummaries().catch(() => { /* Keep previously resolved saved summaries on failure. */ })
    return () => { cancelled = true }
  }, [base, enabled, retainedKey, retainedRetry])
  const directoryItems = useMemo(() => [...(directory.data?.resourceItems.map(hydrateFindResourceIndexItem) ?? EMPTY_ITEMS), ...nonprofit.items], [directory.data, nonprofit.items])
  const mapData = map.data ?? map.previousData
  const mapItems = useMemo(() => mapData?.resourceItems.map(hydrateFindResourceIndexItem) ?? EMPTY_ITEMS, [mapData])
  const resourceItems = useMemo(() => [...new Map([...mapItems, ...directoryItems, ...retained].map((item) => [item.id, item])).values()], [directoryItems, mapItems, retained])
  const retryDirectory = directory.retry
  const retryMap = map.retry
  const retryNonprofit = nonprofit.retry
  const retry = useCallback(() => {
    retryDirectory()
    retryMap()
    retryNonprofit()
    setRetainedRetry((value) => value + 1)
  }, [retryDirectory, retryMap, retryNonprofit])
  return {
    enabled,
    resourceItems: enabled ? resourceItems : legacy.resourceItems,
    directoryItems: enabled ? directoryItems : legacy.resourceItems,
    mapItems: enabled ? mapItems : legacy.resourceItems,
    metadata: directory.data ?? directory.previousData,
    viewportLimited: Boolean(mapData?.page.hasMore),
    includesNonprofits: enabled && !guide,
    countEstimated: enabled && summary !== null,
    pagination: enabled ? {
      key: directory.pagination.key,
      hasMore: directory.pagination.hasMore || nonprofit.pagination.hasMore,
      loading: directory.pagination.loading || nonprofit.pagination.loading,
      error: directory.pagination.error || nonprofit.pagination.error,
      loadMore: async () => {
        const results = await Promise.all([
          directory.pagination.hasMore ? directory.pagination.loadMore() : false,
          nonprofit.pagination.hasMore ? nonprofit.pagination.loadMore() : false,
        ])
        return results.some(Boolean)
      },
    } : null,
    retry: enabled ? retry : legacy.retry,
    error: enabled ? directory.error || nonprofit.error || map.error : legacy.error,
    status: enabled ? directory.error || nonprofit.error || map.error ? "error" as const : directory.pending || nonprofit.pending || map.pending ? "loading" as const : "ready" as const : legacy.status,
    pending: enabled && (directory.pending || nonprofit.pending || debouncedQuery !== query),
    totalResourceCount: enabled ? summary === null || !(directory.data ?? directory.previousData) ? null : (directory.data ?? directory.previousData)!.totalCount + summary : legacy.totalResourceCount,
  }
}
