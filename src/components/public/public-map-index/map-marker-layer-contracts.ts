import type mapboxgl from "mapbox-gl"

import {
  buildEmptyPublicMapFeatureCollection,
  type PublicMapFeatureCollection,
} from "@/lib/public-map/public-map-geojson"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"
import type { PublicMapMarkerRelevanceTier } from "@/lib/public-map/public-map-marker-relevance"

import {
  resolveRelevantUnselectedPointFilter,
  resolveSavedPointFilter,
  resolveSelectedPointFilter,
} from "./map-layer-filters"
import {
  addMapLayerSafely,
  addMapSourceSafely,
  getMapLayerSafely,
  getMapSourceSafely,
  isMapStyleAccessError,
  removeMapLayerSafely,
  setMapFilterSafely,
  setMapLayoutPropertySafely,
  setMapPaintPropertySafely,
} from "./map-style-guards"
import {
  PUBLIC_MAP_MARKER_LABEL_LAYER_ID,
  PUBLIC_MAP_MARKER_LAYER_ID,
  PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
  PUBLIC_MAP_SAVED_MARKER_LAYER_ID,
  PUBLIC_MAP_SELECTED_MARKER_LABEL_LAYER_ID,
  PUBLIC_MAP_SELECTED_MARKER_LAYER_ID,
} from "./map-view-helpers"

import {
  PUBLIC_MAP_LABEL_FONT,
  PUBLIC_MAP_MARKER_ICON_EXPRESSION,
  PUBLIC_MAP_SELECTED_MARKER_ICON_EXPRESSION,
  PUBLIC_MAP_MARKER_LABEL_EXPRESSION,
  PUBLIC_MAP_MARKER_SORT_KEY_EXPRESSION,
  PUBLIC_MAP_MARKER_LABEL_SIZE,
  PUBLIC_MAP_MARKER_ICON_SIZE,
  PUBLIC_MAP_MARKER_OVERVIEW_TEXT_OPACITY,
  PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE,
  PUBLIC_MAP_MARKER_ICON_OFFSET,
  PUBLIC_MAP_SELECTED_MARKER_ICON_OFFSET,
} from "./map-marker-style-contracts"
export { PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE } from "./map-marker-style-contracts"

function resolveLabelPaint(theme: PublicMapTheme) {
  return theme === "dark"
    ? {
        color: "rgba(250, 250, 250, 0.92)",
        haloBlur: 0.25,
        haloColor: "rgba(9, 9, 11, 0.92)",
        haloWidth: 1.5,
      }
    : {
        color: "rgba(15, 23, 42, 0.86)",
        haloBlur: 0.16,
        haloColor: "rgba(255, 255, 255, 0.9)",
        haloWidth: 0.7,
      }
}

function canAttachToMap(map: mapboxgl.Map) {
  try {
    return Boolean(map.getStyle())
  } catch {
    return false
  }
}

function ensureMarkerSource(map: mapboxgl.Map) {
  const source = getMapSourceSafely(map, PUBLIC_MAP_ORGANIZATION_SOURCE_ID)
  if (isMapStyleAccessError(source)) return false
  if (source) return true

  return addMapSourceSafely(map, PUBLIC_MAP_ORGANIZATION_SOURCE_ID, {
    type: "geojson",
    data: buildEmptyPublicMapFeatureCollection(),
  })
}

function ensureMarkerLayer({
  declutter,
  kind,
  map,
  maxRelevanceTier,
  showLabels,
  theme,
}: {
  declutter: boolean
  kind: "normal" | "saved" | "selected"
  map: mapboxgl.Map
  maxRelevanceTier: PublicMapMarkerRelevanceTier
  showLabels: boolean
  theme: PublicMapTheme
}) {
  const selected = kind === "selected"
  const saved = kind === "saved"
  const layerId = selected
    ? PUBLIC_MAP_SELECTED_MARKER_LAYER_ID
    : saved
      ? PUBLIC_MAP_SAVED_MARKER_LAYER_ID
      : PUBLIC_MAP_MARKER_LAYER_ID
  if (getMapLayerSafely(map, layerId)) return
  const labelPaint = resolveLabelPaint(theme)

  addMapLayerSafely(map, {
    id: layerId,
    type: "symbol",
    source: PUBLIC_MAP_ORGANIZATION_SOURCE_ID,
    filter: selected
      ? resolveSelectedPointFilter({
          selectedOrganizationId: null,
          activeSameLocationGroupKey: null,
        })
      : saved
        ? resolveSavedPointFilter({
            selectedOrganizationId: null,
            activeSameLocationGroupKey: null,
          })
        : resolveRelevantUnselectedPointFilter({
            selectedOrganizationId: null,
            activeSameLocationGroupKey: null,
            maxRelevanceTier: declutter ? 3 : maxRelevanceTier,
          }),
    layout: {
      "icon-image": selected
        ? PUBLIC_MAP_SELECTED_MARKER_ICON_EXPRESSION
        : PUBLIC_MAP_MARKER_ICON_EXPRESSION,
      "icon-size": selected
        ? PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE
        : PUBLIC_MAP_MARKER_ICON_SIZE,
      "icon-anchor": "bottom",
      "icon-offset": selected
        ? PUBLIC_MAP_SELECTED_MARKER_ICON_OFFSET
        : PUBLIC_MAP_MARKER_ICON_OFFSET,
      "icon-allow-overlap":
        !declutter || selected || saved || maxRelevanceTier === 3,
      "icon-ignore-placement":
        !declutter || selected || saved || maxRelevanceTier === 3,
      "icon-padding": 2,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
      "text-field": showLabels ? PUBLIC_MAP_MARKER_LABEL_EXPRESSION : "",
      ...(showLabels ? { "text-font": PUBLIC_MAP_LABEL_FONT } : {}),
      "text-size": PUBLIC_MAP_MARKER_LABEL_SIZE,
      "text-anchor": "top",
      "text-offset": selected ? [0, 0.52] : [0, 0.45],
      "text-max-width": 10,
      "text-padding": 2,
      "text-allow-overlap": selected,
      "text-ignore-placement": selected,
      "text-optional": true,
      "symbol-sort-key": PUBLIC_MAP_MARKER_SORT_KEY_EXPRESSION,
    },
    paint: {
      "icon-opacity": 1,
      "text-opacity":
        selected || saved ? 1 : PUBLIC_MAP_MARKER_OVERVIEW_TEXT_OPACITY,
      "text-color": labelPaint.color,
      "text-halo-color": labelPaint.haloColor,
      "text-halo-width": labelPaint.haloWidth,
      "text-halo-blur": labelPaint.haloBlur,
    },
  })
}

