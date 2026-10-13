"use client"

import { useResourceDirectoryPagination } from "@/features/find-resource-index/client"

import { memo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildPlatformOrganizationMapItem,
  resolvePublicMapItemSelectableId,
  type PublicMapItem,
} from "@/lib/public-map/resource-map-items"
import { cn } from "@/lib/utils"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { PublicMapPlatformOrganizationListCard } from "./organization-list-platform-card"
import { PublicMapResourceListCard } from "./organization-list-resource-card"
import { PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME } from "./organization-list-card-shared"
import {
  PUBLIC_MAP_LIST_INITIAL_PAGE_SIZE,
  PUBLIC_MAP_LIST_PAGE_SIZE,
  PublicMapOrganizationListPaginationFooter,
  usePublicMapOrganizationListPagination,
} from "./organization-list-pagination"
import { PUBLIC_MAP_SIDEBAR_CARD_CLASSNAME } from "./sidebar-theme"
import { useOrganizationFeedViewport } from "./organization-feed-viewport"
import { PublicMapClaimPrompt } from "./footer"
import type { PublicMapGroupFilterKey } from "./category-filter"
import {
  PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR,
  type PublicMapResourceItemsLoadStatus,
} from "./use-resource-map-items"

function buildPublicMapListItems({
  items,
  organizations,
}: {
  items?: PublicMapItem[]
  organizations: PublicMapOrganization[]
}) {
  return items ?? organizations.map(buildPlatformOrganizationMapItem)
}

