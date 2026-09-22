"use client"

import type { RefObject } from "react"
import type mapboxgl from "mapbox-gl"

import type { FindMapWeatherResponse } from "@/features/find-map/client"
import type { PublicMapSameLocationSelection } from "@/lib/public-map/public-map-same-location"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"
import type { PublicMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

import { usePublicMapMarkers } from "./use-public-map-markers"
import { usePublicMapUserLocation } from "./use-public-map-user-location"

export function usePublicMapLocationWeather({
  activeSameLocationGroupKey,
  favorites,
  mapItems,
  mapLoadedRef,
  mapLoadVersion,
  mapRef,
  mapStartRef,
  markerTheme,
  onOpenSameLocationGroup,
  onSelectOrganization,
  organizations,
  selectedOrganizationId,
  suppressAutomaticEntrance,
  welcomeOpen,
  weather,
}: {
  activeSameLocationGroupKey: string | null
  favorites: string[]
  mapItems: PublicMapItem[]
  mapLoadedRef: RefObject<boolean>
  mapLoadVersion: number
  mapRef: RefObject<mapboxgl.Map | null>
  mapStartRef: RefObject<(() => void) | null>
  markerTheme: PublicMapTheme
  onOpenSameLocationGroup: (group: PublicMapSameLocationSelection) => void
  onSelectOrganization: (organizationId: string) => void
  organizations: PublicMapOrganization[]
  selectedOrganizationId: string | null
  suppressAutomaticEntrance: boolean
  welcomeOpen: boolean
  weather: FindMapWeatherResponse | null
}) {
  const locationControl = usePublicMapUserLocation({
    mapRef,
    mapLoadedRef,
    mapLoadVersion,
    onRequestMapStart: () => mapStartRef.current?.(),
    suppressAutomaticEntrance,
    welcomeOpen,
  })

  usePublicMapMarkers({
    activeSameLocationGroupKey,
    boostCoolingCenters:
      weather?.signal === "official_alert" ||
      weather?.signal === "forecast_threshold",
    favorites,
    mapItems,
    mapLoadedRef,
    mapLoadVersion,
    mapRef,
    markerTheme,
    onOpenSameLocationGroup,
    onSelectOrganization,
    organizations,
    selectedOrganizationId,
    userCoordinates: locationControl.coordinates,
  })

  return { locationControl }
}
