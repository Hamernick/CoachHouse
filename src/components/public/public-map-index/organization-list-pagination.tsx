"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import type { ResourceDirectoryPagination } from "@/features/find-resource-index/client"

import { Button } from "@/components/ui/button"

export const PUBLIC_MAP_LIST_INITIAL_PAGE_SIZE = 8
export const PUBLIC_MAP_LIST_PAGE_SIZE = 8

const PUBLIC_MAP_LIST_LOAD_MORE_ROOT_MARGIN = "160px 0px"

type PublicMapPaginatedListItem = {
  id: string
}

function resolvePositivePageSize(value: number | undefined, fallback: number) {
  if (typeof value !== "number") return fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

function resolveSelectedMinimumCount<TItem extends PublicMapPaginatedListItem>({
  getItemId,
  items,
  selectedItemId,
}: {
  items: TItem[]
  getItemId: (item: TItem) => string
  selectedItemId: string | null
}) {
  if (!selectedItemId) return 0
  const selectedIndex = items.findIndex(
    (item) => getItemId(item) === selectedItemId
  )
  return selectedIndex >= 0 ? selectedIndex + 1 : 0
}

export function usePublicMapOrganizationListPagination<
  TItem extends PublicMapPaginatedListItem,
>({
  items,
  selectedItemId,
  query,
  incrementalLoading,
  autoLoadMore = true,
  autoLoadRemote = false,
  remote,
  initialVisibleCount,
  pageSize,
  getItemId = (item) => item.id,
}: {
  items: TItem[]
  selectedItemId: string | null
  query?: string
  incrementalLoading: boolean
  autoLoadMore?: boolean
  autoLoadRemote?: boolean
  remote?: ResourceDirectoryPagination | null
  initialVisibleCount: number
  pageSize: number
  getItemId?: (item: TItem) => string
}) {
  const paginationEnabled = incrementalLoading && items.length > 0
  const resolvedInitialVisibleCount = resolvePositivePageSize(
    initialVisibleCount,
    PUBLIC_MAP_LIST_INITIAL_PAGE_SIZE
  )
  const resolvedPageSize = resolvePositivePageSize(
    pageSize,
    PUBLIC_MAP_LIST_PAGE_SIZE
  )
  const baseVisibleCount = paginationEnabled
    ? Math.min(items.length, resolvedInitialVisibleCount)
    : items.length
  const selectedMinimumCount = resolveSelectedMinimumCount({
    getItemId,
    items,
    selectedItemId,
  })
  const initialResolvedVisibleCount = Math.min(
    items.length,
    Math.max(baseVisibleCount, selectedMinimumCount)
  )
  const [visibleCount, setVisibleCount] = useState(initialResolvedVisibleCount)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const itemIdentity = useMemo(
    () => items.map((item) => item.id).join("|"),
    [items]
  )

  const resetKey = remote?.key ?? itemIdentity
  const currentResetKey = useRef(resetKey)
  currentResetKey.current = resetKey
  useEffect(() => {
    setVisibleCount(initialResolvedVisibleCount)
  }, [baseVisibleCount, initialResolvedVisibleCount, resetKey, query])

  useEffect(() => {
    setVisibleCount((currentVisibleCount) =>
      Math.min(
        items.length,
        Math.max(currentVisibleCount, baseVisibleCount, selectedMinimumCount)
      )
    )
  }, [baseVisibleCount, items.length, selectedMinimumCount])

  const visibleItems = paginationEnabled ? items.slice(0, visibleCount) : items
  const remainingCount = Math.max(0, items.length - visibleItems.length)
  const hasMoreOrganizations = paginationEnabled && (remainingCount > 0 || Boolean(remote?.hasMore))
  const nextPageCount = remainingCount > 0 ? Math.min(remainingCount, resolvedPageSize) : resolvedPageSize
  const loadNextPage = useCallback(() => {
    if (remainingCount === 0 && remote?.hasMore) {
      if (remote.loading) return
      const key = resetKey
      void remote.loadMore().then((loaded) => {
        if (loaded && currentResetKey.current === key) setVisibleCount((count) => count + resolvedPageSize)
      })
      return
    }
    setVisibleCount((count) => Math.min(items.length, count + resolvedPageSize))
  }, [items.length, remainingCount, remote, resetKey, resolvedPageSize])

  useEffect(() => {
    if ((remote && !autoLoadRemote) || remote?.loading || remote?.error || !autoLoadMore || !paginationEnabled || !hasMoreOrganizations) return
    if (typeof IntersectionObserver === "undefined") return
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return

    const scrollRoot = sentinel.closest(
      '[data-slot="scroll-area-viewport"], [data-public-map-organization-list-scroll="true"]'
    )
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        loadNextPage()
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: PUBLIC_MAP_LIST_LOAD_MORE_ROOT_MARGIN,
        threshold: 0.01,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [remote, autoLoadRemote, autoLoadMore, hasMoreOrganizations, loadNextPage, paginationEnabled])

  return {
    hasMoreOrganizations,
    loadMoreSentinelRef,
    loadNextPage,
    nextPageCount,
    paginationEnabled,
    visibleItems,
  }
}

export function PublicMapOrganizationListPaginationFooter({
  compact = false,
  hasMoreOrganizations,
  loadMoreSentinelRef,
  loadNextPage,
  nextPageCount,
  organizationCount,
  paginationEnabled,
  visibleCount,
  loading = false,
  error = null,
}: {
  compact?: boolean
  hasMoreOrganizations: boolean
  loadMoreSentinelRef: RefObject<HTMLDivElement | null>
  loadNextPage: () => void
  nextPageCount: number
  organizationCount: number | undefined
  paginationEnabled: boolean
  visibleCount: number
  loading?: boolean
  error?: string | null
}) {
  if (!paginationEnabled) return null

  return (
    <div
      data-public-map-list-pagination="true"
      className={hasMoreOrganizations ? `flex min-w-0 shrink-0 flex-col items-center px-2 text-center ${compact ? "gap-0 py-0" : "gap-1.5 pt-1 pb-2"}` : "sr-only"}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {visibleCount.toLocaleString()}{organizationCount === undefined ? "" : ` of ${organizationCount.toLocaleString()}`} resources
      </p>
      {hasMoreOrganizations ? (
        <>
          <div
            ref={loadMoreSentinelRef}
            data-public-map-list-load-sentinel="true"
            className="h-px w-full"
            aria-hidden="true"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-7 rounded-full px-3 text-xs"
            onClick={loadNextPage}
            disabled={loading}
          >
            {loading ? "Loading…" : error ? "Retry loading more" : `Load ${nextPageCount.toLocaleString()} more`}
          </Button>
        </>
      ) : null}
    </div>
  )
}
