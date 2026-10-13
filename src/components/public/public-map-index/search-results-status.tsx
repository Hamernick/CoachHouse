"use client"

import { useResourceDirectoryPagination } from "@/features/find-resource-index/client"

import type { PublicMapResourceItemsLoadStatus } from "./use-resource-map-items"

export function PublicMapSearchResultsStatus({
  hasStaleResourceItems,
  resourceItemsLoadStatus,
  resultCount,
  searchPending,
}: {
  hasStaleResourceItems: boolean
  resourceItemsLoadStatus: PublicMapResourceItemsLoadStatus
  resultCount: number
  searchPending: boolean
}) {
  const pagination = useResourceDirectoryPagination()
  const count = pagination?.totalCount ?? resultCount
  const formattedCount = `${count.toLocaleString()}${pagination?.totalCount === undefined && pagination?.hasMore ? "+" : ""}`
  const resultLabel = `${formattedCount} ${count === 1 ? "result" : "results"}`
  const statusLabel = searchPending
    ? `${resultLabel} · Updating map…`
    : resourceItemsLoadStatus === "loading"
      ? resultCount > 0
        ? `${formattedCount} available · Loading more…`
        : "Loading resources…"
      : resourceItemsLoadStatus === "error" && hasStaleResourceItems
        ? `${resultLabel} · Last loaded results`
        : resultLabel

  return (
    <div
      data-public-map-search-results-status="true"
      data-public-map-directory-status-header="true"
      className="mx-auto flex h-5 w-full max-w-3xl min-w-0 shrink-0 items-center justify-between gap-3 px-1.5"
    >
      <p className="text-muted-foreground text-xs font-medium">Resources</p>
      <p
        className="text-muted-foreground min-w-0 truncate text-right text-xs tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusLabel}
      </p>
    </div>
  )
}