function PublicMapOrganizationListSkeleton() {
  return (
    <div
      data-public-map-search-loading="true"
      className="@container/results flex min-w-0 flex-col gap-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-muted-foreground px-1 text-xs">Loading resources…</p>
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 @min-[38rem]/results:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "border-border/50 flex flex-col justify-center rounded-2xl border p-4",
              PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME
            )}
            aria-hidden="true"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 shrink-0 animate-none rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/5 animate-none" />
                <Skeleton className="h-3 w-2/5 animate-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PublicMapOrganizationListComponent({
  items,
  organizations,
  selectedItemId,
  selectedOrgId,
  query,
  constrainedLayout = false,
  incrementalLoading = false,
  scrollable = false,
  bounded = false,
  paged = false,
  remotePagination = false,
  leadingContent,
  initialVisibleCount = PUBLIC_MAP_LIST_INITIAL_PAGE_SIZE,
  pageSize = PUBLIC_MAP_LIST_PAGE_SIZE,
  activeGroup = "all",
  loadStatus = "ready",
  loadError = null,
  onClearCategory,
  onClearQuery,
  onRetryLoad,
  onSelectItem,
  onSelectOrg,
  onOpenDetails,
}: {
  items?: PublicMapItem[]
  organizations: PublicMapOrganization[]
  selectedItemId?: string | null
  selectedOrgId: string | null
  query?: string
  constrainedLayout?: boolean
  incrementalLoading?: boolean
  scrollable?: boolean
  bounded?: boolean
  paged?: boolean
  remotePagination?: boolean
  leadingContent?: ReactNode
  initialVisibleCount?: number
  pageSize?: number
  activeGroup?: PublicMapGroupFilterKey
  loadStatus?: PublicMapResourceItemsLoadStatus
  loadError?: string | null
  onClearCategory?: () => void
  onClearQuery?: () => void
  onRetryLoad?: () => void
  onSelectItem?: (id: string) => void
  onSelectOrg: (id: string) => void
  onOpenDetails?: (id: string) => void
}) {
  const remoteContext = useResourceDirectoryPagination()
  const remote = remotePagination ? remoteContext : null
  const listItems = buildPublicMapListItems({ items, organizations })
  const resolvedSelectedItemId = selectedItemId ?? selectedOrgId
  const {
    hasMoreOrganizations,
    loadMoreSentinelRef,
    loadNextPage,
    nextPageCount,
    paginationEnabled,
    visibleItems,
  } = usePublicMapOrganizationListPagination({
    remote,
    getItemId: resolvePublicMapItemSelectableId,
    items: listItems,
    selectedItemId: bounded ? null : resolvedSelectedItemId,
    query,
    incrementalLoading,
    autoLoadMore: paged || !bounded,
    autoLoadRemote: paged,
    initialVisibleCount: paged ? 6 : initialVisibleCount,
    pageSize,
  })
  const feed = useOrganizationFeedViewport(paged, `${remote?.key ?? ""}|${query ?? ""}|${activeGroup}`, listItems.length === 0)

  if (listItems.length === 0 && loadStatus === "loading") {
    return (
      <>
        {leadingContent}
        <PublicMapOrganizationListSkeleton />
      </>
    )
  }

  if (listItems.length === 0) {
    const normalizedQuery = query?.trim() ?? ""
    const hasSearchQuery = normalizedQuery.length > 0
    const hasCategoryFilter = activeGroup !== "all"
    const loadFailed = loadStatus === "error"
    const loadOffline = loadError === PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR
    const title = loadOffline
      ? "You’re offline"
      : loadFailed
        ? "Resource directory unavailable"
        : hasSearchQuery
          ? `No listings match “${normalizedQuery}”`
          : hasCategoryFilter
            ? "No resources in this category"
            : "No resources available"
    const description = loadOffline
      ? "Connect to the internet, then try loading the directory again."
      : loadFailed
        ? (loadError ?? "The resource directory could not load.")
        : hasSearchQuery
          ? "Try a shorter term or clear the search to browse every resource."
          : hasCategoryFilter
            ? "Show all categories or choose another category."
            : "Try loading the directory again."
    const action = loadFailed
      ? onRetryLoad
        ? { label: "Try again", onClick: onRetryLoad }
        : null
      : hasSearchQuery
        ? onClearQuery
          ? { label: "Clear search", onClick: onClearQuery }
          : null
        : hasCategoryFilter
          ? onClearCategory
            ? { label: "Show all", onClick: onClearCategory }
            : null
          : onRetryLoad
            ? { label: "Try again", onClick: onRetryLoad }
            : null

    const emptyState = (
      <Empty
        data-public-map-search-empty="true"
        variant="subtle"
        size="sm"
        className={cn("h-auto min-h-48", PUBLIC_MAP_SIDEBAR_CARD_CLASSNAME)}
        title={<span className="text-balance">{title}</span>}
        description={<span className="text-pretty">{description}</span>}
        actions={
          action ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ) : null
        }
      />
    )

    if (paged) return <>{emptyState}<PublicMapClaimPrompt /></>
    if (!leadingContent) return emptyState

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="divide-border/60 bg-background/85 divide-y overflow-hidden rounded-2xl backdrop-blur-xl">
          {leadingContent}
        </div>
        {emptyState}
      </div>
    )
  }

  return (
    <div
      ref={feed.ref}
      data-public-map-paged-results={paged ? "" : undefined}
      style={paged ? { height: feed.height } : undefined}
      data-public-map-organization-list-section="list-stack"
      aria-busy={loadStatus === "loading"}
      className={cn(
        "mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-2 @container/results",
        scrollable && "min-h-0 flex-1"
      )}
    >
      <div
        data-lenis-prevent={bounded || paged ? "" : undefined}
        data-public-map-result-feed={paged ? "" : undefined}
        data-public-map-organization-list-section="rounded-scroll"
        data-public-map-organization-list-scroll={
          scrollable || paged ? "true" : undefined
        }
        className={cn(
          "w-full min-w-0",
          !paged && "divide-border/60 bg-background/85 rounded-2xl backdrop-blur-xl",
          scrollable || paged
            ? "min-h-0 flex-1 [scroll-padding-bottom:max(env(safe-area-inset-bottom),0.75rem)] overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-[env(safe-area-inset-bottom)] [-webkit-overflow-scrolling:touch]"
            : "overflow-hidden",
          bounded && "max-h-full flex-[0_1_auto]",
          paged && "min-h-0 flex-1 pr-0 pb-0 [overflow-anchor:none] [scrollbar-width:thin]"
        )}
      >
        <div data-public-map-feed-content={paged ? "" : undefined} className={paged ? "min-w-0" : "contents"}>
        {paged ? null : leadingContent}
        <div
          data-public-map-organization-list-section="card-grid"
          className={cn(
            "grid w-full min-w-0 shrink-0 grid-cols-1 items-stretch @min-[38rem]/results:grid-cols-2 [&>article:only-child]:col-span-full",
            paged
              ? "gap-2 [&>article]:rounded-xl [&>article]:bg-white dark:[&>article]:bg-card"
              : "divide-border/60 divide-y @min-[38rem]/results:gap-x-3 @min-[38rem]/results:gap-y-2 @min-[38rem]/results:divide-y-0"
          )}
        >
          {visibleItems.map((item) => {
            const selectableItemId = resolvePublicMapItemSelectableId(item)
            const selected = resolvedSelectedItemId === selectableItemId

            if (item.itemType === "external_resource") {
              return (
                <PublicMapResourceListCard
                  key={item.id}
                  item={item}
                  selected={selected}
                  query={query}
                  constrainedLayout={paged || constrainedLayout}
                  onSelectItem={onSelectItem}
                />
              )
            }

            return (
              <PublicMapPlatformOrganizationListCard
                key={item.id}
                item={item}
                selected={selected}
                query={query}
                constrainedLayout={paged || constrainedLayout}
                onSelectOrg={onSelectOrg}
                onOpenDetails={onOpenDetails}
              />
            )
          })}
        </div>
        <PublicMapOrganizationListPaginationFooter
          compact={paged}
          hasMoreOrganizations={hasMoreOrganizations}
          loadMoreSentinelRef={loadMoreSentinelRef}
          loadNextPage={loadNextPage}
          nextPageCount={nextPageCount}
          organizationCount={remote ? remote.totalCount : listItems.length}
          loading={remote?.loading}
          error={remote?.error}
          paginationEnabled={paginationEnabled}
          visibleCount={visibleItems.length}
        />
        {paged ? <PublicMapClaimPrompt /> : null}
        </div>
      </div>
    </div>
  )
}

export const PublicMapOrganizationList = memo(
  PublicMapOrganizationListComponent
)
