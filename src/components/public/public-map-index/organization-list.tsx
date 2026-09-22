"use client"

import { memo, type CSSProperties, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
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
      className="flex min-w-0 flex-col gap-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-muted-foreground px-1 text-xs">Loading resources…</p>
      <div className="grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "border-border/50 flex flex-col justify-center rounded-2xl border p-2",
              PUBLIC_MAP_LIST_CARD_HEIGHT_CLASSNAME
            )}
            aria-hidden="true"
          >
            <div className="flex items-center gap-3">
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
    getItemId: resolvePublicMapItemSelectableId,
    items: listItems,
    selectedItemId: resolvedSelectedItemId,
    query,
    incrementalLoading,
    initialVisibleCount,
    pageSize,
  })

  if (listItems.length === 0 && loadStatus === "loading") {
    return <PublicMapOrganizationListSkeleton />
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
          ? `No matches for “${normalizedQuery}”`
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

    if (!leadingContent) return emptyState

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="divide-border/60 bg-background/85 border-input divide-y overflow-hidden rounded-2xl border backdrop-blur-xl">
          {leadingContent}
        </div>
        {emptyState}
      </div>
    )
  }

  return (
    <div
      data-public-map-organization-list-section="list-stack"
      aria-busy={loadStatus === "loading"}
      className={cn(
        "mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-2",
        scrollable && "min-h-0 flex-1"
      )}
    >
      <ScrollFadeEffect
        enabled={scrollable}
        orientation="vertical"
        data-public-map-organization-list-section="rounded-scroll"
        data-public-map-organization-list-scroll={
          scrollable ? "true" : undefined
        }
        style={
          scrollable
            ? ({
                "--mask-height": "1.5rem",
                "--scroll-buffer": "1rem",
              } as CSSProperties)
            : undefined
        }
        className={cn(
          "divide-border/60 bg-background/85 border-input w-full min-w-0 rounded-2xl border backdrop-blur-xl",
          scrollable
            ? "min-h-0 flex-initial [scroll-padding-bottom:max(env(safe-area-inset-bottom),0.75rem)] overflow-x-hidden overscroll-contain pr-1 pb-[env(safe-area-inset-bottom)] [-webkit-overflow-scrolling:touch]"
            : "overflow-hidden"
        )}
      >
        <div
          data-public-map-organization-list-section="card-grid"
          className="divide-border/60 grid w-full min-w-0 shrink-0 grid-cols-1 items-stretch divide-y"
        >
          {leadingContent}
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
                  constrainedLayout={constrainedLayout}
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
                constrainedLayout={constrainedLayout}
                onSelectOrg={onSelectOrg}
                onOpenDetails={onOpenDetails}
              />
            )
          })}
        </div>
        <PublicMapOrganizationListPaginationFooter
          hasMoreOrganizations={hasMoreOrganizations}
          loadMoreSentinelRef={loadMoreSentinelRef}
          loadNextPage={loadNextPage}
          nextPageCount={nextPageCount}
          organizationCount={listItems.length}
          paginationEnabled={paginationEnabled}
          visibleCount={visibleItems.length}
        />
      </ScrollFadeEffect>
    </div>
  )
}

export const PublicMapOrganizationList = memo(
  PublicMapOrganizationListComponent
)
