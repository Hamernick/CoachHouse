import type mapboxgl from "mapbox-gl"

import type { PublicMapPointFeature } from "@/lib/public-map/public-map-geojson"
import type { PublicMapMarkerRelevanceTier } from "@/lib/public-map/public-map-marker-relevance"
import {
  ensurePublicMapPinFallbackMarkerImages,
  ensurePublicMapPinMarkerImages,
} from "@/lib/public-map/public-map-pin-marker-images"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"

import {
  ensurePublicMapMarkerLayers,
  setPublicMapMarkerSourceData,
  syncPublicMapMarkerSelection,
} from "./map-marker-layer-contracts"

export function syncPublicMapMarkerArtwork({
  declutter = false,
  activeSameLocationGroupKey = null,
  features,
  map,
  maxRelevanceTier,
  selectedOrganizationId = null,
  showLabels = true,
  theme,
}: {
  declutter?: boolean
  activeSameLocationGroupKey?: string | null
  features: PublicMapPointFeature[]
  map: mapboxgl.Map
  maxRelevanceTier: PublicMapMarkerRelevanceTier
  selectedOrganizationId?: string | null
  showLabels?: boolean
  theme: PublicMapTheme
}) {
  ensurePublicMapPinFallbackMarkerImages({ map, theme })
  const profileImageLoads = ensurePublicMapPinMarkerImages({
    map,
    features,
    theme,
  })
  if (
    !ensurePublicMapMarkerLayers({
      declutter,
      map,
      maxRelevanceTier,
      showLabels,
      theme,
    })
  ) {
    return { profileImageLoads, updated: false }
  }

  const updated = setPublicMapMarkerSourceData({
    map,
    sourceData: {
      type: "FeatureCollection",
      features,
    },
  })
  if (updated) {
    syncPublicMapMarkerSelection({
      declutter,
      activeSameLocationGroupKey,
      map,
      maxRelevanceTier,
      selectedOrganizationId,
    })
  }

  return { profileImageLoads, updated }
}
