import type mapboxgl from "mapbox-gl"

import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { SidebarMode } from "./constants"
import { organizationHasMapLocation } from "./helpers"
import { resolvePublicMapScreenPadding } from "./screen-camera"
import { FIND_ORGANIZATION_QUERY_KEY, FIND_PATH } from "@/lib/find/routes"
import {
  buildPublicMapOrganizationFeatureCollection,
  type PublicMapFeatureCollection,
} from "@/lib/public-map/public-map-layer-api"

type MapboxApi = (typeof import("mapbox-gl"))["default"]

export const FALLBACK_CENTER: [number, number] = [-96.5, 38.4]
export const FALLBACK_ZOOM = 1.5
export const CHICAGO_FALLBACK_CENTER: [number, number] = [-87.6298, 41.8781]
export const CHICAGO_FALLBACK_ZOOM = 4.85
export const ORGANIZATION_PADDING = 120
export const PUBLIC_MAP_SIDEBAR_MAX_WIDTH = 390
export const PUBLIC_MAP_SIDEBAR_MIN_WIDTH = 220
export const PUBLIC_MAP_COMFORTABLE_RAIL_WIDTH = 360
export const PUBLIC_MAP_SIDEBAR_MIN_VISIBLE_MAP_WIDTH = 56
export const PUBLIC_MAP_CAMERA_EDGE_PADDING = 24
export const PUBLIC_MAP_ORGANIZATION_SOURCE_ID = "public-map-organizations"
export const PUBLIC_MAP_CLUSTER_SHADOW_LAYER_ID =
  "public-map-organizations-cluster-badge-shadow"
export const PUBLIC_MAP_CLUSTER_SOURCE_CLUSTER_LAYER_ID =
  "public-map-organizations-cluster-badge"
export const PUBLIC_MAP_CLUSTER_LABEL_LAYER_ID =
  "public-map-organizations-cluster-label"
export const PUBLIC_MAP_CLUSTER_SOURCE_COUNT_LAYER_ID =
  "public-map-organizations-cluster-count"
export const PUBLIC_MAP_UNCLUSTERED_SHADOW_LAYER_ID =
  "public-map-organizations-point-shadow"
export const PUBLIC_MAP_CLUSTER_SOURCE_POINT_LAYER_ID =
  "public-map-organizations-point-image"
export const PUBLIC_MAP_POINT_LABEL_LAYER_ID =
  "public-map-organizations-point-label"
export const PUBLIC_MAP_SELECTED_POINT_LABEL_LAYER_ID =
  "public-map-organizations-selected-label"
export const PUBLIC_MAP_SAME_LOCATION_COUNT_LAYER_ID =
  "public-map-organizations-same-location-count"
export const PUBLIC_MAP_SELECTED_POINT_HALO_LAYER_ID =
  "public-map-organizations-selected-halo"
export const PUBLIC_MAP_SELECTED_POINT_SHADOW_LAYER_ID =
  "public-map-organizations-selected-shadow"
export const PUBLIC_MAP_SELECTED_POINT_CORE_LAYER_ID =
  "public-map-organizations-selected-core"
export const PUBLIC_MAP_SELECTED_POINT_BADGE_LAYER_ID =
  "public-map-organizations-selected-badge"
export const PUBLIC_MAP_MARKER_LAYER_ID = "public-map-organizations-marker"
export const PUBLIC_MAP_SAVED_MARKER_LAYER_ID =
  "public-map-organizations-saved-marker"
export const PUBLIC_MAP_MARKER_LABEL_LAYER_ID =
  "public-map-organizations-marker-label"
export const PUBLIC_MAP_SELECTED_MARKER_LAYER_ID =
  "public-map-organizations-selected-marker"
export const PUBLIC_MAP_SELECTED_MARKER_LABEL_LAYER_ID =
  "public-map-organizations-selected-marker-label"
export const PUBLIC_MAP_CLUSTER_RADIUS = 50
export const PUBLIC_MAP_CLUSTER_MAX_ZOOM = 14
export const PUBLIC_MAP_FOCUS_ORGANIZATION_ZOOM = 15.1
export const ORGANIZATION_MARKER_OFFSET_Y = 0

export type PublicMapOrganizationFeatureCollection = PublicMapFeatureCollection

export type PublicMapPanelPresentation = "rail" | "drawer"

export function normalizeSlug(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function resolveInitialPublicMapOrganization({
  organizations,
  publicSlug,
}: {
  organizations: PublicMapOrganization[]
  publicSlug: string | null | undefined
}) {
  const targetSlug = normalizeSlug(publicSlug)
  if (!targetSlug) return null
  return (
    organizations.find(
      (organization) => normalizeSlug(organization.publicSlug || organization.id) === targetSlug
    ) ?? null
  )
}

export function resolvePublicMapboxToken(value: string | undefined) {
  return (value ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").trim()
}

export function buildMapHref({
  slug,
  searchParams,
}: {
  slug: string | null | undefined
  searchParams: URLSearchParams
}) {
  const nextParams = new URLSearchParams(searchParams)
  nextParams.delete(FIND_ORGANIZATION_QUERY_KEY)
  if (slug) {
    nextParams.set(FIND_ORGANIZATION_QUERY_KEY, slug)
  }
  const query = nextParams.toString()
  return query.length > 0 ? `${FIND_PATH}?${query}` : FIND_PATH
}

export function removeAuthParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams)
  next.delete("auth_action")
  next.delete("auth_org")
  next.delete("member_onboarding")
  return next
}

