"use client"

import { useEffect, useState, type RefObject } from "react"
import type mapboxgl from "mapbox-gl"
import { resourceMapScreenBounds, resolveResourceMapQueryBounds } from "../lib/map-bounds"

export function useResourceMapBounds(mapRef: RefObject<mapboxgl.Map | null>, mapLoadVersion: number) {
  const [bounds, setBounds] = useState<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      const box = map.getBounds()
      if (!box) return
      const container = map.getContainer()
      const screen = container.closest("[data-public-map-screen]")
      const value = resolveResourceMapQueryBounds(
        map.getProjection().name,
        [box.getWest(), box.getSouth(), box.getEast(), box.getNorth()],
        screen ? () => resourceMapScreenBounds(screen.getBoundingClientRect(), container.getBoundingClientRect(), (point) => map.unproject(point)) : null,
        map.getZoom()
      )
      setBounds((current) => current === value ? current : value)
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 250) }
    update()
    map.on("moveend", schedule)
    map.on("resize", schedule)
    return () => { clearTimeout(timer); map.off("moveend", schedule); map.off("resize", schedule) }
  }, [mapRef, mapLoadVersion])
  return bounds
}
