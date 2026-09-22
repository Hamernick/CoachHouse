"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarContent } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"

import type {
  PublicMapGroupFilterCounts,
  PublicMapGroupFilterKey,
} from "./category-filter"
import { PublicMapDirectoryHome } from "./directory-home"
import { PublicMapSearchCard } from "./search-card"
import { usePublicMapSearchKeyboardNavigation } from "./search-keyboard-navigation"
import { PublicMapSearchShortcuts } from "./search-shortcuts"
import { PublicMapSearchResultsStatus } from "./search-results-status"
import type { PublicMapListItem } from "./map-items-state"
import type { PublicMapResourceGuide } from "./resource-guide-model"
import {
  noopPublicMapSearchAction,
  PublicMapOrganizationsStack,
  PublicMapResourceItemsErrorNotice,
  PublicMapSearchContextCard,
  type PublicMapSidebarSearchContext,
} from "./search-panel-content"
import type { PublicMapResourceItemsLoadStatus } from "./use-resource-map-items"

export type { PublicMapSidebarSearchContext } from "./search-panel-content"

type PublicMapRailSearchPanelProps = {
  query: string
  searchContext?: PublicMapSidebarSearchContext | null
  items: PublicMapListItem[]
  organizations: PublicMapOrganization[]
  selectedItemId: string | null
  selectedOrgId?: string | null
  constrainedLayout: boolean
  activeGroup: PublicMapGroupFilterKey
  groupCounts: PublicMapGroupFilterCounts
  guides?: PublicMapResourceGuide[]
  savedGuideIds?: PublicMapResourceGuideId[]
  resourceItemsLoadStatus?: PublicMapResourceItemsLoadStatus
  resourceItemsLoadError?: string | null
  searchPending?: boolean
  onQueryChange: (value: string) => void
  onSearchEngage?: () => void
  onActiveGroupChange: (group: PublicMapGroupFilterKey) => void
  onHidePanel: () => void
  onGuideSelect?: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  onRetryResourceItems?: () => void
  onSelectItem: (itemId: string) => void
  onOpenDetails: (orgId: string) => void
}

