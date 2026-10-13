"use client"

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react"
import { type useRouter, type useSearchParams } from "next/navigation"
import type mapboxgl from "mapbox-gl"

import { buildMapHref, removeAuthParams, resolveBounds } from "./map-view-helpers"
import { resolvePublicMapScreenPadding } from "./screen-camera"

type PublicMapResizeSyncOptions = {
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<mapboxgl.Map | null>
  mapLoadedRef: RefObject<boolean>
  onViewportChange: (map: mapboxgl.Map) => void
  sidebarMode: "search" | "details" | "hidden"
}

type PublicMapAuthFavoriteSyncOptions = {
  authAction: string | null
  authOrganizationId: string | null
  initialPublicSlug?: string
  isAuthenticated: boolean
  router: ReturnType<typeof useRouter>
  searchParams: ReturnType<typeof useSearchParams>
  setFavorites: Dispatch<SetStateAction<string[]>>
}

export function observePublicMapContainer({
  containerRef,
  map,
  mapRef,
  mapLoadedRef,
  onViewportChange,
}: Omit<PublicMapResizeSyncOptions, "sidebarMode"> & { map: mapboxgl.Map }) {
  const resizeTarget = containerRef.current?.parentElement
  if (!resizeTarget || typeof ResizeObserver === "undefined") {
    return () => {}
  }

  let resizeFrame = 0
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      if (mapRef.current !== map) return
      map.resize()
      const screenPadding = resolvePublicMapScreenPadding(containerRef.current)
      if (screenPadding) map.setPadding(screenPadding)
      if (mapLoadedRef.current) {
        onViewportChange(map)
      }
    })
  })

  resizeObserver.observe(resizeTarget)

  return () => {
    resizeObserver.disconnect()
    cancelAnimationFrame(resizeFrame)
  }
}

export function useSyncPublicMapLayout({
  mapRef,
  mapLoadedRef,
  onViewportChange,
  sidebarMode,
}: PublicMapResizeSyncOptions) {
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const frame = requestAnimationFrame(() => {
      if (mapRef.current !== map) return
      map.resize()
      if (mapLoadedRef.current) {
        onViewportChange(map)
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [mapLoadedRef, mapRef, onViewportChange, sidebarMode])
}

export function useSyncPublicMapAuthFavorite({
  authAction,
  authOrganizationId,
  initialPublicSlug,
  isAuthenticated,
  router,
  searchParams,
  setFavorites,
}: PublicMapAuthFavoriteSyncOptions) {
  useEffect(() => {
    if (!isAuthenticated) return
    if (authAction !== "save" || !authOrganizationId) return

    setFavorites((current) => {
      if (current.includes(authOrganizationId)) return current
      return [authOrganizationId, ...current].slice(0, 120)
    })

    const nextSearchParams = removeAuthParams(new URLSearchParams(searchParams.toString()))
    const nextHref = buildMapHref({
      slug: initialPublicSlug,
      searchParams: nextSearchParams,
    })
    router.replace(nextHref, { scroll: false })
  }, [
    authAction,
    authOrganizationId,
    initialPublicSlug,
    isAuthenticated,
    router,
    searchParams,
    setFavorites,
  ])
}

export function resolveMapBounds(map: mapboxgl.Map) {
  return resolveBounds(map)
}
