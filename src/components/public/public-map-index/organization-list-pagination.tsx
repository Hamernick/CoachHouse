"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

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
  initialVisibleCount,
  pageSize,
  getItemId = (item) => item.id,
}: {
  items: TItem[]
  selectedItemId: string | null
  query?: string
  incrementalLoading: boolean
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

  useEffect(() => {
    setVisibleCount(initialResolvedVisibleCount)
  }, [baseVisibleCount, initialResolvedVisibleCount, itemIdentity, query])

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
  const hasMoreOrganizations = paginationEnabled && remainingCount > 0
  const nextPageCount = Math.min(remainingCount, resolvedPageSize)
  const loadNextPage = useCallback(() => {
    setVisibleCount((currentVisibleCount) =>
      Math.min(items.length, currentVisibleCount + resolvedPageSize)
    )
  }, [items.length, resolvedPageSize])

  useEffect(() => {
    if (!paginationEnabled || !hasMoreOrganizations) return
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
  }, [hasMoreOrganizations, loadNextPage, paginationEnabled])

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
  hasMoreOrganizations,
  loadMoreSentinelRef,
  loadNextPage,
  nextPageCount,
  organizationCount,
  paginationEnabled,
  visibleCount,
}: {
  hasMoreOrganizations: boolean
  loadMoreSentinelRef: RefObject<HTMLDivElement | null>
  loadNextPage: () => void
  nextPageCount: number
  organizationCount: number
  paginationEnabled: boolean
  visibleCount: number
}) {
  if (!paginationEnabled) return null

  return (
    <div
      data-public-map-list-pagination="true"
      className={hasMoreOrganizations ? "flex min-w-0 shrink-0 flex-col items-center gap-1.5 px-2 pt-1 pb-2 text-center" : "sr-only"}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {visibleCount.toLocaleString()} of{" "}
        {organizationCount.toLocaleString()} resources
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
          >
            Load {nextPageCount.toLocaleString()} more
          </Button>
        </>
      ) : null}
    </div>
  )
}
