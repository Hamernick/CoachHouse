import { clearFindResourceQueryCache, loadFindResourceQuery } from "@/features/find-resource-index/lib/client-cache"
import { clearDirectorySummaryCache, loadDirectorySummary } from "@/features/find-resource-index/lib/directory-summary-client"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { resolvePublicMapDirectoryCount, resolveDirectoryFormationCounts } from "@/components/public/public-map-index/directory-status-pill"
import {
  clearPublicMapResourceItemsCache,
  loadPublicMapResourceItems,
  mergeProgressiveResourceItems,
} from "@/components/public/public-map-index/use-resource-map-items"
import { loadPublicMapResourceItemDetail } from "@/components/public/public-map-index/use-resource-item-detail"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

function buildJsonResponse(payload: unknown) {
  return {
    json: vi.fn(async () => payload),
    ok: true,
  } as unknown as Response
}

function buildResourceItemsResponse(resourceItems: unknown[]) {
  return buildJsonResponse({ resourceItems })
}

describe("public map resource items client", () => {
  afterEach(() => {
    clearFindResourceQueryCache()
    clearPublicMapResourceItemsCache()
    vi.restoreAllMocks()
  })

  it("deduplicates only concurrent resource requests", async () => {
    const deferred: { resolve?: (response: Response) => void } = {}
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          deferred.resolve = resolve
        })
    )
    const endpoint = "/api/public/resource-map/items?test=concurrent"

    const firstLoad = loadPublicMapResourceItems(endpoint)
    const secondLoad = loadPublicMapResourceItems(endpoint)

    expect(secondLoad).toBe(firstLoad)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    deferred.resolve?.(buildResourceItemsResponse([]))
    await expect(firstLoad).resolves.toEqual([])
  })

  it("refetches after an earlier empty response instead of retaining it", async () => {
    const currentItems = [{ id: "resource-map:library-1" }]
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(buildResourceItemsResponse([]))
      .mockResolvedValueOnce(buildResourceItemsResponse(currentItems))
    const endpoint = "/api/public/resource-map/items?test=revalidate"

    await expect(loadPublicMapResourceItems(endpoint)).resolves.toEqual([])
    await expect(loadPublicMapResourceItems(endpoint)).resolves.toEqual(
      currentItems
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenLastCalledWith(endpoint, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
  })

  it("drains compact cursor pages and hydrates map-safe item defaults", async () => {
    const compactItem = {
      id: "resource_map:resource-a",
      itemType: "external_resource",
      title: "Food pantry",
      subtitle: "Community center",
      latitude: 41.88,
      longitude: -87.63,
      city: "Chicago",
      state: "IL",
      country: "United States",
      resourceCategories: ["food"],
      primaryResourceCategory: "food",
      verificationStatus: "external_data",
      visibility: "published",
    }
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        buildJsonResponse({
          resourceItems: [compactItem],
          page: { hasMore: true, nextCursor: compactItem.id },
        })
      )
      .mockResolvedValueOnce(
        buildJsonResponse({
          resourceItems: [{ ...compactItem, id: "resource_map:resource-b" }],
          page: { hasMore: false, nextCursor: null },
        })
      )

    const progressCounts: number[] = []
    const items = await loadPublicMapResourceItems(
      "/api/public/resource-map/index?limit=50",
      (loadedItems) => progressCounts.push(loadedItems.length)
    )

    expect(items).toHaveLength(2)
    expect(progressCounts).toEqual([1, 2])
    expect(items[0]).toMatchObject({
      id: compactItem.id,
      address: "Chicago, IL, United States",
      description: null,
      orgCategory: null,
      sourceUrl: null,
    })
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      `/api/public/resource-map/index?limit=50&cursor=${encodeURIComponent(compactItem.id)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    )
  })

  it("publishes the first compact page immediately and batches later progress", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    for (let index = 1; index <= 5; index += 1) {
      fetchSpy.mockResolvedValueOnce(
        buildJsonResponse({
          resourceItems: [{ id: `resource_map:${index}` }],
          page: {
            hasMore: index < 5,
            nextCursor: index < 5 ? `resource_map:${index}` : null,
          },
        })
      )
    }

    const progressCounts: number[] = []
    const items = await loadPublicMapResourceItems(
      "/api/public/resource-map/index?limit=50&test=batched-progress",
      (loadedItems) => progressCounts.push(loadedItems.length)
    )

    expect(items).toHaveLength(5)
    expect(progressCounts).toEqual([1, 5])
  })

  it("avoids repeated renders while draining the production-sized catalog", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const totalPages = 18
    const pageSize = 50

    for (let page = 0; page < totalPages; page += 1) {
      const isFinalPage = page === totalPages - 1
      const itemCount = isFinalPage ? 6 : pageSize
      const resourceItems = Array.from({ length: itemCount }, (_, index) => ({
        id: `resource_map:${page * pageSize + index}`,
      }))
      fetchSpy.mockResolvedValueOnce(
        buildJsonResponse({
          resourceItems,
          page: {
            hasMore: !isFinalPage,
            nextCursor: isFinalPage
              ? null
              : resourceItems[resourceItems.length - 1]?.id,
            totalCount: 856 - page * pageSize,
          },
        })
      )
    }

    const progressCounts: number[] = []
    const reportedTotalCounts: Array<number | null> = []
    const items = await loadPublicMapResourceItems(
      "/api/public/resource-map/index?limit=50&test=bounded-progress",
      (loadedItems, totalCount) => {
        progressCounts.push(loadedItems.length)
        reportedTotalCounts.push(totalCount)
      }
    )

    expect(items).toHaveLength(856)
    expect(progressCounts).toEqual([50, 856])
    expect(reportedTotalCounts).toEqual([856, 856])
  })

  it("drains the complete 5,046-item local preview within the safety bound", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const totalCount = 5_046
    const pageSize = 50
    const totalPages = Math.ceil(totalCount / pageSize)

    for (let page = 0; page < totalPages; page += 1) {
      const pageStart = page * pageSize
      const itemCount = Math.min(pageSize, totalCount - pageStart)
      const resourceItems = Array.from({ length: itemCount }, (_, index) => ({
        id: `resource_map:${pageStart + index}`,
      }))
      const isFinalPage = page === totalPages - 1
      fetchSpy.mockResolvedValueOnce(
        buildJsonResponse({
          resourceItems,
          page: {
            hasMore: !isFinalPage,
            nextCursor: isFinalPage
              ? null
              : resourceItems[resourceItems.length - 1]?.id,
            totalCount,
          },
        })
      )
    }

    const reportedTotalCounts: Array<number | null> = []
    const items = await loadPublicMapResourceItems(
      "/api/public/resource-map/index?limit=50&test=local-preview",
      (_loadedItems, reportedTotalCount) =>
        reportedTotalCounts.push(reportedTotalCount)
    )

    expect(items).toHaveLength(totalCount)
    expect(fetchSpy).toHaveBeenCalledTimes(totalPages)
    expect(reportedTotalCounts.every((count) => count === totalCount)).toBe(
      true
    )
  })

  it("stops a repeated cursor instead of draining indefinitely", async () => {
    const repeatedCursor = "resource_map:repeated"
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildJsonResponse({
        resourceItems: [{ id: repeatedCursor }],
        page: {
          hasMore: true,
          nextCursor: repeatedCursor,
          totalCount: 2,
        },
      })
    )

    await expect(
      loadPublicMapResourceItems(
        "/api/public/resource-map/index?limit=50&test=repeated-cursor"
      )
    ).rejects.toThrow("Resource map items repeated a page cursor")
  })

  it("keeps the map inventory total separate from filtered result lists", () => {
    const indexSource = readFileSync(
      join(process.cwd(), "src/components/public/public-map-index.tsx"),
      "utf8"
    )
    const surfaceSource = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/map-surface.tsx"
      ),
      "utf8"
    )

    expect(resolvePublicMapDirectoryCount(19, null)).toBeNull()
    expect(resolvePublicMapDirectoryCount(19, 5_046)).toBe(5_065)
    expect(indexSource).toContain("resolvePublicMapDirectoryCount(")
    expect(indexSource).toContain("filteredItems={activeSearchContext?.items ?? filterState.filteredItems}")
    expect(surfaceSource).toContain("directoryCount={directoryCount}")
    expect(surfaceSource).not.toContain("directoryCount={filteredItems.length}")
  })

  it("deduplicates selected resource detail loads", async () => {
    const resourceItem = {
      id: "resource_map:detail-client-test",
      itemType: "external_resource",
      title: "Resource detail",
    }
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildJsonResponse({ resourceItem }))

    const firstLoad = loadPublicMapResourceItemDetail(resourceItem.id)
    const secondLoad = loadPublicMapResourceItemDetail(resourceItem.id)

    expect(secondLoad).toBe(firstLoad)
    await expect(firstLoad).resolves.toEqual(resourceItem)
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/public/resource-map/items/${encodeURIComponent(resourceItem.id)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    )
  })

  it("preserves later-page selections during progressive refresh", () => {
    const firstPageItem = { id: "resource_map:first" }
    const selectedLaterItem = { id: "resource_map:selected" }

    expect(
      mergeProgressiveResourceItems(
        [selectedLaterItem as ExternalResourceMapItem],
        [firstPageItem as ExternalResourceMapItem]
      ).map(({ id }) => id)
    ).toEqual([firstPageItem.id, selectedLaterItem.id])
  })

  it("keeps tab activation stable while retaining scheduled refresh and reconnect", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/public/public-map-index/use-resource-map-items.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain('window.addEventListener("focus"')
    expect(source).toContain('window.addEventListener("offline"')
    expect(source).toContain('window.addEventListener("online"')
    expect(source).not.toContain('document.addEventListener("visibilitychange"')
    expect(source).toContain("PUBLIC_MAP_RESOURCE_ITEMS_REFRESH_INTERVAL_MS")
    expect(source).not.toContain('cache: "force-cache"')
  })
})

describe("directory count recovery", () => {
  afterEach(() => {
    clearDirectorySummaryCache()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("retries a cold-start timeout while coalescing callers and caching the recovered count", async () => {
    vi.useFakeTimers()
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("Cold compilation", "TimeoutError"))
      .mockResolvedValue(buildJsonResponse({ count: 1975765 }))
    const first = loadDirectorySummary()
    expect(loadDirectorySummary()).toBe(first)
    await vi.advanceTimersByTimeAsync(250)
    await expect(first).resolves.toBe(1975765)
    await expect(loadDirectorySummary()).resolves.toBe(1975765)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.every(([, options]) => options?.signal instanceof AbortSignal)).toBe(true)
  })

  it("bounds failed retries and permits recovery on a later request", async () => {
    vi.useFakeTimers()
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
    const failure = expect(loadDirectorySummary()).rejects.toThrow("offline")
    await vi.advanceTimersByTimeAsync(1000)
    await failure
    expect(fetch).toHaveBeenCalledTimes(3)
    fetch.mockResolvedValue(buildJsonResponse({ count: 42 }))
    await expect(loadDirectorySummary()).resolves.toBe(42)
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})


describe("versioned resource query cache", () => {
  afterEach(() => { clearFindResourceQueryCache(); vi.restoreAllMocks() })
  const payload = { version: 3, revision: "v1", resourceItems: [], page: { hasMore: true, nextCursor: "next", totalCount: 90 } }
  it("reuses fulfilled queries, deduplicates pending work and only fetches one page", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload), { headers: { ETag: '"v1"' } }))
    const [first, second] = await Promise.all([loadFindResourceQuery("/api/test?mode=directory"), loadFindResourceQuery("/api/test?mode=directory")])
    expect(first).toBe(second)
    expect(await loadFindResourceQuery("/api/test?mode=directory")).toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("revalidates with an ETag and preserves identity on 304", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(payload), { headers: { ETag: '"v1"' } })).mockResolvedValueOnce(new Response(null, { status: 304 }))
    const first = await loadFindResourceQuery("/api/test?mode=directory")
    expect(await loadFindResourceQuery("/api/test?mode=directory", true)).toBe(first)
    expect(fetcher.mock.calls[1][1]).toMatchObject({ headers: { "If-None-Match": '"v1"' } })
  })
  it("keeps query caches isolated and permits retry after failure", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(async () => new Response(JSON.stringify(payload)))
    await expect(loadFindResourceQuery("/api/test?q=food")).rejects.toThrow()
    await loadFindResourceQuery("/api/test?q=food")
    await loadFindResourceQuery("/api/test?q=health")
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})


it("counts reported formation statuses without treating unknown listings as registered", () => {
  expect(resolveDirectoryFormationCounts([
    { formationStatus: "approved" },
    { formationStatus: "in_progress" },
    { formationStatus: "pre_501c3" },
    { formationStatus: null },
  ])).toEqual({ registered: 1, inProgress: 2 })
  expect(resolveDirectoryFormationCounts([])).toEqual({ registered: 0, inProgress: 0 })
})
