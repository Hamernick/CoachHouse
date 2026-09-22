"use client"

import { useCallback, useDeferredValue, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
  resolveInitialPublicMapOrganization,
  resolveBounds,
  resolvePublicMapboxToken,
} from "./public-map-index/map-view-helpers"
import {
  type PublicMapMapboxApi,
  useInitializePublicMap,
  resolvePublicMapSelectedOrganization,
} from "./public-map-index/public-map-index-runtime"
import { usePublicMapCameraLifecycle } from "./public-map-index/public-map-camera-lifecycle"
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
  resolveInitialCameraTarget,
  usePublicMapIndexNavigationHandlers,
  usePublicMapListItemSelection,
  useSyncPublicMapSelectedListItem,
} from "./public-map-index/public-map-index-selection"
import {
  EMPTY_PUBLIC_MAP_RESOURCE_ITEMS,
  usePublicMapResourceItems,
} from "./public-map-index/use-resource-map-items"
import { usePublicMapResourceItemDetail } from "./public-map-index/use-resource-item-detail"
import { usePublicMapSeasonalResources, usePublicMapSeasonalSavedItems } from "./public-map-index/use-seasonal-resources"
import { usePublicMapLocationWeather } from "./public-map-index/use-public-map-location-weather"
import { resolvePublicMapDirectoryCount } from "./public-map-index/directory-status-pill"
import {
  useFocusPublicMapCameraTarget,
  useInitialSidebarMode,
  usePublicMapOnboardingState,
  useSelectedPublicMapResource,
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

function useSelectedResourceDetail(
  items: Parameters<typeof useSelectedPublicMapResource>[0],
  selectedId: string | null,
  endpoint?: string
) {
  const item = useSelectedPublicMapResource(items, selectedId)
  return usePublicMapResourceItemDetail(
    item, endpoint?.startsWith("/api/public/resource-map/index") ?? false
  )
}

export function PublicMapIndex({
  organizations,
  mapboxToken,
  initialPublicSlug,
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
  const appliedBoundsRef = useRef<PublicMapBounds | null>(null)
  const token = resolvePublicMapboxToken(mapboxToken)
  const tokenAvailable = Boolean(token)
  const { mapError, retryMap, retryVersion, setMapError } =
    usePublicMapRetryState()
  const [sidebarMode, setSidebarMode] = useInitialSidebarMode(initialPublicSlug)
  const initialOrganization = resolveInitialPublicMapOrganization({
    organizations,
    publicSlug: initialPublicSlug,
  })
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    initialOrganization?.id ?? null
  )
  const [cameraTarget, setCameraTarget] = useState(
    resolveInitialCameraTarget(initialOrganization)
  )
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [sidebarInsetLeft, setSidebarInsetLeft] = useState(0)
  const [drawerInsetBottom, setDrawerInsetBottom] = useState(0)
  const [initialViewportResolved, setInitialViewportResolved] = useState(false)
  const [mapLoadVersion, setMapLoadVersion] = useState(0)
  const [sameLocationSelection, setSameLocationSelection] =
    useState<PublicMapSameLocationSelection | null>(null)
  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(
    initialOrganization?.id ?? null
  )
  const clearMapTransientSelection = useCallback(() => {
    setSameLocationSelection(null)
    setSelectedListItemId(null)
  }, [])
  const {
    activeGroup,
    activeGuideId,
    handleActiveGroupChange,
    handleGuideChange,
    handleQueryChange,
    query,
    searchParams,
  } = usePublicMapFilterUrlState({
    onFilterChange: clearMapTransientSelection,
  })
  const {
    error: resourceItemsLoadError,
    resourceItems: sourceResourceItems,
    retry: retryResourceItems,
    status: resourceItemsLoadStatus,
    totalResourceCount,
  } = usePublicMapResourceItems({ initialResourceItems, resourceItemsEndpoint })
  const { resourceItems, showCoolingCenters, weather, setWeather } =
    usePublicMapSeasonalResources(sourceResourceItems)
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
    includeSeedResources: includeSeedResources && sourceResourceItems.length === 0,
    organizations,
    resourceItems,
  })
  const {
    activeGuideSearchContext,
    clearActiveGuide,
    handleGuideSelect,
    resourceGuides,
    visibleMapItems,
  } = usePublicMapResourceGuideState({
    activeGuideId,
    showCoolingCenters,
    filteredMapItems: filterState.filteredItems,
    organizations,
    includeSeedResources,
    resourceItems: sourceResourceItems,
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
  const {
    savedOrganizations,
    savedResources,
    toggleCollectedResource,
    unresolvedCollectedResourceCount,
  } = usePublicMapSeasonalSavedItems({
    collectedResourceIds,
    favorites,
    organizationById,
    resourceItems: sourceResourceItems,
    retainMissingResources: resourceItemsLoadStatus !== "ready",
    setCollectedResourceIds,
  }, showCoolingCenters)
  const selectableMapItemById = usePublicMapSelectableItemMap(visibleMapItems, savedResources)
  const selectedOrganization = resolvePublicMapSelectedOrganization({
    organizationById,
    selectedOrgId,
  })
  const selectedResourceItem = useSelectedResourceDetail(
    selectableMapItemById, selectedListItemId, resourceItemsEndpoint
  )
  const authAction = searchParams.get("auth_action")
  const authOrganizationId = searchParams.get("auth_org")
  const handleSameLocationSelectionChange = useCallback(
    (selection: PublicMapSameLocationSelection | null) => {
      setSameLocationSelection(selection)
      if (selection) {
        clearActiveGuide()
      }
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
  }, [])
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
  } = usePublicMapIndexNavigationHandlers({
    handleSelectOrganization,
    setSameLocationSelection,
    setSelectedListItemId,
    setSelectedOrgId,
    setSidebarMode,
  })
  const {
    handleOpenSameLocationGroup,
    handleSelectListItem,
    handleSelectMapMarker,
  } = usePublicMapListItemSelection({
    handleSelectOrganization,
    mapRef,
    selectableMapItemById,
    setSameLocationSelection: handleSameLocationSelectionChange,
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
  const { locationControl } = usePublicMapLocationWeather({
    weather,
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
  usePublicMapCameraLifecycle({
    drawerInsetBottom,
    hasResolvedInitialViewportRef,
    initialOrganization,
    initialViewportResolved,
    mapLoadedRef,
    mapLoadVersion,
    mapRef,
    preferNationalFallback: includeSeedResources && !initialPublicSlug,
    setInitialViewportResolved,
    sidebarInsetLeft,
  })
  useFocusPublicMapCameraTarget(mapRef, cameraTarget, organizationById)
  const directoryListItems =
    activeSearchContext?.items ?? filterState.filteredItems
  const mapSurface = (
    <PublicMapSurface
      containerRef={containerRef}
      sidebarMode={sidebarMode}
      directoryCount={resolvePublicMapDirectoryCount(
        organizations.length,
        totalResourceCount
      )}
      filteredItems={directoryListItems}
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
      discoveryGroupCounts={filterState.discoveryGroupCounts}
      groupCounts={filterState.groupCounts}
      resourceItemsLoadStatus={resourceItemsLoadStatus}
      resourceItemsLoadError={resourceItemsLoadError}
      searchPending={deferredQuery !== query}
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
      onDrawerInsetChange={setDrawerInsetBottom}
      welcomeControl={memberOnboardingState.welcomeControl}
      mapOverlay={memberOnboardingState.overlay}
    />
  )
  return <PublicMapIndexChrome mapSurface={mapSurface} />
}
