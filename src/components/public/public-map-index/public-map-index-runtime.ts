"use client"

import { useEffect, useRef, type RefObject } from "react"
import type mapboxgl from "mapbox-gl"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"
import {
  applyPublicMapBasemapConfig,
  applyPublicMapSpaceFog,
} from "./constants"
import { publicMapViewOptions } from "./map-view-options"
import { organizationHasMapLocation, type PublicMapBounds } from "./helpers"
import { observePublicMapContainer, resolveMapBounds } from "./layout-sync"
import { resolvePublicMapScreenPadding } from "./screen-camera"
import {
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  focusOrganizationOnMap,
  resolvePublicMapCameraPadding,
} from "./map-view-helpers"
import {
  isRecoverablePublicMapTileError,
  resolvePublicMapRuntimeErrorMessage,
} from "./public-map-runtime-errors"

export type PublicMapMapboxApi = (typeof import("mapbox-gl"))["default"]
export { isRecoverablePublicMapTileError } from "./public-map-runtime-errors"

function applyPublicMapGlobePresentation(map: mapboxgl.Map) {
  map.setProjection("globe")
  applyPublicMapSpaceFog(map)
  if (typeof map.setRenderWorldCopies === "function") {
    map.setRenderWorldCopies(false)
  }
}

export function useSyncSelectedOrganization({
  organizationById,
  selectedOrgId,
  setSelectedOrgId,
}: {
  organizationById: Map<string, PublicMapOrganization>
  selectedOrgId: string | null
  setSelectedOrgId: (value: string | null) => void
}) {
  useEffect(() => {
    const syncedSelectedOrgId = resolveSyncedPublicMapSelectedOrgId({
      organizationById,
      selectedOrgId,
    })

    if (syncedSelectedOrgId !== selectedOrgId) {
      setSelectedOrgId(null)
    }
  }, [organizationById, selectedOrgId, setSelectedOrgId])
}

export function resolvePublicMapSelectedOrganization({
  organizationById,
  selectedOrgId,
}: {
  organizationById: Map<string, PublicMapOrganization>
  selectedOrgId: string | null
}) {
  return selectedOrgId ? (organizationById.get(selectedOrgId) ?? null) : null
}

export function resolveSyncedPublicMapSelectedOrgId({
  organizationById,
  selectedOrgId,
}: {
  organizationById: Map<string, PublicMapOrganization>
  selectedOrgId: string | null
}) {
  if (!selectedOrgId) return null
  return organizationById.has(selectedOrgId) ? selectedOrgId : null
}