export function PublicMapRailSearchPanel({
  query,
  searchContext = null,
  items,
  organizations,
  selectedItemId,
  selectedOrgId = null,
  constrainedLayout,
  activeGroup,
  groupCounts,
  guides = [],
  savedGuideIds = [],
  resourceItemsLoadStatus = "ready",
  resourceItemsLoadError = null,
  searchPending = false,
  onQueryChange,
  onSearchEngage,
  onActiveGroupChange,
  onHidePanel,
  onGuideSelect,
  onToggleSavedGuide,
  onRetryResourceItems = noopPublicMapSearchAction,
  onSelectItem,
  onOpenDetails,
}: PublicMapRailSearchPanelProps) {
  const { containerRef, focusBoundaryResult, handleResultKeyDown } =
    usePublicMapSearchKeyboardNavigation()

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-col"
      onKeyDown={handleResultKeyDown}
    >
      <SidebarContent className="h-full min-h-0 gap-0 overflow-hidden bg-transparent pt-0 pb-0">
        <div
          data-public-map-sidebar-section="rail-search-header"
          className="shrink-0 px-3"
        >
          <PublicMapSearchCard
            query={query}
            onQueryChange={onQueryChange}
            onSearchEngage={onSearchEngage}
            onNavigateResults={focusBoundaryResult}
            onHidePanel={onHidePanel}
            activeGroup={activeGroup}
            groupCounts={groupCounts}
            onActiveGroupChange={onActiveGroupChange}
            searchPending={searchPending}
          />
        </div>
        <section
          data-public-map-sidebar-section="rail-organizations-shell"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden px-3 py-1.5"
        >
          <div
            data-public-map-sidebar-section="rail-status-header"
            className="shrink-0 pb-1.5"
          >
            <PublicMapSearchResultsStatus
              hasStaleResourceItems={items.some(
                (item) => item.itemType === "external_resource"
              )}
              resourceItemsLoadStatus={resourceItemsLoadStatus}
              resultCount={items.length}
              searchPending={searchPending}
            />
          </div>
          {searchContext ? (
            <div className="shrink-0 pb-1">
              <PublicMapSearchContextCard
                context={searchContext}
                savedGuideIds={savedGuideIds}
                onToggleSavedGuide={onToggleSavedGuide}
              />
            </div>
          ) : null}
          {resourceItemsLoadStatus === "error" && items.length > 0 ? (
            <div className="shrink-0 pb-2">
              <PublicMapResourceItemsErrorNotice
                error={resourceItemsLoadError}
                hasStaleResourceItems={items.some(
                  (item) => item.itemType === "external_resource"
                )}
                onRetry={onRetryResourceItems}
              />
            </div>
          ) : null}
          <ScrollArea
            data-public-map-sidebar-section="rail-organizations-scroll"
            className="h-full min-h-0 flex-1 overflow-hidden pr-2.5"
            viewportClassName="scroll-fade-effect-y [--mask-height:1.5rem] [--scroll-buffer:1rem] [&>div]:!block [&>div]:!min-w-0 [&>div]:!w-full [&>div]:!max-w-full"
            contentClassName="px-1 pt-1 pb-4"
          >
            <PublicMapOrganizationsStack
              items={items}
              organizations={organizations}
              selectedItemId={selectedItemId}
              selectedOrgId={selectedOrgId}
              query={query}
              activeGroup={activeGroup}
              resourceItemsLoadStatus={resourceItemsLoadStatus}
              resourceItemsLoadError={resourceItemsLoadError}
              constrainedLayout={constrainedLayout}
              leadingContent={
                <PublicMapSearchShortcuts
                  activeGroup={activeGroup}
                  counts={groupCounts}
                  guides={guides}
                  query={query}
                  onCategorySelect={onActiveGroupChange}
                  onGuideSelect={onGuideSelect}
                />
              }
              onClearCategory={() => onActiveGroupChange("all")}
              onClearQuery={() => onQueryChange("")}
              onRetryResourceItems={onRetryResourceItems}
              onSelectItem={onSelectItem}
              onOpenDetails={onOpenDetails}
            />
          </ScrollArea>
        </section>
      </SidebarContent>
    </div>
  )
}

type PublicMapDrawerSearchPanelProps = {
  query: string
  searchContext?: PublicMapSidebarSearchContext | null
  items: PublicMapListItem[]
  organizations: PublicMapOrganization[]
  selectedItemId: string | null
  selectedOrgId?: string | null
  drawerBodyScrollable?: boolean
  activeGroup: PublicMapGroupFilterKey
  discoveryGroupCounts?: PublicMapGroupFilterCounts
  groupCounts: PublicMapGroupFilterCounts
  guides?: PublicMapResourceGuide[]
  featuredGuides?: PublicMapResourceGuide[]
  savedGuideIds?: PublicMapResourceGuideId[]
  resourceItemsLoadStatus?: PublicMapResourceItemsLoadStatus
  resourceItemsLoadError?: string | null
  searchPending?: boolean
  searchActive?: boolean
  onQueryChange: (value: string) => void
  onSearchEngage?: () => void
  onActiveGroupChange: (group: PublicMapGroupFilterKey) => void
  onSelectItem: (itemId: string) => void
  onOpenDetails: (orgId: string) => void
  onGuideSelect?: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  onRetryResourceItems?: () => void
  onSearchCancel?: () => void
}