export { buildPublicMapOrganizationFeatureCollection }

export function resolveMarkerOrganizations(
  organizations: PublicMapOrganization[]
) {
  return organizations.filter(
    (
      organization
    ): organization is PublicMapOrganization & {
      latitude: number
      longitude: number
    } =>
      typeof organization.latitude === "number" &&
      typeof organization.longitude === "number"
  )
}

export function fitMapToOrganizations({
  map,
  mapboxgl,
  organizations,
  duration = 800,
}: {
  map: mapboxgl.Map
  mapboxgl: MapboxApi
  organizations: PublicMapOrganization[]
  duration?: number
}) {
  const markerOrganizations = resolveMarkerOrganizations(organizations)
  if (markerOrganizations.length === 0) {
    map.easeTo({
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      duration,
    })
    return
  }

  if (markerOrganizations.length === 1) {
    const only = markerOrganizations[0]
    map.flyTo({
      center: [only.longitude, only.latitude],
      zoom: PUBLIC_MAP_FOCUS_ORGANIZATION_ZOOM,
      offset: [0, ORGANIZATION_MARKER_OFFSET_Y],
      duration,
      essential: true,
    })
    return
  }

  const bounds = new mapboxgl.LngLatBounds()
  markerOrganizations.forEach((organization) => {
    bounds.extend([organization.longitude, organization.latitude])
  })
  if (bounds.isEmpty()) {
    map.easeTo({
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      duration,
    })
    return
  }

  map.fitBounds(bounds, {
    padding: resolvePublicMapScreenPadding(map.getContainer?.()) ?? ORGANIZATION_PADDING,
    maxZoom: 7,
    duration,
  })
}

export function resolvePublicMapSidebarWidth({
  surfaceWidth,
  sidebarMode,
}: {
  surfaceWidth: number
  sidebarMode: SidebarMode
}) {
  if (sidebarMode === "hidden") return 0
  if (!Number.isFinite(surfaceWidth) || surfaceWidth <= 0) {
    return PUBLIC_MAP_SIDEBAR_MAX_WIDTH
  }

  const preferredWidthRatio =
    surfaceWidth < 760
      ? 0.52
      : surfaceWidth < 980
        ? 0.48
        : surfaceWidth < 1180
          ? 0.4
          : 0.34
  const preferredWidth = Math.round(surfaceWidth * preferredWidthRatio)
  const maxWidthForViewport = Math.max(
    0,
    surfaceWidth - PUBLIC_MAP_SIDEBAR_MIN_VISIBLE_MAP_WIDTH
  )

  return Math.max(
    0,
    Math.min(
      PUBLIC_MAP_SIDEBAR_MAX_WIDTH,
      Math.max(PUBLIC_MAP_SIDEBAR_MIN_WIDTH, preferredWidth),
      maxWidthForViewport
    )
  )
}

export function resolvePublicMapPanelPresentation(
  _surfaceWidth: number
): PublicMapPanelPresentation {
  return "drawer"
}

export function focusChicagoFallback({
  map,
  duration = 800,
}: {
  map: mapboxgl.Map
  duration?: number
}) {
  map.easeTo({
    center: CHICAGO_FALLBACK_CENTER,
    zoom: CHICAGO_FALLBACK_ZOOM,
    duration,
  })
}

export function resolvePublicMapCameraPadding(sidebarInsetLeft: number) {
  const normalizedInset = Math.max(0, Math.round(sidebarInsetLeft))
  return {
    top: PUBLIC_MAP_CAMERA_EDGE_PADDING,
    right: PUBLIC_MAP_CAMERA_EDGE_PADDING,
    bottom: PUBLIC_MAP_CAMERA_EDGE_PADDING,
    left:
      normalizedInset > 0
        ? normalizedInset + PUBLIC_MAP_CAMERA_EDGE_PADDING
        : PUBLIC_MAP_CAMERA_EDGE_PADDING,
  }
}

export function focusOrganizationOnMap({
  map,
  organization,
}: {
  map: mapboxgl.Map
  organization: PublicMapOrganization & { latitude: number; longitude: number }
}) {
  map.flyTo({
    center: [organization.longitude, organization.latitude],
    zoom: PUBLIC_MAP_FOCUS_ORGANIZATION_ZOOM,
    offset: [0, ORGANIZATION_MARKER_OFFSET_Y],
    duration: 780,
    essential: true,
  })
}

export function resolveBounds(map: mapboxgl.Map) {
  const bounds = map.getBounds()
  if (!bounds) return null
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  }
}
