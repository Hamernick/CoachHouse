"use client"

import { useCallback, useMemo, useState } from "react"
import SearchIcon from "lucide-react/dist/esm/icons/search"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { buildPublicMapDrawerSnapPoints } from "./sidebar-snap-points"
import { PublicMapMemberRail, type PublicMapMemberTab } from "./member-rail"
import {
  PublicMapRailPanel,
  usePublicMapDrawerSelectionHandlers,
} from "./sidebar-member-panels"
import {
  PublicMapDrawerSearchPanel,
  PublicMapRailSearchPanel,
} from "./sidebar-panels"
import {
  noopPublicMapSidebarAction,
  type PublicMapSidebarProps,
} from "./sidebar-contract"
import {
  resolveEffectivePublicMapSidebarMode,
  resolveInitialPublicMapDrawerSnapPointIndex,
  resolvePublicMapDrawerViewportHeight,
} from "./sidebar-state-helpers"
import { buildOrganizationDetailHeaderSlots } from "./organization-detail-header-slots"
import { usePublicMapDrawerSearchSession } from "./use-public-map-drawer-search-session"
import { PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME } from "./sidebar-theme"
import { PublicMapSidebarDrawer } from "./sidebar-drawer"
import { PublicMapInlinePanel } from "./inline-panel"
import { usePublicMapSidebarPresentation } from "./use-public-map-sidebar-presentation"
import {
  PublicMapDrawerDetailPanel,
  PublicMapRailDetailPanel,
  PublicMapResourceDrawerDetailPanel,
  PublicMapResourceRailDetailPanel,
} from "./sidebar-lazy-detail-panels"

export type { PublicMapSidebarSearchContext } from "./sidebar-panels"

function PublicMapSidebarOpenButton({
  hidden,
  onOpen,
}: {
  hidden: boolean
  onOpen: () => void
}) {
  return (
    <div
      data-public-map-sidebar-open-control="true"
      className={cn(
        "absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-20 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        hidden
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none -translate-x-1 opacity-0"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        className={cn(
          "h-10 rounded-full px-3 shadow-sm backdrop-blur-xl",
          PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
        )}
      >
        <SearchIcon className="h-4 w-4" aria-hidden />
        <span className="sr-only">Open resource map panel</span>
      </Button>
    </div>
  )
}

