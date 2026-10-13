import { resolvePublicMapBasemapConfig, resolvePublicMapStyleForTheme } from "./constants"
import { FALLBACK_CENTER, FALLBACK_ZOOM } from "./map-view-helpers"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"

// Shared by the front-page map and its compact Workspace preview.
export function publicMapViewOptions(theme: PublicMapTheme) {
  return {
    style: resolvePublicMapStyleForTheme(theme),
    config: { basemap: resolvePublicMapBasemapConfig(theme) },
    center: FALLBACK_CENTER,
    zoom: FALLBACK_ZOOM,
    projection: "globe" as const,
  }
}
