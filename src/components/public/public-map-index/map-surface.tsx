"use client"

import type { DirectoryFormationCounts } from "./directory-status-pill"

import dynamic from "next/dynamic"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import type {
  FindMapWeatherResponse,
  FindMapWeatherSnapshot,
} from "@/features/find-map/client"
import { cn } from "@/lib/utils"

import type { SidebarMode } from "./constants"
import { resolvePublicMapSurfacePanelState } from "./map-surface-helpers"
import {
  PublicMapLocationControl,
  type PublicMapLocationControlState,
} from "./location-control"
import { PublicMapFailureState } from "./map-failure-state"
import { PublicMapLoadingState } from "./map-loading-state"
import { PublicMapEmbeddedProfile } from "./embedded-profile"
import { usePublicMapEmbeddedScreen } from "./embedded-screen-state"
import { PublicMapSidebar } from "./sidebar"
import { PublicMapEmbeddedLayout } from "./embedded-layout"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { PublicMapSidebarSearchContext } from "./sidebar"
import type { PublicMapPanelPresentation } from "./map-view-helpers"
import type { PublicMapListItem } from "./map-items-state"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganizationCurationAction } from "./organization-detail-admin-actions"
import type { PublicMapResourceCurationAction } from "./resource-detail-admin-actions"
import type { PublicMapResourceGuide } from "./resource-guides"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"
import type {
  PublicMapGroupFilterCounts,
  PublicMapGroupFilterKey,
} from "./category-filter"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"
import type { PublicMapResourceItemsLoadStatus } from "./use-resource-map-items"

const PublicMapAuthSheet = dynamic(() =>
  import("./auth-sheet").then((module) => module.PublicMapAuthSheet)
)
const FindMapWeatherCard = dynamic(
  () =>
    import("@/features/find-map/client").then(
      (module) => module.FindMapWeatherCard
    ),
  { ssr: false }
)
const PublicMapWeatherController = dynamic(
  () =>
    import("./public-map-weather-controller").then(
      (module) => module.PublicMapWeatherController
    ),
  { ssr: false }
)

export type PublicMapSurfaceProps = {
  mapReady?: boolean
  embedded?: boolean
  containerRef: RefObject<HTMLDivElement | null>
  sidebarMode: SidebarMode
  directoryCount: number | null
  directoryFormationCounts?: DirectoryFormationCounts
  directoryCountEstimated?: boolean
  filteredItems: PublicMapListItem[]
  filteredOrganizations: PublicMapOrganization[]
  selectedItemId: string | null
  selectedOrganization: PublicMapOrganization | null
  selectedResourceItem: ExternalResourceMapItem | null
  canManageResourceMap?: boolean
  organizationCurationAction?: PublicMapOrganizationCurationAction
  resourceMapCurationAction?: PublicMapResourceCurationAction
  favorites: string[]
  collectedResourceIds?: string[]
  guides?: PublicMapResourceGuide[]
  featuredGuides?: PublicMapResourceGuide[]
  savedGuideIds?: PublicMapResourceGuideId[]
  savedGuides?: PublicMapResourceGuide[]
  savedOrganizations: PublicMapOrganization[]
  savedResources?: ExternalResourceMapItem[]
  unresolvedCollectedResourceCount?: number
  query: string
  activeGroup: PublicMapGroupFilterKey
  discoveryGroupCounts?: PublicMapGroupFilterCounts
  groupCounts: PublicMapGroupFilterCounts
  resourceItemsLoadStatus: PublicMapResourceItemsLoadStatus
  resourceItemsLoadError?: string | null
  searchPending: boolean
  tokenAvailable: boolean
  mapError: string | null
  locationControl: PublicMapLocationControlState
  weather?: FindMapWeatherSnapshot | null
  onWeatherChange: (weather: FindMapWeatherResponse | null) => void
  preferencesSaveError: string | null
  authSheetOpen: boolean
  authRedirectTo: string
  onQueryChange: (value: string) => void
  onActiveGroupChange: (group: PublicMapGroupFilterKey) => void
  onRetryResourceItems: () => void
  onRetryMap: () => void
  onToggleFavorite: (orgId: string) => void
  onToggleCollectedResource?: (resourceId: string) => void
  onGuideSelect?: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  onSelectOrganization: (organizationId: string) => void
  onSelectItem: (itemId: string) => void
  onOpenOrgDetails: (
    orgId: string,
    options?: { preserveSearchContext?: boolean }
  ) => void
  onBackToSearch: () => void
  onSidebarModeChange: (mode: SidebarMode) => void
  onAuthSheetOpenChange: (nextOpen: boolean) => void
  onSidebarInsetChange?: (value: number) => void
  searchContext?: PublicMapSidebarSearchContext | null
  mapOverlay?: ReactNode
  renderDesktopSidebar?: boolean
  renderMobileDrawer?: boolean
  onPanelPresentationChange?: (
    presentation: PublicMapPanelPresentation | null
  ) => void
}