export function useSyncSidebarCameraPadding({
  mapRef,
  mapLoadedRef,
  initialViewportResolved,
  sidebarInsetLeft,
}: {
  mapRef: RefObject<mapboxgl.Map | null>
  mapLoadedRef: RefObject<boolean>
  initialViewportResolved: boolean
  sidebarInsetLeft: number
}) {
  const hasAppliedInitialPaddingRef = useRef(false)
  const lastMapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || !initialViewportResolved) return

    if (lastMapRef.current !== map) {
      lastMapRef.current = map
      hasAppliedInitialPaddingRef.current = false
    }

    const duration = hasAppliedInitialPaddingRef.current ? 320 : 0
    hasAppliedInitialPaddingRef.current = true

    const frame = requestAnimationFrame(() => {
      if (mapRef.current !== map) return
      map.easeTo({
        padding: resolvePublicMapScreenPadding(map.getContainer?.()) ?? resolvePublicMapCameraPadding(sidebarInsetLeft),
        duration,
        essential: true,
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [initialViewportResolved, mapLoadedRef, mapRef, sidebarInsetLeft])
}

function markInitialViewportResolved({
  hasResolvedInitialViewportRef,
  setInitialViewportResolved,
}: {
  hasResolvedInitialViewportRef: RefObject<boolean>
  setInitialViewportResolved: (resolved: boolean) => void
}) {
  hasResolvedInitialViewportRef.current = true
  setInitialViewportResolved(true)
}

export function useResolveInitialPublicMapViewport({
  mapRef,
  mapLoadedRef,
  hasResolvedInitialViewportRef,
  initialOrganization,
  preferNationalFallback = false,
  setInitialViewportResolved,
}: {
  mapRef: RefObject<mapboxgl.Map | null>
  mapLoadedRef: RefObject<boolean>
  hasResolvedInitialViewportRef: RefObject<boolean>
  initialOrganization: PublicMapOrganization | null
  preferNationalFallback?: boolean
  setInitialViewportResolved: (resolved: boolean) => void
}) {
  useEffect(() => {
    const map = mapRef.current
    if (
      !map ||
      !mapLoadedRef.current ||
      hasResolvedInitialViewportRef.current
    ) {
      return
    }

    if (
      initialOrganization &&
      organizationHasMapLocation(initialOrganization)
    ) {
      focusOrganizationOnMap({ map, organization: initialOrganization })
      markInitialViewportResolved({
        hasResolvedInitialViewportRef,
        setInitialViewportResolved,
      })
      return
    }

    if (preferNationalFallback) {
      map.easeTo({
        center: FALLBACK_CENTER,
        zoom: FALLBACK_ZOOM,
        duration: 0,
      })
      markInitialViewportResolved({
        hasResolvedInitialViewportRef,
        setInitialViewportResolved,
      })
      return
    }

    markInitialViewportResolved({
      hasResolvedInitialViewportRef,
      setInitialViewportResolved,
    })
  }, [
    hasResolvedInitialViewportRef,
    initialOrganization,
    mapLoadedRef,
    mapRef,
    preferNationalFallback,
    setInitialViewportResolved,
  ])
}

export function useInitializePublicMap({
  enabled = true,
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
  theme,
}: {
  enabled?: boolean
  setMapReady: (ready: boolean) => void
  token: string
  tokenAvailable: boolean
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<mapboxgl.Map | null>
  mapboxRef: RefObject<PublicMapMapboxApi | null>
  mapStartRef: RefObject<(() => void) | null>
  mapLoadedRef: RefObject<boolean>
  hasResolvedInitialViewportRef: RefObject<boolean>
  setInitialViewportResolved: (resolved: boolean) => void
  setMapLoadVersion: (value: number | ((current: number) => number)) => void
  setMapError: (value: string | null) => void
  setAppliedBounds: (value: PublicMapBounds | null) => void
  retryVersion: number
  theme: PublicMapTheme
}) {
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return
    applyPublicMapBasemapConfig(map, theme)
  }, [mapLoadedRef, mapRef, theme])

  useEffect(() => {
    if (!enabled || !tokenAvailable) return
    if (!containerRef.current) return
    if (mapRef.current) return

    let cancelled = false
    let stopObservingMapContainer = () => {}
    let hasMarkedMapReady = false
    let hasScheduledMapReveal = false
    setMapReady(false)
    setInitialViewportResolved(false)

    async function initializeMap() {
      try {
        const mapboxModule = await import("mapbox-gl")
        const mapboxgl = (mapboxModule.default ??
          mapboxModule) as PublicMapMapboxApi
        if (!mapboxgl?.Map) {
          throw new Error("Mapbox failed to initialize.")
        }

        mapboxgl.accessToken = token
        mapboxRef.current = mapboxgl
        if (!containerRef.current || cancelled) return

        const map = new mapboxgl.Map({
          container: containerRef.current,
          ...publicMapViewOptions(themeRef.current),
          cooperativeGestures: false,
          attributionControl: false,
        })
        mapRef.current = map
        const screenPadding = resolvePublicMapScreenPadding(containerRef.current)
        if (screenPadding) map.setPadding(screenPadding)

        if (typeof map.setRenderWorldCopies === "function") {
          map.setRenderWorldCopies(false)
        }

        map.dragRotate.disable()
        map.boxZoom.disable()
        if (typeof map.touchZoomRotate.disableRotation === "function") {
          map.touchZoomRotate.disableRotation()
        }

        const markMapReady = () => {
          if (cancelled || mapRef.current !== map) return

          if (!hasMarkedMapReady) {
            hasMarkedMapReady = true
            mapLoadedRef.current = true
            setMapLoadVersion((current) => current + 1)
          }

          requestAnimationFrame(() => {
            if (mapRef.current !== map) return
            map.resize()
            setAppliedBounds(resolveMapBounds(map))
          })
          setAppliedBounds(resolveMapBounds(map))
        }

        map.on("error", (event) => {
          if (!event?.error) return
          const errorMessage = resolvePublicMapRuntimeErrorMessage(event.error)
          if (!errorMessage) return

          console.error("Public map error:", event.error)
          setMapError(errorMessage)
        })

        map.on("style.load", () => {
          applyPublicMapBasemapConfig(map, themeRef.current)
          applyPublicMapGlobePresentation(map)
          markMapReady()
        })

        map.on("sourcedata", (event) => {
          // Wait for real basemap content, then reveal its next painted frame.
          // Full load also waits for unrelated tiles and changing directory sources.
          if (hasScheduledMapReveal || !event.coord || event.sourceDataType !== "content") return
          if (event.source?.type !== "vector" && event.source?.type !== "raster") return
          hasScheduledMapReveal = true
          map.once("render", () => {
            if (cancelled || mapRef.current !== map) return
            setMapReady(true)
          })
        })

        map.on("load", () => {
          if (cancelled || mapRef.current !== map) return
          applyPublicMapGlobePresentation(map)
          markMapReady()
          setMapReady(true)
        })

        map.on("moveend", () => {
          setAppliedBounds(resolveMapBounds(map))
        })

        stopObservingMapContainer = observePublicMapContainer({
          containerRef,
          map,
          mapRef,
          mapLoadedRef,
          onViewportChange: (activeMap) => {
            setAppliedBounds(resolveMapBounds(activeMap))
          },
        })
      } catch (error) {
        console.error("Public map init error:", error)
        setMapError(
          "Mapbox couldn't start. Check your token and domain restrictions."
        )
      }
    }

    let initializationStarted = false
    const startMap = () => {
      if (cancelled || initializationStarted) return
      initializationStarted = true
      void initializeMap()
    }
    mapStartRef.current = startMap
    startMap()

    return () => {
      cancelled = true
      if (mapStartRef.current === startMap) mapStartRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      stopObservingMapContainer()
      mapLoadedRef.current = false
      hasResolvedInitialViewportRef.current = false
    }
  }, [
    enabled,
    setMapReady,
    containerRef,
    hasResolvedInitialViewportRef,
    mapLoadedRef,
    mapRef,
    mapboxRef,
    mapStartRef,
    setAppliedBounds,
    setInitialViewportResolved,
    setMapLoadVersion,
    setMapError,
    token,
    tokenAvailable,
    retryVersion,
  ])
}
