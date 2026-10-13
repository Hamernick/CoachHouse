"use client"

import { useCallback, useEffect, useState } from "react"

import { hydrateFindResourceIndexItem } from "@/features/find-resource-index"

import type { FindResourceIndexItem } from "@/features/find-resource-index"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { warmPublicMapListItemSearchCache } from "./map-items-state"

export const EMPTY_PUBLIC_MAP_RESOURCE_ITEMS: ExternalResourceMapItem[] = []
export const PUBLIC_MAP_RESOURCE_ITEMS_REFRESH_INTERVAL_MS = 5 * 60 * 1000
export const PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR =
  "You’re offline. Connect to the internet and try again."
export const PUBLIC_MAP_RESOURCE_ITEMS_UNAVAILABLE_ERROR =
  "The resource directory could not load."
export type PublicMapResourceItemsLoadStatus = "loading" | "ready" | "error"

type ResourceItemsLoad = {
  listeners: Set<
    (items: ExternalResourceMapItem[], totalCount: number | null) => void
  >
  promise: Promise<ExternalResourceMapItem[]>
}

const resourceItemsLoadByEndpoint = new Map<string, ResourceItemsLoad>()
const RESOURCE_ITEMS_PROGRESS_BATCH_SIZE = 1_000
const RESOURCE_ITEMS_MAX_PAGE_COUNT = 200

type FindResourceIndexPage = {
  hasMore?: unknown
  nextCursor?: unknown
  totalCount?: unknown
}

function resolveFindResourceIndexTotalCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null
}

function isFindResourceIndexItem(
  value: unknown
): value is FindResourceIndexItem {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { itemType?: unknown }).itemType === "external_resource" &&
    typeof (value as { id?: unknown }).id === "string" &&
    !("description" in value)
  )
}


function normalizeLoadedResourceItem(value: unknown) {
  return isFindResourceIndexItem(value)
    ? hydrateFindResourceIndexItem(value)
    : (value as ExternalResourceMapItem)
}

function appendResourceCursor(endpoint: string, cursor: string) {
  const separator = endpoint.includes("?") ? "&" : "?"
  return `${endpoint}${separator}cursor=${encodeURIComponent(cursor)}`
}

export function mergeProgressiveResourceItems(
  currentItems: ExternalResourceMapItem[],
  loadedItems: ExternalResourceMapItem[]
) {
  const mergedItems = new Map(
    loadedItems.map((item) => [item.id, item] as const)
  )
  for (const item of currentItems) {
    if (!mergedItems.has(item.id)) mergedItems.set(item.id, item)
  }
  return [...mergedItems.values()]
}

export function clearPublicMapResourceItemsCache(endpoint?: string) {
  if (endpoint) {
    resourceItemsLoadByEndpoint.delete(endpoint)
    return
  }

  resourceItemsLoadByEndpoint.clear()
}

