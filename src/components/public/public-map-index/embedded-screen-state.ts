"use client"

import type { PublicMapSurfaceProps } from "./map-surface"

export function resolvePublicMapScreenMode({
  embedded, detailsOpen,
}: {
  embedded: boolean
  detailsOpen: boolean
}): "map" | "detail" {
  return embedded && detailsOpen ? "detail" : "map"
}

export function usePublicMapEmbeddedScreen(surface: PublicMapSurfaceProps) {
  const selected = surface.selectedOrganization ?? surface.selectedResourceItem ?? null
  const detailsOpen = surface.sidebarMode === "details" && Boolean(selected)
  const mode = resolvePublicMapScreenMode({
    embedded: Boolean(surface.embedded), detailsOpen,
  })
  // Categories and guides share the adjacent results panel. Keep one map alive.
  return { mode, detailsOpen, mapHidden: mode === "detail" }
}

export type PublicMapEmbeddedScreenState = ReturnType<typeof usePublicMapEmbeddedScreen>