export function PublicMapDrawerSearchPanel({
  query,
  searchContext = null,
  items,
  organizations,
  selectedItemId,
  selectedOrgId = null,
  activeGroup,
  groupCounts,
  guides = [],
  featuredGuides = [],
  savedGuideIds = [],
  discoveryGroupCounts = groupCounts,
  resourceItemsLoadStatus = "ready",
  resourceItemsLoadError = null,
  searchPending = false,
  searchActive = false,
  onQueryChange,
  onSearchEngage,
  onActiveGroupChange,
  onSelectItem,
  onOpenDetails,
  onGuideSelect,
  onToggleSavedGuide,
  onRetryResourceItems = noopPublicMapSearchAction,
  onSearchCancel,
}: PublicMapDrawerSearchPanelProps) {
  const { containerRef, focusBoundaryResult, handleResultKeyDown } =
    usePublicMapSearchKeyboardNavigation()
  const showDiscoveryHome =
    !searchActive &&
    query.trim().length === 0 &&
    activeGroup === "all" &&
    !searchContext &&
    (resourceItemsLoadStatus !== "error" || items.length === 0)

  function focusSearchInput() {
    containerRef.current
      ?.querySelector<HTMLInputElement>("[data-public-map-search-input]")
      ?.focus()
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col bg-transparent"
      onKeyDown={handleResultKeyDown}
    >
      <div className="shrink-0 px-2.5">
        <PublicMapSearchCard
          query={query}
          onQueryChange={onQueryChange}
          onSearchEngage={onSearchEngage}
          onSearchCancel={onSearchCancel}
          onNavigateResults={focusBoundaryResult}
          activeGroup={activeGroup}
          groupCounts={showDiscoveryHome ? undefined : groupCounts}
          onActiveGroupChange={onActiveGroupChange}
          compact
          searchPending={searchPending}
          showCancel={searchActive}
        />
      </div>
      {showDiscoveryHome ? (
        <PublicMapDirectoryHome
          counts={discoveryGroupCounts}
          featuredGuides={featuredGuides}
          onCategorySelect={onActiveGroupChange}
          onGuideSelect={onGuideSelect ?? noopPublicMapSearchAction}
          onRetryResourceItems={onRetryResourceItems}
          onStartSearch={focusSearchInput}
          onToggleSavedGuide={onToggleSavedGuide}
          resourceItemsLoadStatus={resourceItemsLoadStatus}
          savedGuideIds={savedGuideIds}
        />
      ) : (
        <div
          className={cn("flex min-h-0 flex-1 flex-col overflow-hidden px-2.5")}
        >
          <PublicMapSearchResultsStatus
            hasStaleResourceItems={items.some(
              (item) => item.itemType === "external_resource"
            )}
            resourceItemsLoadStatus={resourceItemsLoadStatus}
            resultCount={items.length}
            searchPending={searchPending}
          />
          {searchContext ? (
            <div className="shrink-0 pt-1">
              <PublicMapSearchContextCard
                context={searchContext}
                savedGuideIds={savedGuideIds}
                onToggleSavedGuide={onToggleSavedGuide}
              />
            </div>
          ) : null}
          {resourceItemsLoadStatus === "error" && items.length > 0 ? (
            <div className="shrink-0 pb-2">
              <PublicMapResourceItemsErrorNotice
                error={resourceItemsLoadError}
                hasStaleResourceItems={items.some(
                  (item) => item.itemType === "external_resource"
                )}
                onRetry={onRetryResourceItems}
              />
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">
            <PublicMapOrganizationsStack
              items={items}
              organizations={organizations}
              selectedItemId={selectedItemId}
              selectedOrgId={selectedOrgId}
              query={query}
              activeGroup={activeGroup}
              resourceItemsLoadStatus={resourceItemsLoadStatus}
              resourceItemsLoadError={resourceItemsLoadError}
              className={cn("h-full", searchContext ? "pt-1" : "pt-2")}
              scrollable
              leadingContent={
                <PublicMapSearchShortcuts
                  activeGroup={activeGroup}
                  counts={groupCounts}
                  guides={guides}
                  query={query}
                  onCategorySelect={onActiveGroupChange}
                  onGuideSelect={onGuideSelect}
                />
              }
              onClearCategory={() => onActiveGroupChange("all")}
              onClearQuery={() => onQueryChange("")}
              onRetryResourceItems={onRetryResourceItems}
              onSelectItem={onSelectItem}
              onOpenDetails={onOpenDetails}
            />
          </div>
        </div>
      )}
    </div>
  )
}
