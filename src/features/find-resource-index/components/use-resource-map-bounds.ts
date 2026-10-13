"use client"

import { useEffect, useState, type RefObject } from "react"
import type mapboxgl from "mapbox-gl"

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
      let westEdge = box.getWest(), eastEdge = box.getEast(), southEdge = box.getSouth(), northEdge = box.getNorth()
      if (screen) {
        const frame = screen.getBoundingClientRect(), canvas = container.getBoundingClientRect()
        const northwest = map.unproject([frame.left - canvas.left, frame.top - canvas.top])
        const southeast = map.unproject([frame.right - canvas.left, frame.bottom - canvas.top])
        westEdge = northwest.lng; eastEdge = southeast.lng; northEdge = northwest.lat; southEdge = southeast.lat
      }
      const width = eastEdge - westEdge
      const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180
      const west = width >= 360 ? -180 : wrap(westEdge)
      const east = width >= 360 ? 180 : wrap(eastEdge)
      const value = [west, Math.max(-90, southEdge), east, Math.min(90, northEdge)].map((n) => n.toFixed(3)).join(",")
      setBounds((current) => current === value ? current : value)
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 250) }
    update()
    map.on("moveend", schedule)
    return () => { clearTimeout(timer); map.off("moveend", schedule) }
  }, [mapRef, mapLoadVersion])
  return bounds
}
