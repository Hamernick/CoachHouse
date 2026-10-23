"use client"

import { useEffect, useRef, type RefObject } from "react"
import type mapboxgl from "mapbox-gl"

import {
  buildPublicMapDataVersion,
  buildPublicMapItemDataVersion,
  buildPublicMapItemPointFeatures,
  buildPublicMapPointFeatures,
} from "@/lib/public-map/public-map-geojson"
import { registerPublicMapPinStyleImageMissingHandler } from "@/lib/public-map/public-map-pin-marker-images"
import type { PublicMapSameLocationSelection } from "@/lib/public-map/public-map-same-location"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"
import type { PublicMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  buildPublicMapMarkerRelevance,
  resolvePublicMapMarkerRelevanceTier,
} from "@/lib/public-map/public-map-marker-relevance"

import { syncPublicMapMarkerSelection } from "./map-marker-layer-contracts"
import {
  PUBLIC_MAP_MARKER_LAYER_ID,
  PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
  PUBLIC_MAP_SAVED_MARKER_LAYER_ID,
  PUBLIC_MAP_SELECTED_MARKER_LAYER_ID,
} from "./map-view-helpers"
import {
  bindPublicMapMarkerPointerCursor,
  resolvePublicMapMarkerClickAction,
} from "./public-map-marker-runtime"
import { syncPublicMapMarkerArtwork } from "./sync-public-map-marker-artwork"

const PUBLIC_MAP_INTERACTIVE_MARKER_LAYER_IDS = [
  PUBLIC_MAP_MARKER_LAYER_ID,
  PUBLIC_MAP_SAVED_MARKER_LAYER_ID,
  PUBLIC_MAP_SELECTED_MARKER_LAYER_ID,
] as const

function resolveFeatureProperties(event: mapboxgl.MapLayerMouseEvent) {
  return (event.features?.[0]?.properties ?? {}) as Record<string, unknown>
}

function installPublicMapDebugProbe(map: mapboxgl.Map) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return () => {}
  }

  const debug = {
    getSource: () => map.getSource(PUBLIC_MAP_ORGANIZATION_SOURCE_ID),
    getLayers: () =>
      PUBLIC_MAP_INTERACTIVE_MARKER_LAYER_IDS.map((layerId) =>
        map.getLayer(layerId)
      ),
    getFeatures: () =>
      map.queryRenderedFeatures({
        layers: [...PUBLIC_MAP_INTERACTIVE_MARKER_LAYER_IDS],
      }),
    getImages: () => map.listImages(),
    getZoom: () => map.getZoom(),
    setZoom: (zoom: number) => {
      map.setZoom(zoom)
    },
    setViewport: ({ latitude, longitude, zoom }) => {
      map.jumpTo({ center: [longitude, latitude], zoom })
    },
  } satisfies NonNullable<Window["__MAP_DEBUG__"]>

  window.__MAP_DEBUG__ = debug
  return () => {
    if (window.__MAP_DEBUG__ === debug) {
      delete window.__MAP_DEBUG__
    }
  }
}

