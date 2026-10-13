"use client"

import { useResourceDirectory } from "@/features/find-resource-index/client"
import { useResourcePresentation } from "@/features/find-resource-index/client"

import { useCallback, useDeferredValue, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { usePublicMapNavigation } from "./public-map-index/use-public-map-profile-navigation"
import { useTheme } from "next-themes"
import type mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { PublicMapBounds } from "./public-map-index/helpers"
import {
  useSyncPublicMapAuthFavorite,
  useSyncPublicMapLayout,
} from "./public-map-index/layout-sync"
import {
  resolveBounds,
  resolvePublicMapboxToken,
} from "./public-map-index/map-view-helpers"
import {
  type PublicMapMapboxApi,
  useInitializePublicMap,
  useResolveInitialPublicMapViewport,
  resolvePublicMapSelectedOrganization,
  useSyncSidebarCameraPadding,
} from "./public-map-index/public-map-index-runtime"
import { normalizePublicMapTheme } from "@/lib/public-map/public-map-theme"
import { PublicMapSurface } from "./public-map-index/map-surface"
import { PublicMapIndexChrome } from "./public-map-index/public-map-index-chrome"
import { usePublicMapActions } from "./public-map-index/use-public-map-actions"
import type { PublicMapSameLocationSelection } from "@/lib/public-map/public-map-layer-api"
import { usePublicMapFilterUrlState } from "./public-map-index/use-filter-url-state"
import { usePublicMapPreferences } from "./public-map-index/use-public-map-preferences"
import { usePublicMapSelectableItemMap } from "./public-map-index/map-items-state"
import { usePublicMapSameLocationSearchContext } from "./public-map-index/same-location-state"
import {
  usePublicMapOrganizationById,
  usePublicMapOrganizationFilterState,
} from "./public-map-index/public-map-index-filter-state"
import {
  usePublicMapResourceGuideState,
  usePublicMapSavedGuideState,
} from "./public-map-index/resource-guides"
import type { PublicMapIndexProps } from "./public-map-index/public-map-index-types"
import {
  useSyncPublicMapSelectedListItem,
} from "./public-map-index/public-map-index-selection"
import {
  EMPTY_PUBLIC_MAP_RESOURCE_ITEMS,
} from "./public-map-index/use-resource-map-items"
import { usePublicMapResourceItemDetail } from "./public-map-index/use-resource-item-detail"
import { usePublicMapLocationWeather } from "./public-map-index/use-public-map-location-weather"
import { resolvePublicMapDirectoryCount, resolveDirectoryFormationCounts } from "./public-map-index/directory-status-pill"
import {
  useFocusPublicMapCameraTarget,
  useInitialSidebarMode,
  useInitialPublicMapSelection,
  usePublicMapOnboardingState,
  usePublicMapSavedItems,
  useSelectedPublicMapResource,
  usePublicMapStartupEnabled,
} from "./public-map-index/public-map-index-state"

function usePublicMapRetryState() {
  const [mapError, setMapError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const retryMap = useCallback(() => {
    setMapError(null)
    setRetryVersion((current) => current + 1)
  }, [])

  return { mapError, retryMap, retryVersion, setMapError }
}

export function PublicMapIndex({
  embedded = false,
  organizations,
  mapboxToken,
  initialPublicSlug,
  initialResource,
  viewer: initialViewer = null,
  includeSeedResources = false,
  resourceItems: initialResourceItems = EMPTY_PUBLIC_MAP_RESOURCE_ITEMS,
  resourceItemsEndpoint,
  canManageResourceMap = false,
  organizationCurationAction,
  resourceMapCurationAction,
  memberOnboarding = undefined,
  adminOnboardingPreview = undefined,
}: PublicMapIndexProps) {
  const router = useRouter()
  const mapTheme = normalizePublicMapTheme(useTheme().resolvedTheme)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapboxRef = useRef<PublicMapMapboxApi | null>(null)
  const mapStartRef = useRef<(() => void) | null>(null)
  const hasResolvedInitialViewportRef = useRef(false)
  const mapLoadedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const appliedBoundsRef = useRef<PublicMapBounds | null>(null)
  const token = resolvePublicMapboxToken(mapboxToken)
  const tokenAvailable = Boolean(token)
  const { mapError, retryMap, retryVersion, setMapError } =
    usePublicMapRetryState()
  const [sidebarMode, setSidebarMode] = useInitialSidebarMode(initialPublicSlug ?? initialResource?.id)
  const mapStartupEnabled = usePublicMapStartupEnabled(embedded && sidebarMode === "details")
  const {
    initialOrganization,
    selectedOrgId,
    setSelectedOrgId,
    selectedListItemId,
    setSelectedListItemId,
    cameraTarget,
    setCameraTarget,
  } = useInitialPublicMapSelection(organizations, initialPublicSlug, initialResource?.id)
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [sidebarInsetLeft, setSidebarInsetLeft] = useState(0)
  const [initialViewportResolved, setInitialViewportResolved] = useState(false)
  const [mapLoadVersion, setMapLoadVersion] = useState(0)
  const [sameLocationSelection, setSameLocationSelection] =
    useState<PublicMapSameLocationSelection | null>(null)
  const clearMapTransientSelection = useCallback(() => {
    setSameLocationSelection(null)
    setSelectedListItemId(null)
    setSelectedOrgId(null)
    setSidebarMode("search")
  }, [setSelectedListItemId, setSelectedOrgId, setSidebarMode])
  const {
    activeGroup,
    activeGuideId,
    flushFilterHistory,
    handleActiveGroupChange,
    handleGuideChange,
    handleQueryChange,
    query,
    searchParams,
  } = usePublicMapFilterUrlState({ embedded, onFilterChange: clearMapTransientSelection })
  const deferredQuery = useDeferredValue(query)
  const {
    collectedResourceIds,
    favorites,
    savedGuideIds,
    preferencesSaveError,
    viewer,
    setFavorites,
    setSavedGuideIds,
    setCollectedResourceIds,
    setRecentOrganizationIds,
  } = usePublicMapPreferences({ initialViewer })
  const directory = useResourceDirectory({
    endpoint: resourceItemsEndpoint, initialResourceItems, query, category: activeGroup,
    guide: activeGuideId, mapRef, mapLoadVersion,
    retainedIds: [...collectedResourceIds, ...(selectedListItemId?.startsWith("resource_map:") || (selectedListItemId?.startsWith("local_resource_map:") || selectedListItemId?.startsWith("nonprofit:")) ? [selectedListItemId] : [])],
  })
  const { resourceItems, error: resourceItemsLoadError, retry: retryResourceItems, status: resourceItemsLoadStatus, totalResourceCount } = directory
  const remotePresentation = useResourcePresentation({ organizations, mapItems: directory.mapItems, query: deferredQuery, category: activeGroup, guide: activeGuideId, metadata: directory.metadata })
  const memberOnboardingState = usePublicMapOnboardingState(
    Boolean(viewer ?? initialViewer),
    memberOnboarding,
    adminOnboardingPreview
  )
  const organizationById = usePublicMapOrganizationById(organizations)
  const filterState = usePublicMapOrganizationFilterState({
    activeGroup,
    deferredQuery,
    favorites,
    includeSeedResources,
    organizations,
    resourceItems: directory.directoryItems,
  })
  const {
    activeGuideSearchContext,
    clearActiveGuide,
    handleGuideSelect,
    resourceGuides,
    visibleMapItems: localVisibleMapItems,
  } = usePublicMapResourceGuideState({
    activeGuideId,
    filteredMapItems: filterState.filteredItems,
    organizations,
    includeSeedResources,
    resourceItems: directory.directoryItems,
    guideSummaries: directory.enabled ? directory.metadata?.guides : undefined,
    setSameLocationSelection,
    setSelectedListItemId,
    setSelectedOrgId,
    setSidebarMode,
    setActiveGuideId: handleGuideChange,
  })
  const { featuredGuides, savedGuides, toggleSavedGuide } =
    usePublicMapSavedGuideState({
      resourceGuides,
      savedGuideIds,
      setSavedGuideIds,
    })
  const visibleMapItems = directory.enabled ? remotePresentation.mapItems : localVisibleMapItems
  const selectableMapItemById = usePublicMapSelectableItemMap(visibleMapItems, directory.enabled ? resourceItems : undefined)
  const selectedOrganization = resolvePublicMapSelectedOrganization({
    organizationById,
    selectedOrgId,
  })
  const selectedResourceIndexItem = useSelectedPublicMapResource(
    selectableMapItemById,
    selectedListItemId
  )
  const selectedResourceItem = usePublicMapResourceItemDetail(
    selectedResourceIndexItem,
    resourceItemsEndpoint?.startsWith("/api/public/resource-map/index") ?? false
  )
  const {
    savedOrganizations,
    savedResources,
    toggleCollectedResource,
    unresolvedCollectedResourceCount,
  } = usePublicMapSavedItems({
    collectedResourceIds,
    favorites,
    organizationById,
    resourceItems,
    retainMissingResources: directory.enabled || resourceItemsLoadStatus !== "ready",
    setCollectedResourceIds,
  })
  const authAction = searchParams.get("auth_action")
  const authOrganizationId = searchParams.get("auth_org")
  const handleSameLocationSelectionChange = useCallback(
    (selection: PublicMapSameLocationSelection | null) => {
      if (selection) {
        clearActiveGuide()
      }
      setSameLocationSelection(selection)
    },
    [clearActiveGuide]
  )
  const sameLocationSearchContext = usePublicMapSameLocationSearchContext({
    itemBySelectableId: selectableMapItemById,
    sameLocationSelection,
    setSameLocationSelection: handleSameLocationSelectionChange,
  })
  const activeSearchContext =
    sameLocationSearchContext ?? activeGuideSearchContext
  const setAppliedBounds = useCallback((bounds: PublicMapBounds | null) => {
    appliedBoundsRef.current = bounds
  }, [])
  const handleViewportChange = useCallback((map: mapboxgl.Map) => {
    appliedBoundsRef.current = resolveBounds(map)
  }, [])
  const handleSetCameraTargetOrgId = useCallback((organizationId: string) => {
    setCameraTarget((current) => ({
      organizationId,
      requestId: (current?.requestId ?? 0) + 1,
    }))
  }, [setCameraTarget])
  useSyncPublicMapLayout({
    containerRef,
    mapRef,
    mapLoadedRef,
    onViewportChange: handleViewportChange,
    sidebarMode,
  })
  useSyncPublicMapAuthFavorite({
    authAction,
    authOrganizationId,
    initialPublicSlug,
    isAuthenticated: Boolean(viewer ?? initialViewer),
    router,
    searchParams,
    setFavorites,
  })
  const { authRedirectTo, handleSelectOrganization, toggleFavorite } =
    usePublicMapActions({
      organizationById,
      searchParams,
      initialPublicSlug,
      selectedOrganization,
      pendingAuthOrgId: null,
      setSelectedOrgId,
      setSidebarMode,
      setCameraTargetOrgId: handleSetCameraTargetOrgId,
      setRecentOrganizationIds,
      setFavorites,
    })
  const {
    handleBackToSearch,
    handleOpenDetails,
    handleRailSelectOrganization,
    handleOpenSameLocationGroup,
    handleSelectListItem,
    handleSelectMapMarker,
  } = usePublicMapNavigation({
    beforeProfileNavigation: flushFilterHistory,
    embedded,
    organizationById,
    handleSelectOrganization,
    mapRef,
    selectableMapItemById,
    setSameLocationSelection,
    onSameLocationSelectionChange: handleSameLocationSelectionChange,
    setSelectedListItemId,
    setSelectedOrgId,
    setSidebarMode,
  })
  useSyncPublicMapSelectedListItem({
    organizationById,
    selectableMapItemById,
    selectedListItemId,
    selectedOrgId,
    setSelectedListItemId,
    setSelectedOrgId,
  })
  useInitializePublicMap({
    enabled: mapStartupEnabled,
    setMapReady,
    token,
    tokenAvailable,
    containerRef,
    mapRef,
    mapboxRef,
    mapStartRef,
    mapLoadedRef,
    hasResolvedInitialViewportRef,
    setInitialViewportResolved,
    setMapLoadVersion,
    setMapError,
    setAppliedBounds,
    retryVersion,
    theme: mapTheme,
  })
  const { locationControl, setWeather, weather } = usePublicMapLocationWeather({
    activeSameLocationGroupKey: sameLocationSelection?.key ?? null,
    favorites,
    mapRef,
    mapLoadedRef,
    mapItems: visibleMapItems,
    mapLoadVersion,
    mapStartRef,
    markerTheme: mapTheme,
    onOpenSameLocationGroup: handleOpenSameLocationGroup,
    onSelectOrganization: handleSelectMapMarker,
    organizations: filterState.filteredOrganizations,
    selectedOrganizationId:
      selectedListItemId ?? selectedOrganization?.id ?? null,
    suppressAutomaticEntrance:
      Boolean(initialPublicSlug) || includeSeedResources,
    welcomeOpen: memberOnboardingState.isOpen,
  })
  useResolveInitialPublicMapViewport({
    mapRef,
    mapLoadedRef,
    hasResolvedInitialViewportRef,
    initialOrganization,
    preferNationalFallback: includeSeedResources && !initialPublicSlug,
    setInitialViewportResolved,
  })
  useSyncSidebarCameraPadding({
    mapRef,
    mapLoadedRef,
    initialViewportResolved,
    sidebarInsetLeft,
  })
  useFocusPublicMapCameraTarget(mapRef, cameraTarget, organizationById)
  const mapSurface = (
    <PublicMapSurface
      mapReady={mapReady}
      embedded={embedded}
      containerRef={containerRef}
      sidebarMode={sidebarMode}
      directoryFormationCounts={resolveDirectoryFormationCounts(organizations)}
      directoryCountEstimated={directory.countEstimated}
      directoryCount={resolvePublicMapDirectoryCount(
        organizations.length, totalResourceCount
      )}
      filteredItems={activeSearchContext?.items ?? filterState.filteredItems}
      filteredOrganizations={filterState.filteredOrganizations}
      selectedItemId={selectedListItemId}
      selectedOrganization={selectedOrganization}
      selectedResourceItem={selectedResourceItem}
      canManageResourceMap={canManageResourceMap}
      organizationCurationAction={organizationCurationAction}
      resourceMapCurationAction={resourceMapCurationAction}
      favorites={favorites}
      collectedResourceIds={collectedResourceIds}
      guides={resourceGuides}
      featuredGuides={featuredGuides}
      savedGuideIds={savedGuideIds}
      savedGuides={savedGuides}
      savedOrganizations={savedOrganizations}
      savedResources={savedResources}
      unresolvedCollectedResourceCount={unresolvedCollectedResourceCount}
      query={query}
      activeGroup={activeGroup}
      discoveryGroupCounts={directory.enabled ? remotePresentation.discoveryCounts : filterState.discoveryGroupCounts}
      groupCounts={directory.enabled ? remotePresentation.groupCounts : filterState.groupCounts}
      resourceItemsLoadStatus={resourceItemsLoadStatus}
      resourceItemsLoadError={resourceItemsLoadError}
      searchPending={directory.pending || deferredQuery !== query}
      searchContext={activeSearchContext}
      tokenAvailable={tokenAvailable}
      mapError={mapError}
      locationControl={locationControl}
      weather={weather?.snapshot ?? null}
      onWeatherChange={setWeather}
      preferencesSaveError={preferencesSaveError}
      authSheetOpen={authSheetOpen}
      authRedirectTo={authRedirectTo}
      onQueryChange={handleQueryChange}
      onActiveGroupChange={handleActiveGroupChange}
      onRetryResourceItems={retryResourceItems}
      onRetryMap={retryMap}
      onToggleFavorite={toggleFavorite}
      onToggleCollectedResource={toggleCollectedResource}
      onGuideSelect={handleGuideSelect}
      onToggleSavedGuide={toggleSavedGuide}
      onSelectOrganization={handleRailSelectOrganization}
      onSelectItem={handleSelectListItem}
      onOpenOrgDetails={handleOpenDetails}
      onBackToSearch={handleBackToSearch}
      onSidebarModeChange={setSidebarMode}
      onAuthSheetOpenChange={setAuthSheetOpen}
      onSidebarInsetChange={setSidebarInsetLeft}
      mapOverlay={<>{memberOnboardingState.overlay}{directory.viewportLimited ? <p className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-background/90 px-3 py-1 text-xs">Zoom in to see more places</p> : null}</>}
    />
  )
  return <PublicMapIndexChrome viewer={initialViewer} mapSurface={mapSurface} pagination={sameLocationSearchContext ? null : directory.pagination ? { ...directory.pagination, totalCount: directory.includesNonprofits ? undefined : remotePresentation.resultCount } : null} />
}
