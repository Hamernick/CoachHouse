import type mapboxgl from "mapbox-gl"
import {
  PUBLIC_MAP_MARKER_IMAGE_FALLBACK_KEY,
  PUBLIC_MAP_MARKER_IMAGE_SELECTED_FALLBACK_KEY,
} from "@/lib/public-map/public-map-geojson"

export const PUBLIC_MAP_LABEL_FONT = [
  "Open Sans Semibold",
  "Arial Unicode MS Bold",
]
export const PUBLIC_MAP_MARKER_ICON_EXPRESSION = [
  "coalesce",
  ["image", ["get", "markerImageKey"]],
  ["image", PUBLIC_MAP_MARKER_IMAGE_FALLBACK_KEY],
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_SELECTED_MARKER_ICON_EXPRESSION = [
  "coalesce",
  ["image", ["concat", ["get", "markerImageKey"], "-selected"]],
  ["image", PUBLIC_MAP_MARKER_IMAGE_SELECTED_FALLBACK_KEY],
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_MARKER_LABEL_EXPRESSION = [
  "coalesce",
  ["get", "designation"],
  ["get", "name"],
  "",
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_MARKER_SORT_KEY_EXPRESSION = [
  "get",
  "markerSortKey",
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_MARKER_LABEL_SIZE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  10,
  8,
  11,
  12,
  11.5,
  16,
  12,
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_MARKER_ICON_SIZE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  1.25,
  8,
  1.34,
  11,
  1.42,
  14,
  1.5,
  16,
  1.56,
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_MARKER_OVERVIEW_TEXT_OPACITY = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3.5,
  0,
  5.5,
  1,
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_SELECTED_MARKER_ICON_SIZE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  1.55,
  8,
  1.65,
  11,
  1.75,
  14,
  1.85,
  16,
  1.95,
] as mapboxgl.ExpressionSpecification
export const PUBLIC_MAP_MARKER_ICON_OFFSET: [number, number] = [0, 8.5]
export const PUBLIC_MAP_SELECTED_MARKER_ICON_OFFSET: [number, number] = [0, 9.5]
