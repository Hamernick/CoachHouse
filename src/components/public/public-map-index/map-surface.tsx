"use client"

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
import { PublicMapSidebar } from "./sidebar"
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
import { mobileMapControlStyles as styles } from "@/features/mobile-navigation"
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

type PublicMapSurfaceProps = {
  containerRef: RefObject<HTMLDivElement | null>
  sidebarMode: SidebarMode
  directoryCount: number | null
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
  onDrawerInsetChange?: (value: number) => void
  searchContext?: PublicMapSidebarSearchContext | null
  welcomeControl?: ReactNode
  mapOverlay?: ReactNode
  renderDesktopSidebar?: boolean
  renderMobileDrawer?: boolean
  onPanelPresentationChange?: (
    presentation: PublicMapPanelPresentation | null
  ) => void
}

export function PublicMapSurface({
  containerRef,
  sidebarMode,
  directoryCount,
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
  onDrawerInsetChange,
  searchContext = null,
  welcomeControl = null,
  mapOverlay = null,
  renderDesktopSidebar = true,
  renderMobileDrawer = true,
  onPanelPresentationChange,
}: PublicMapSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [panelPortalContainer, setPanelPortalContainer] =
    useState<HTMLDivElement | null>(null)
  const [surfaceWidth, setSurfaceWidth] = useState(0)
  const [surfaceHeight, setSurfaceHeight] = useState(0)

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

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "bg-background relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden",
        styles.surface
      )}
    >
      <div
        ref={setPanelPortalContainer}
        className="pointer-events-none absolute inset-0 z-50 transform-gpu overflow-hidden"
      />
      {panelReady &&
      panelPresentation &&
      (panelPresentation === "drawer"
        ? renderMobileDrawer
        : renderDesktopSidebar) ? (
        <PublicMapSidebar
          sidebarMode={sidebarMode}
          sidebarWidth={sidebarWidth}
          surfaceHeight={surfaceHeight}
          panelPresentation={panelPresentation}
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
          onDrawerInsetChange={onDrawerInsetChange}
          setSidebarMode={onSidebarModeChange}
        />
      ) : null}

      {!tokenAvailable ? (
        <PublicMapFailureState
          reason="configuration"
          onBrowseDirectory={() => onSidebarModeChange("search")}
        />
      ) : (
        <div className="relative h-full min-h-[520px]">
          <div data-public-map-overscan="12px" className="absolute -inset-3">
            <div
              ref={containerRef}
              className="h-full w-full [&_.mapboxgl-ctrl-logo]:!hidden"
              aria-label="Public organization map"
              role="region"
              tabIndex={0}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[linear-gradient(180deg,rgba(250,250,250,0.08),rgba(250,250,250,0.025)_28%,rgba(24,24,27,0.015)_58%,rgba(9,9,11,0.06))]" />
          <PublicMapLocationControl
            {...locationControl}
            directoryCount={directoryCount}
            additionalControls={
              <>
                {welcomeControl}
                <FindMapWeatherCard
                  weather={weather}
                  className={cn(
                    PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
                    "md:hidden"
                  )}
                />
              </>
            }
          />
          <PublicMapWeatherController
            coordinates={locationControl.coordinates}
            onWeatherChange={onWeatherChange}
          />

          <div
            data-public-map-status-overlays="true"
            className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex max-w-[calc(100%_-_2rem)] flex-col items-end gap-2"
          >
            <FindMapWeatherCard
              weather={weather}
              className={cn(
                PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
                "hidden md:flex"
              )}
            />
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
              className="absolute inset-0 z-30 min-h-0"
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
}