function refreshMarkerLayerContracts({
  declutter,
  map,
  maxRelevanceTier,
  showLabels,
  theme,
}: {
  declutter: boolean
  map: mapboxgl.Map
  maxRelevanceTier: PublicMapMarkerRelevanceTier
  showLabels: boolean
  theme: PublicMapTheme
}) {
  const paint = resolveLabelPaint(theme)
  setMapFilterSafely(
    map,
    PUBLIC_MAP_MARKER_LAYER_ID,
    resolveRelevantUnselectedPointFilter({
      activeSameLocationGroupKey: null,
      maxRelevanceTier: declutter ? 3 : maxRelevanceTier,
      selectedOrganizationId: null,
    })
  )
  setMapFilterSafely(
    map,
    PUBLIC_MAP_SAVED_MARKER_LAYER_ID,
    resolveSavedPointFilter({
      activeSameLocationGroupKey: null,
      selectedOrganizationId: null,
    })
  )
  setMapLayoutPropertySafely(
    map,
    PUBLIC_MAP_MARKER_LAYER_ID,
    "icon-anchor",
    "bottom"
  )
  setMapLayoutPropertySafely(
    map,
    PUBLIC_MAP_SELECTED_MARKER_LAYER_ID,
    "icon-anchor",
    "bottom"
  )

  for (const [layerId, kind] of [
    [PUBLIC_MAP_MARKER_LAYER_ID, "normal"],
    [PUBLIC_MAP_SAVED_MARKER_LAYER_ID, "saved"],
    [PUBLIC_MAP_SELECTED_MARKER_LAYER_ID, "selected"],
  ] as const) {
    const selected = kind === "selected"
    setMapLayoutPropertySafely(
      map,
      layerId,
      "icon-image",
      selected
        ? PUBLIC_MAP_SELECTED_MARKER_ICON_EXPRESSION
        : PUBLIC_MAP_MARKER_ICON_EXPRESSION
    )
    setMapLayoutPropertySafely(
      map,
      layerId,
      "icon-size",
      selected
        ? PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE
        : PUBLIC_MAP_MARKER_ICON_SIZE
    )
    setMapLayoutPropertySafely(
      map,
      layerId,
      "icon-allow-overlap",
      !declutter || kind !== "normal" || maxRelevanceTier === 3
    )
    setMapLayoutPropertySafely(
      map,
      layerId,
      "icon-ignore-placement",
      !declutter || kind !== "normal" || maxRelevanceTier === 3
    )
    setMapLayoutPropertySafely(
      map,
      layerId,
      "icon-offset",
      selected
        ? PUBLIC_MAP_SELECTED_MARKER_ICON_OFFSET
        : PUBLIC_MAP_MARKER_ICON_OFFSET
    )
    setMapLayoutPropertySafely(map, layerId, "icon-padding", 2)
    setMapLayoutPropertySafely(map, layerId, "icon-pitch-alignment", "viewport")
    setMapLayoutPropertySafely(
      map,
      layerId,
      "icon-rotation-alignment",
      "viewport"
    )
    setMapLayoutPropertySafely(
      map,
      layerId,
      "text-field",
      showLabels ? PUBLIC_MAP_MARKER_LABEL_EXPRESSION : ""
    )
    setMapLayoutPropertySafely(map, layerId, "text-anchor", "top")
    setMapLayoutPropertySafely(
      map,
      layerId,
      "text-offset",
      selected ? [0, 0.52] : [0, 0.45]
    )
    setMapLayoutPropertySafely(map, layerId, "text-padding", 2)
    setMapLayoutPropertySafely(map, layerId, "text-allow-overlap", selected)
    setMapLayoutPropertySafely(map, layerId, "text-ignore-placement", selected)
    setMapLayoutPropertySafely(map, layerId, "text-optional", true)
    setMapLayoutPropertySafely(
      map,
      layerId,
      "symbol-sort-key",
      PUBLIC_MAP_MARKER_SORT_KEY_EXPRESSION
    )
    setMapPaintPropertySafely(map, layerId, "text-color", paint.color)
    setMapPaintPropertySafely(
      map,
      layerId,
      "text-opacity",
      selected || kind === "saved" ? 1 : PUBLIC_MAP_MARKER_OVERVIEW_TEXT_OPACITY
    )
    setMapPaintPropertySafely(map, layerId, "text-halo-color", paint.haloColor)
    setMapPaintPropertySafely(map, layerId, "text-halo-width", paint.haloWidth)
    setMapPaintPropertySafely(map, layerId, "text-halo-blur", paint.haloBlur)
  }
}

