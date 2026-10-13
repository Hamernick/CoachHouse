"use client"

import { ResourceDirectoryPaginationProvider, type ResourceDirectoryPagination } from "@/features/find-resource-index/client"

import { PublicMapDockViewerContext } from "./dock-viewer"
import type { PublicMapIndexProps } from "./public-map-index-types"

import type { ReactNode } from "react"

export function PublicMapIndexChrome({
  mapSurface,
  viewer = null,
  pagination = null,
}: {
  mapSurface: ReactNode
  viewer?: PublicMapIndexProps["viewer"]
  pagination?: ResourceDirectoryPagination | null
}) {
  return <PublicMapDockViewerContext.Provider value={viewer}><ResourceDirectoryPaginationProvider value={pagination}>{mapSurface}</ResourceDirectoryPaginationProvider></PublicMapDockViewerContext.Provider>
}