export function PublicMapSidebar({
  inline = false,
  sidebarMode,
  sidebarWidth,
  surfaceHeight,
  panelPresentation,
  portalContainer,
  filteredItems,
  filteredOrganizations,
  selectedItemId,
  selectedOrganization,
  selectedResourceItem = null,
  canManageResourceMap = false,
  organizationCurationAction,
  resourceMapCurationAction,
  favorites,
  collectedResourceIds = [],
  guides = [],
  featuredGuides = [],
  savedGuideIds = [],
  savedGuides = [],
  savedOrganizations = [],
  savedResources = [],
  unresolvedCollectedResourceCount = 0,
  query,
  activeGroup,
  groupCounts,
  discoveryGroupCounts = groupCounts,
  resourceItemsLoadStatus = "ready",
  resourceItemsLoadError = null,
  searchPending = false,
  searchContext = null,
  setQuery,
  setActiveGroup,
  retryResourceItems = noopPublicMapSidebarAction,
  toggleFavorite,
  toggleCollectedResource = noopPublicMapSidebarAction,
  onSelectItem,
  onGuideSelect,
  onToggleSavedGuide,
  onSelectOrganization,
  onOpenDetails,
  onBackToSearch,
  onDrawerInsetChange,
  setSidebarMode,
}: PublicMapSidebarProps) {
  const collectedCount = new Set(favorites).size + new Set(collectedResourceIds).size + new Set(savedGuideIds).size
  const compact = panelPresentation === "drawer"
  const effectiveSidebarMode = resolveEffectivePublicMapSidebarMode({
    compact,
    selectedOrganization,
    selectedResourceItem,
    sidebarMode,
  })
  const panelOpen = compact ? true : effectiveSidebarMode !== "hidden"
  const snapPoints = useMemo(
    () => buildPublicMapDrawerSnapPoints(surfaceHeight),
    [surfaceHeight]
  )
  const [activeSnapIndex, setActiveSnapIndex] = useState<0 | 1 | 2>(
    resolveInitialPublicMapDrawerSnapPointIndex(effectiveSidebarMode)
  )
  const [drawerTab, setDrawerTab] = useState<PublicMapMemberTab>("directory")
  const activeSnapPoint = snapPoints[activeSnapIndex]
  const drawerIsFullscreen = activeSnapIndex === 2
  const drawerViewportHeight = resolvePublicMapDrawerViewportHeight({
    activeSnapPoint,
    fullscreen: drawerIsFullscreen,
  })
  usePublicMapSidebarPresentation({
    compact,
    sidebarMode,
    setSidebarMode,
    panelPresentation,
    panelOpen,
    effectiveSidebarMode,
    setActiveSnapIndex,
    drawerIsFullscreen,
    activeSnapPoint,
    surfaceHeight,
    onDrawerInsetChange,
  })
  const listItems = searchContext?.items ?? filteredItems
  const handleDrawerTabChange = useCallback(
    (nextTab: PublicMapMemberTab) => {
      setDrawerTab(nextTab)
      if (nextTab !== "directory") {
        setSidebarMode("search")
        setActiveSnapIndex(1)
      }
    },
    [setSidebarMode]
  )
  const {
    handleGuideSelect: handleDrawerGuideSelect,
    handleOrganizationSelect: handleDrawerOrganizationSelect,
    handleResourceSelect: handleDrawerResourceSelect,
  } = usePublicMapDrawerSelectionHandlers({
    onGuideSelect,
    onSelectItem,
    onSelectOrganization,
    setActiveSnapIndex,
    setDrawerTab,
  })
  const {
    changeGroup: handleDrawerGroupChange,
    changeQuery: handleDrawerQueryChange,
    cancelSearch: handleDrawerSearchCancel,
    engageSearch: handleDrawerSearchEngage,
    searchActive: drawerSearchActive,
  } = usePublicMapDrawerSearchSession({
    activeGroup,
    query,
    searchContext,
    setActiveGroup,
    setActiveSnapIndex,
    setDrawerTab,
    setQuery,
    setSidebarMode,
  })
  const organizationDetailHeaderSlots = buildOrganizationDetailHeaderSlots({
    active: effectiveSidebarMode === "details",
    canManageResourceMap,
    favorites,
    onBack: onBackToSearch,
    onToggleFavorite: toggleFavorite,
    organization: selectedOrganization,
    organizationCurationAction,
  })
  const railDirectoryPanel =
    effectiveSidebarMode === "search" ? (
      <PublicMapRailSearchPanel
        query={query}
        searchContext={searchContext}
        items={listItems}
        organizations={filteredOrganizations}
        selectedItemId={selectedItemId}
        selectedOrgId={selectedOrganization?.id ?? null}
        constrainedLayout={panelPresentation === "rail" && sidebarWidth < 376}
        activeGroup={activeGroup}
        groupCounts={groupCounts}
        guides={guides}
        savedGuideIds={savedGuideIds}
        resourceItemsLoadStatus={resourceItemsLoadStatus}
        resourceItemsLoadError={resourceItemsLoadError}
        searchPending={searchPending}
        onQueryChange={setQuery}
        onActiveGroupChange={setActiveGroup}
        onHidePanel={() => setSidebarMode("hidden")}
        onGuideSelect={onGuideSelect}
        onToggleSavedGuide={onToggleSavedGuide}
        onRetryResourceItems={retryResourceItems}
        onSelectItem={onSelectItem}
        onOpenDetails={(organizationId) =>
          onOpenDetails(organizationId, {
            preserveSearchContext: Boolean(searchContext),
          })
        }
      />
    ) : selectedOrganization ? (
      <PublicMapRailDetailPanel
        canManageResourceMap={canManageResourceMap}
        organizationCurationAction={organizationCurationAction}
        organization={selectedOrganization}
        favorites={favorites}
        onBack={onBackToSearch}
        onToggleFavorite={toggleFavorite}
        showHeaderControls={false}
      />
    ) : selectedResourceItem ? (
      <PublicMapResourceRailDetailPanel
        canManageResourceMap={canManageResourceMap}
        collected={collectedResourceIds.includes(selectedResourceItem.id)}
        item={selectedResourceItem}
        onBack={onBackToSearch}
        onToggleCollected={toggleCollectedResource}
        resourceMapCurationAction={resourceMapCurationAction}
      />
    ) : null
  const railPanel = (
    <PublicMapRailPanel
      collectedCount={collectedCount}
      directoryHeaderStart={organizationDetailHeaderSlots.start}
      directoryHeaderEnd={organizationDetailHeaderSlots.end}
      directoryRail={railDirectoryPanel}
      directoryMode={effectiveSidebarMode === "details" ? "details" : "search"}
      guides={guides}
      savedGuideIds={savedGuideIds}
      savedGuides={savedGuides}
      savedOrganizations={savedOrganizations}
      savedResources={savedResources}
      unresolvedCollectedResourceCount={unresolvedCollectedResourceCount}
      onRetryResourceItems={retryResourceItems}
      resourceItemsLoadStatus={resourceItemsLoadStatus}
      resourceItemsLoadError={resourceItemsLoadError}
      onGuideSelect={onGuideSelect}
      onToggleSavedGuide={onToggleSavedGuide}
      onSelectOrganization={onSelectOrganization}
      onSelectResource={onSelectItem}
      onToggleFavorite={toggleFavorite}
      onToggleCollectedResource={toggleCollectedResource}
    />
  )

  const drawerDirectoryPanel =
    effectiveSidebarMode === "search" ? (
      <PublicMapDrawerSearchPanel
        showResults
        directoryScrollable={!inline}
        showSearch={!inline}
        showFooter={!inline}
        query={query}
        searchContext={searchContext}
        items={listItems}
        organizations={filteredOrganizations}
        selectedItemId={selectedItemId}
        selectedOrgId={selectedOrganization?.id ?? null}
        activeGroup={activeGroup}
        discoveryGroupCounts={discoveryGroupCounts}
        groupCounts={groupCounts}
        guides={guides}
        featuredGuides={featuredGuides}
        savedGuideIds={savedGuideIds}
        resourceItemsLoadStatus={resourceItemsLoadStatus}
        resourceItemsLoadError={resourceItemsLoadError}
        searchPending={searchPending}
        searchActive={drawerSearchActive}
        onQueryChange={handleDrawerQueryChange}
        onSearchEngage={handleDrawerSearchEngage}
        onActiveGroupChange={handleDrawerGroupChange}
        onRetryResourceItems={retryResourceItems}
        onSelectItem={onSelectItem}
        onOpenDetails={(organizationId) =>
          onOpenDetails(organizationId, {
            preserveSearchContext: Boolean(searchContext),
          })
        }
        onGuideSelect={handleDrawerGuideSelect}
        onToggleSavedGuide={onToggleSavedGuide}
        onSearchCancel={handleDrawerSearchCancel}
      />
    ) : selectedOrganization ? (
      <PublicMapDrawerDetailPanel
        canManageResourceMap={canManageResourceMap}
        organizationCurationAction={organizationCurationAction}
        organization={selectedOrganization}
        favorites={favorites}
        onBack={onBackToSearch}
        onToggleFavorite={toggleFavorite}
      />
    ) : selectedResourceItem ? (
      <PublicMapResourceDrawerDetailPanel
        canManageResourceMap={canManageResourceMap}
        collected={collectedResourceIds.includes(selectedResourceItem.id)}
        item={selectedResourceItem}
        onBack={onBackToSearch}
        onToggleCollected={toggleCollectedResource}
        resourceMapCurationAction={resourceMapCurationAction}
      />
    ) : null

  const drawerPanel =
    effectiveSidebarMode === "details" ? (
      <div
        data-public-map-drawer-panel="details"
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      >
        {drawerDirectoryPanel}
      </div>
    ) : (
      <PublicMapMemberRail
        collectedCount={collectedCount}
        showSavedSearch={!inline}
        activeTab={drawerTab}
        directoryHeaderStart={organizationDetailHeaderSlots.start}
        directoryHeaderEnd={organizationDetailHeaderSlots.end}
        directoryRail={drawerDirectoryPanel}
        directoryMode="search"
        guides={guides}
        savedGuideIds={savedGuideIds}
        savedGuides={savedGuides}
        savedOrganizations={savedOrganizations}
        savedResources={savedResources}
        unresolvedCollectedResourceCount={unresolvedCollectedResourceCount}
        onRetryResourceItems={retryResourceItems}
        resourceItemsLoadStatus={resourceItemsLoadStatus}
        resourceItemsLoadError={resourceItemsLoadError}
        onActiveTabChange={handleDrawerTabChange}
        onGuideSelect={handleDrawerGuideSelect}
        onToggleSavedGuide={onToggleSavedGuide}
        onSelectOrganization={handleDrawerOrganizationSelect}
        onSelectResource={handleDrawerResourceSelect}
        onToggleFavorite={toggleFavorite}
        onToggleCollectedResource={toggleCollectedResource}
      />
    )

  if (inline) {
    return (
      <PublicMapInlinePanel
        query={query}
        onQueryChange={handleDrawerQueryChange}
        onSearchEngage={handleDrawerSearchEngage}
        onSearchCancel={handleDrawerSearchCancel}
        activeGroup={activeGroup}
        groupCounts={drawerSearchActive ? groupCounts : undefined}
        onActiveGroupChange={handleDrawerGroupChange}
        compact
        searchPending={searchPending}
        showCancel={drawerSearchActive}
      >
        {drawerPanel}
      </PublicMapInlinePanel>
    )
  }

  return (
    <>
      <PublicMapSidebarOpenButton
        hidden={effectiveSidebarMode === "hidden"}
        onOpen={() => setSidebarMode("search")}
      />

      {panelPresentation === "drawer" ? (
        <PublicMapSidebarDrawer
          activeSnapIndex={activeSnapIndex}
          activeSnapPoint={activeSnapPoint}
          drawerIsFullscreen={drawerIsFullscreen}
          drawerPanel={drawerPanel}
          drawerViewportHeight={drawerViewportHeight}
          effectiveSidebarMode={effectiveSidebarMode}
          panelOpen={panelOpen}
          portalContainer={portalContainer}
          setActiveSnapIndex={setActiveSnapIndex}
          setDrawerTab={setDrawerTab}
          setSidebarMode={setSidebarMode}
          snapPoints={snapPoints}
          surfaceHeight={surfaceHeight}
        />
      ) : (
        <aside
          className={cn(
            "pointer-events-none absolute top-0 bottom-0 left-0 z-20 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            effectiveSidebarMode === "hidden"
              ? "-translate-x-[calc(100%+1rem)] opacity-0"
              : "translate-x-0 opacity-100"
          )}
          style={{ width: `${Math.max(0, Math.round(sidebarWidth))}px` }}
        >
          {railPanel}
        </aside>
      )}
    </>
  )
}