export function loadPublicMapResourceItems(
  endpoint: string,
  onProgress?: (
    items: ExternalResourceMapItem[],
    totalCount: number | null
  ) => void
) {
  const cached = resourceItemsLoadByEndpoint.get(endpoint)
  if (cached) {
    if (onProgress) cached.listeners.add(onProgress)
    return cached.promise
  }

  const listeners = new Set<
    (items: ExternalResourceMapItem[], totalCount: number | null) => void
  >()
  if (onProgress) listeners.add(onProgress)

  const promise = (async () => {
    const resourceItems: ExternalResourceMapItem[] = []
    let pageEndpoint: string | null = endpoint
    let pageCount = 0
    let totalCount: number | null = null
    const requestedPageEndpoints = new Set<string>()

    while (pageEndpoint) {
      if (requestedPageEndpoints.has(pageEndpoint)) {
        throw new Error("Resource map items repeated a page cursor")
      }
      requestedPageEndpoints.add(pageEndpoint)

      const response = await fetch(pageEndpoint, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      if (!response.ok) {
        throw new Error(`Resource map items failed: ${response.status}`)
      }

      const payload = (await response.json()) as {
        resourceItems?: unknown
        page?: FindResourceIndexPage
      }
      if (Array.isArray(payload.resourceItems)) {
        resourceItems.push(
          ...payload.resourceItems.map(normalizeLoadedResourceItem)
        )
      }
      totalCount ??= resolveFindResourceIndexTotalCount(
        payload.page?.totalCount
      )

      const nextCursor = payload.page?.nextCursor
      pageEndpoint =
        payload.page?.hasMore === true && typeof nextCursor === "string"
          ? appendResourceCursor(endpoint, nextCursor)
          : null
      pageCount += 1
      if (pageEndpoint && pageCount >= RESOURCE_ITEMS_MAX_PAGE_COUNT) {
        throw new Error("Resource map items exceeded the page limit")
      }

      const shouldPublishProgress =
        pageCount === 1 ||
        pageEndpoint === null ||
        resourceItems.length % RESOURCE_ITEMS_PROGRESS_BATCH_SIZE === 0
      if (shouldPublishProgress) {
        for (const listener of listeners) {
          listener([...resourceItems], totalCount)
        }
      }
    }

    warmPublicMapListItemSearchCache(resourceItems)
    return resourceItems
  })()

  const load = { listeners, promise }
  resourceItemsLoadByEndpoint.set(endpoint, load)
  const clearSettledLoad = () => {
    if (resourceItemsLoadByEndpoint.get(endpoint)?.promise === promise) {
      resourceItemsLoadByEndpoint.delete(endpoint)
    }
  }
  void promise.then(clearSettledLoad, clearSettledLoad)
  return promise
}

export function usePublicMapResourceItems({
  initialResourceItems = EMPTY_PUBLIC_MAP_RESOURCE_ITEMS,
  resourceItemsEndpoint,
}: {
  initialResourceItems?: ExternalResourceMapItem[]
  resourceItemsEndpoint?: string
}) {
  const [resourceItems, setResourceItems] = useState(initialResourceItems)
  const [totalResourceCount, setTotalResourceCount] = useState<number | null>(
    resourceItemsEndpoint ? null : initialResourceItems.length
  )
  const [status, setStatus] = useState<PublicMapResourceItemsLoadStatus>(
    resourceItemsEndpoint ? "loading" : "ready"
  )
  const [error, setError] = useState<string | null>(null)
  const [loadRequestId, setLoadRequestId] = useState(0)

  useEffect(() => {
    if (resourceItemsEndpoint) return
    setResourceItems(initialResourceItems)
    setTotalResourceCount(initialResourceItems.length)
    setStatus("ready")
    setError(null)
  }, [initialResourceItems, resourceItemsEndpoint])

  useEffect(() => {
    if (!resourceItemsEndpoint) return

    const endpoint = resourceItemsEndpoint
    let cancelled = false
    let requestPending = false

    async function loadResourceItems(background = false) {
      if (requestPending) return
      requestPending = true
      let loadedTotalCount: number | null = null
      if (!background) {
        setStatus("loading")
        setError(null)
      }
      try {
        const payload = await loadPublicMapResourceItems(
          endpoint,
          (items, totalCount) => {
            loadedTotalCount = totalCount ?? items.length
            if (!cancelled && !background) {
              setResourceItems((currentItems) =>
                mergeProgressiveResourceItems(currentItems, items)
              )
              setTotalResourceCount(totalCount ?? items.length)
            }
          }
        )
        if (cancelled) return
        setResourceItems((currentItems) => {
          const alreadyPublished =
            currentItems.length === payload.length &&
            currentItems.every((item, index) => item === payload[index])
          return alreadyPublished ? currentItems : payload
        })
        setTotalResourceCount(loadedTotalCount ?? payload.length)
        setStatus("ready")
        setError(null)
      } catch (error) {
        if (cancelled) return
        if (!background) {
          setStatus("error")
          setError(
            navigator.onLine === false
              ? PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR
              : PUBLIC_MAP_RESOURCE_ITEMS_UNAVAILABLE_ERROR
          )
        }
        console.warn("[public-map] resource items unavailable", {
          message: error instanceof Error ? error.message : String(error),
        })
      } finally {
        requestPending = false
      }
    }

    void loadResourceItems()
    const refreshVisibleResourceItems = () => {
      if (document.visibilityState === "hidden") return
      if (navigator.onLine === false) {
        setStatus("error")
        setError(PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR)
        return
      }
      void loadResourceItems(true)
    }
    const markResourceItemsOffline = () => {
      setStatus("error")
      setError(PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR)
    }
    const refreshResourceItemsOnline = () => {
      clearPublicMapResourceItemsCache(endpoint)
      setLoadRequestId((current) => current + 1)
    }
    const refreshInterval = window.setInterval(
      refreshVisibleResourceItems,
      PUBLIC_MAP_RESOURCE_ITEMS_REFRESH_INTERVAL_MS
    )
    window.addEventListener("offline", markResourceItemsOffline)
    window.addEventListener("online", refreshResourceItemsOnline)

    return () => {
      cancelled = true
      window.clearInterval(refreshInterval)
      window.removeEventListener("offline", markResourceItemsOffline)
      window.removeEventListener("online", refreshResourceItemsOnline)
    }
  }, [loadRequestId, resourceItemsEndpoint])

  const retry = useCallback(() => {
    if (!resourceItemsEndpoint) return
    clearPublicMapResourceItemsCache(resourceItemsEndpoint)
    setLoadRequestId((current) => current + 1)
  }, [resourceItemsEndpoint])

  return { error, resourceItems, retry, status, totalResourceCount }
}