export function ensurePublicMapMarkerLayers({
  declutter = false,
  map,
  maxRelevanceTier = 0,
  showLabels = true,
  theme = "light",
}: {
  declutter?: boolean
  map: mapboxgl.Map
  maxRelevanceTier?: PublicMapMarkerRelevanceTier
  showLabels?: boolean
  theme?: PublicMapTheme
}) {
  if (!canAttachToMap(map) || !ensureMarkerSource(map)) return false

  removeMapLayerSafely(map, PUBLIC_MAP_MARKER_LABEL_LAYER_ID)
  removeMapLayerSafely(map, PUBLIC_MAP_SELECTED_MARKER_LABEL_LAYER_ID)
  ensureMarkerLayer({
    declutter,
    kind: "normal",
    map,
    maxRelevanceTier,
    showLabels,
    theme,
  })
  ensureMarkerLayer({
    declutter,
    kind: "saved",
    map,
    maxRelevanceTier,
    showLabels,
    theme,
  })
  ensureMarkerLayer({
    declutter,
    kind: "selected",
    map,
    maxRelevanceTier,
    showLabels,
    theme,
  })
  refreshMarkerLayerContracts({
    declutter,
    map,
    maxRelevanceTier,
    showLabels,
    theme,
  })

  return [
    PUBLIC_MAP_MARKER_LAYER_ID,
    PUBLIC_MAP_SAVED_MARKER_LAYER_ID,
    PUBLIC_MAP_SELECTED_MARKER_LAYER_ID,
  ].every((layerId) => Boolean(getMapLayerSafely(map, layerId)))
}
export function setPublicMapMarkerSourceData({
  map,
  sourceData,
}: {
  map: mapboxgl.Map
  sourceData: PublicMapFeatureCollection
}) {
  const source = getMapSourceSafely<mapboxgl.GeoJSONSource>(
    map,
    PUBLIC_MAP_ORGANIZATION_SOURCE_ID
  )
  if (isMapStyleAccessError(source) || !source) return false
  source.setData(sourceData)
  return true
}
export function syncPublicMapMarkerSelection({
  declutter = false,
  activeSameLocationGroupKey,
  map,
  maxRelevanceTier,
  selectedOrganizationId,
}: {
  declutter?: boolean
  activeSameLocationGroupKey: string | null
  map: mapboxgl.Map
  maxRelevanceTier: PublicMapMarkerRelevanceTier
  selectedOrganizationId: string | null
}) {
  // Mapbox places normal pins against the actual viewport at every camera
  // movement/resize. At neighborhood detail every eligible pin is revealed.
  // Saved and selected layers always bypass this decluttering.
  setMapLayoutPropertySafely(
    map,
    PUBLIC_MAP_MARKER_LAYER_ID,
    "icon-allow-overlap",
    !declutter || maxRelevanceTier === 3
  )
  setMapLayoutPropertySafely(
    map,
    PUBLIC_MAP_MARKER_LAYER_ID,
    "icon-ignore-placement",
    !declutter || maxRelevanceTier === 3
  )
  const selectedFilter = resolveSelectedPointFilter({
    activeSameLocationGroupKey,
    selectedOrganizationId,
  })
  const relevantUnselectedFilter = resolveRelevantUnselectedPointFilter({
    activeSameLocationGroupKey,
    maxRelevanceTier: declutter ? 3 : maxRelevanceTier,
    selectedOrganizationId,
  })
  const savedFilter = resolveSavedPointFilter({
    activeSameLocationGroupKey,
    selectedOrganizationId,
  })

  setMapFilterSafely(map, PUBLIC_MAP_MARKER_LAYER_ID, relevantUnselectedFilter)
  setMapFilterSafely(map, PUBLIC_MAP_SAVED_MARKER_LAYER_ID, savedFilter)
  setMapFilterSafely(map, PUBLIC_MAP_SELECTED_MARKER_LAYER_ID, selectedFilter)
}