export function PublicMapSurface(props: PublicMapSurfaceProps) {
  const {
  mapReady = false,
  embedded = false,
  containerRef,
  sidebarMode,
  directoryCount,
  directoryCountEstimated = false,
  directoryFormationCounts,
  filteredItems,
  filteredOrganizations,
  selectedItemId,
  selectedOrganization,
  selectedResourceItem,
  canManageResourceMap = false,
  organizationCurationAction,
  resourceMapCurationAction,
  favorites,
  collectedResourceIds = [],
  guides = [],
  featuredGuides = [],
  savedGuideIds = [],
  savedGuides = [],
  savedOrganizations,
  savedResources = [],
  unresolvedCollectedResourceCount = 0,
  query,
  activeGroup,
  groupCounts,
  discoveryGroupCounts = groupCounts,
  resourceItemsLoadStatus,
  resourceItemsLoadError = null,
  searchPending,
  tokenAvailable,
  mapError,
  locationControl,
  weather = null,
  onWeatherChange,
  preferencesSaveError,
  authSheetOpen,
  authRedirectTo,
  onQueryChange,
  onActiveGroupChange,
  onRetryResourceItems,
  onRetryMap,
  onToggleFavorite,
  onToggleCollectedResource = () => undefined,
  onGuideSelect,
  onToggleSavedGuide,
  onSelectOrganization,
  onSelectItem,
  onOpenOrgDetails,
  onBackToSearch,
  onSidebarModeChange,
  onAuthSheetOpenChange,
  onSidebarInsetChange,
  searchContext = null,
  mapOverlay = null,
  renderDesktopSidebar = true,
  renderMobileDrawer = true,
  onPanelPresentationChange,
  } = props
  const screen = usePublicMapEmbeddedScreen(props)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [panelPortalContainer, setPanelPortalContainer] =
    useState<HTMLDivElement | null>(null)
  const [surfaceWidth, setSurfaceWidth] = useState(0)
  const [surfaceHeight, setSurfaceHeight] = useState(0)
  const onLocationOpenChange = locationControl.onOpenChange

  useEffect(() => {
    if (embedded && (sidebarMode === "details" || screen.mapHidden)) onLocationOpenChange(false)
  }, [embedded, sidebarMode, screen.mapHidden, onLocationOpenChange])

  useLayoutEffect(() => {
    const element = surfaceRef.current
    if (!element) return

    const updateSize = () => {
      setSurfaceWidth(element.clientWidth)
      setSurfaceHeight(element.clientHeight)
    }
    updateSize()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize)
      return () => window.removeEventListener("resize", updateSize)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSurfaceWidth(entry.contentRect.width)
      setSurfaceHeight(entry.contentRect.height)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { panelPresentation, panelReady, sidebarWidth } = useMemo(
    () =>
      resolvePublicMapSurfacePanelState({
        surfaceWidth,
        surfaceHeight,
        sidebarMode,
        portalContainerReady: panelPortalContainer !== null,
      }),
    [panelPortalContainer, sidebarMode, surfaceHeight, surfaceWidth]
  )

  const sidebarInset =
    panelPresentation === "rail" && renderDesktopSidebar ? sidebarWidth : 0

  useEffect(() => {
    onSidebarInsetChange?.(sidebarInset)
  }, [onSidebarInsetChange, sidebarInset])

  useLayoutEffect(() => {
    onPanelPresentationChange?.(panelReady ? panelPresentation : null)
  }, [onPanelPresentationChange, panelPresentation, panelReady])

  const sidebar = (
    <PublicMapSidebar
      inline={embedded}
      sidebarMode={embedded ? "search" : sidebarMode}
      sidebarWidth={sidebarWidth}
      surfaceHeight={surfaceHeight}
      panelPresentation={panelPresentation ?? "drawer"}
      portalContainer={panelPortalContainer}
      filteredItems={filteredItems}
      filteredOrganizations={filteredOrganizations}
      selectedItemId={selectedItemId}
      selectedOrganization={selectedOrganization}
      selectedResourceItem={selectedResourceItem}
      canManageResourceMap={canManageResourceMap}
      organizationCurationAction={organizationCurationAction}
      resourceMapCurationAction={resourceMapCurationAction}
      favorites={favorites}
      collectedResourceIds={collectedResourceIds}
      guides={guides}
      featuredGuides={featuredGuides}
      savedGuideIds={savedGuideIds}
      savedGuides={savedGuides}
      savedOrganizations={savedOrganizations}
      savedResources={savedResources}
      unresolvedCollectedResourceCount={unresolvedCollectedResourceCount}
      query={query}
      activeGroup={activeGroup}
      discoveryGroupCounts={discoveryGroupCounts}
      groupCounts={groupCounts}
      resourceItemsLoadStatus={resourceItemsLoadStatus}
      resourceItemsLoadError={resourceItemsLoadError}
      searchPending={searchPending}
      searchContext={searchContext}
      setQuery={onQueryChange}
      setActiveGroup={onActiveGroupChange}
      retryResourceItems={onRetryResourceItems}
      toggleFavorite={onToggleFavorite}
      toggleCollectedResource={onToggleCollectedResource}
      onGuideSelect={onGuideSelect}
      onToggleSavedGuide={onToggleSavedGuide}
      onSelectOrganization={onSelectOrganization}
      onSelectItem={onSelectItem}
      onOpenDetails={onOpenOrgDetails}
      onBackToSearch={onBackToSearch}
      setSidebarMode={onSidebarModeChange}
    />
  )
  const mapSurface = (
    <div
      ref={surfaceRef}
      className={cn(
        "relative h-full min-h-0 w-full min-w-0 flex-1",
        embedded ? "pointer-events-none overflow-hidden rounded-3xl" : "overflow-hidden bg-background"
      )}
    >
      <div
        ref={setPanelPortalContainer}
        className="pointer-events-none absolute inset-0 z-50 transform-gpu overflow-hidden rounded-[inherit]"
      />
      {!embedded &&
      panelReady &&
      panelPresentation &&
      (panelPresentation === "drawer"
        ? renderMobileDrawer
        : renderDesktopSidebar)
        ? sidebar
        : null}

      {!tokenAvailable ? (
        <PublicMapFailureState
          reason="configuration"
          className={embedded ? "pointer-events-auto z-30 min-h-0 rounded-3xl" : undefined}
          onBrowseDirectory={() => onSidebarModeChange("search")}
        />
      ) : (
        <div
          className={cn(
            "relative h-full",
            embedded ? "min-h-0" : "min-h-[520px]"
          )}
        >
          <div
            data-public-map-overscan={embedded ? undefined : "12px"}
            data-lenis-prevent={embedded ? "" : undefined}
            className={embedded ? "pointer-events-auto absolute inset-0 z-0" : "absolute -inset-3"}
          >
            <div
              ref={containerRef}
              data-public-map-visible={embedded ? mapReady && !mapError && !screen.mapHidden : undefined}
              inert={embedded && screen.mapHidden}
              aria-hidden={embedded && screen.mapHidden}
              className={cn(
                "h-full w-full [&_.mapboxgl-ctrl-logo]:!hidden",
                embedded && "transition-[opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
                embedded && (!mapReady || mapError || screen.mapHidden) && "invisible opacity-0"
              )}
              aria-label="Public organization map"
              aria-busy={embedded && !mapReady && !mapError}
              role="region"
              tabIndex={embedded && (!mapReady || mapError || screen.mapHidden) ? -1 : 0}
            />
          </div>
          <div className={cn(
            "pointer-events-none absolute inset-0 hidden dark:block dark:bg-[linear-gradient(180deg,rgba(250,250,250,0.08),rgba(250,250,250,0.025)_28%,rgba(24,24,27,0.015)_58%,rgba(9,9,11,0.06))]",
            embedded && "rounded-3xl"
          )} />
          {embedded ? <PublicMapLoadingState loading={!mapReady && !mapError} /> : null}
          {!embedded ? <PublicMapLocationControl
            {...locationControl}
            directoryCount={directoryCount} directoryFormationCounts={directoryFormationCounts} directoryCountEstimated={directoryCountEstimated}
          /> : null}
          <PublicMapWeatherController
            coordinates={locationControl.coordinates}
            onWeatherChange={onWeatherChange}
          />

          <div
            data-public-map-status-overlays="true"
            className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex max-w-[calc(100%_-_2rem)] flex-col items-end gap-2"
          >
            {!embedded ? <FindMapWeatherCard
              weather={weather}
              className={PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME}
            /> : null}
            {preferencesSaveError ? (
              <Alert
                className={cn(
                  PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
                  "border-destructive/30 pointer-events-auto rounded-2xl text-xs shadow-sm"
                )}
              >
                <AlertDescription>{preferencesSaveError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          {mapError ? (
            <PublicMapFailureState
              reason="runtime"
              className={cn("pointer-events-auto absolute inset-0 z-30 min-h-0", embedded && "rounded-3xl")}
              onBrowseDirectory={() => onSidebarModeChange("search")}
              onRetry={onRetryMap}
            />
          ) : null}
        </div>
      )}

      {tokenAvailable && mapOverlay ? (
        <div
          data-public-map-overlay-layer=""
          className="pointer-events-none absolute inset-0"
        >
          {mapOverlay}
        </div>
      ) : null}

      {authSheetOpen ? (
        <PublicMapAuthSheet
          open
          onOpenChange={onAuthSheetOpenChange}
          redirectTo={authRedirectTo}
        />
      ) : null}
    </div>
  )

  return embedded ? (
    <PublicMapEmbeddedLayout
      contentActive={screen.mapHidden}
      profile={<PublicMapEmbeddedProfile key={selectedOrganization?.id ?? selectedResourceItem?.id} surface={props} />}
      map={mapSurface}
      panel={sidebar}
      toolbar={tokenAvailable ? <>
        <PublicMapLocationControl {...locationControl} directoryCount={directoryCount} directoryFormationCounts={directoryFormationCounts} directoryCountEstimated={directoryCountEstimated} inline />
        <FindMapWeatherCard weather={weather} unstyled />
      </> : null}
    />
  ) : (
    mapSurface
  )
}