export function usePublicMapMarkers({
  activeSameLocationGroupKey,
  boostCoolingCenters = false,
  favorites,
  mapItems,
  mapLoadedRef,
  mapLoadVersion,
  mapRef,
  markerTheme = "light",
  onOpenSameLocationGroup,
  onSelectOrganization,
  organizations,
  selectedOrganizationId,
  userCoordinates,
}: {
  activeSameLocationGroupKey: string | null
  boostCoolingCenters?: boolean
  favorites: string[]
  mapItems?: PublicMapItem[]
  mapLoadedRef: RefObject<boolean>
  mapLoadVersion: number
  mapRef: RefObject<mapboxgl.Map | null>
  markerTheme?: PublicMapTheme
  onOpenSameLocationGroup: (group: PublicMapSameLocationSelection) => void
  onSelectOrganization: (organizationId: string) => void
  organizations: PublicMapOrganization[]
  selectedOrganizationId: string | null
  userCoordinates: { latitude: number; longitude: number } | null
}) {
  const resolvedMapItems = mapItems ?? []
  const organizationsRef = useRef(organizations)
  const mapItemsRef = useRef(resolvedMapItems)
  const activeSameLocationGroupKeyRef = useRef(activeSameLocationGroupKey)
  const onOpenSameLocationGroupRef = useRef(onOpenSameLocationGroup)
  const onSelectOrganizationRef = useRef(onSelectOrganization)
  const selectedOrganizationIdRef = useRef(selectedOrganizationId)
  const favoritesRef = useRef(favorites)
  const userCoordinatesRef = useRef(userCoordinates)
  const boostCoolingCentersRef = useRef(boostCoolingCenters)
  const shouldUseMapItems = resolvedMapItems.length > 0
  const sourceDataVersion = shouldUseMapItems
    ? buildPublicMapItemDataVersion(resolvedMapItems, { markerTheme })
    : buildPublicMapDataVersion(organizations, { markerTheme })
  const markerDataVersion = [
    sourceDataVersion,
    [...favorites].sort().join(","),
    userCoordinates
      ? `${userCoordinates.longitude.toFixed(5)}:${userCoordinates.latitude.toFixed(5)}`
      : "no-user-location",
    boostCoolingCenters ? "heat-active" : "heat-inactive",
  ].join("|relevance:")

  organizationsRef.current = organizations
  mapItemsRef.current = resolvedMapItems
  activeSameLocationGroupKeyRef.current = activeSameLocationGroupKey
  onOpenSameLocationGroupRef.current = onOpenSameLocationGroup
  onSelectOrganizationRef.current = onSelectOrganization
  selectedOrganizationIdRef.current = selectedOrganizationId
  favoritesRef.current = favorites
  userCoordinatesRef.current = userCoordinates
  boostCoolingCentersRef.current = boostCoolingCenters

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    syncPublicMapMarkerSelection({
      declutter: true,
      activeSameLocationGroupKey,
      map,
      maxRelevanceTier: resolvePublicMapMarkerRelevanceTier(map.getZoom()),
      selectedOrganizationId,
    })
  }, [activeSameLocationGroupKey, mapLoadedRef, mapRef, selectedOrganizationId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    const currentMapItems = mapItemsRef.current
    const rawPointFeatures =
      currentMapItems.length > 0
        ? buildPublicMapItemPointFeatures(currentMapItems, { markerTheme })
        : buildPublicMapPointFeatures(organizationsRef.current, {
            markerTheme,
          })
    const pointFeatures = buildPublicMapMarkerRelevance({
      boostCoolingCenters: boostCoolingCentersRef.current,
      favoriteOrganizationIds: new Set(favoritesRef.current),
      features: rawPointFeatures,
      userCoordinates: userCoordinatesRef.current,
    })
    const syncMarkers = () => {
      const maxRelevanceTier = resolvePublicMapMarkerRelevanceTier(
        map.getZoom()
      )
      const { profileImageLoads } = syncPublicMapMarkerArtwork({
        declutter: true,
        activeSameLocationGroupKey: activeSameLocationGroupKeyRef.current,
        features: pointFeatures,
        map,
        maxRelevanceTier,
        selectedOrganizationId: selectedOrganizationIdRef.current,
        theme: markerTheme,
      })
      void Promise.all(profileImageLoads)
    }

    const syncMarkerRelevance = () => {
      syncPublicMapMarkerSelection({
        declutter: true,
        activeSameLocationGroupKey: activeSameLocationGroupKeyRef.current,
        map,
        maxRelevanceTier: resolvePublicMapMarkerRelevanceTier(map.getZoom()),
        selectedOrganizationId: selectedOrganizationIdRef.current,
      })
    }

    const handleMarkerClick = (event: mapboxgl.MapLayerMouseEvent) => {
      const action = resolvePublicMapMarkerClickAction(
        resolveFeatureProperties(event)
      )
      if (!action) return
      if (action.type === "same-location") {
        onOpenSameLocationGroupRef.current(action.group)
        return
      }
      onSelectOrganizationRef.current(action.organizationId)
    }

    syncMarkers()
    const uninstallDebugProbe = installPublicMapDebugProbe(map)
    const stopStyleImageMissing = registerPublicMapPinStyleImageMissingHandler({
      map,
      theme: markerTheme,
    })
    const stopPointerCursor = bindPublicMapMarkerPointerCursor({
      layerIds: PUBLIC_MAP_INTERACTIVE_MARKER_LAYER_IDS,
      map,
    })

    map.on("style.load", syncMarkers)
    map.on("zoomend", syncMarkerRelevance)
    for (const layerId of PUBLIC_MAP_INTERACTIVE_MARKER_LAYER_IDS) {
      map.on("click", layerId, handleMarkerClick)
    }

    return () => {
      map.off("style.load", syncMarkers)
      map.off("zoomend", syncMarkerRelevance)
      for (const layerId of PUBLIC_MAP_INTERACTIVE_MARKER_LAYER_IDS) {
        map.off("click", layerId, handleMarkerClick)
      }
      uninstallDebugProbe()
      stopStyleImageMissing()
      stopPointerCursor()
    }
  }, [mapLoadedRef, mapLoadVersion, mapRef, markerDataVersion, markerTheme])
}
