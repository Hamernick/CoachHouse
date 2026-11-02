"use client"

import { useEffect, useRef, useState } from "react"
import type mapboxgl from "mapbox-gl"
import { publicMapViewOptions } from "@/components/public/public-map-index/map-view-options"
import { resolvePublicMapboxToken } from "@/components/public/public-map-index/map-view-helpers"
import type { PublicMapTheme } from "@/lib/public-map/public-map-theme"
import type { LaunchGlobeLocation } from "../lib/globe-location"

export function useLaunchStreetMap(location: LaunchGlobeLocation | null, theme: PublicMapTheme, reducedMotion: boolean) {
  const container = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading")
  const [attempt, setAttempt] = useState(0)
  const latitude = location?.latitude
  const longitude = location?.longitude

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || !container.current) return
    const element = container.current
    const token = resolvePublicMapboxToken(undefined)
    if (!token) { setStatus("unavailable"); return }
    let disposed = false
    let failed = false
    let map: mapboxgl.Map | undefined
    let observer: ResizeObserver | undefined
    setStatus("loading")
    const fail = () => {
      if (disposed || failed) return
      failed = true
      window.clearTimeout(timeout)
      observer?.disconnect()
      map?.remove()
      map = undefined
      setStatus("unavailable")
    }
    const timeout = window.setTimeout(fail, 15_000)
    void import("mapbox-gl").then(({ default: mapbox }) => {
      if (disposed || failed) return
      map = new mapbox.Map({
        ...publicMapViewOptions(theme),
        container: element, accessToken: token,
        center: [longitude, latitude], zoom: reducedMotion ? 15 : 14.4,
        pitch: 35, bearing: -18, interactive: false,
        attributionControl: false, logoPosition: "top-left",
      })
      map.addControl(new mapbox.AttributionControl({ compact: true }), "bottom-right")
      map.once("idle", () => {
        if (disposed || failed || !map) return
        window.clearTimeout(timeout)
        setStatus("ready")
        if (!reducedMotion) map.easeTo({ zoom: 15, duration: 900, essential: false })
      })
      map.on("error", (event) => {
        const error = event.error as Error & { status?: number }
        if (error?.status === 401 || error?.status === 403) { window.clearTimeout(timeout); fail() }
      })
      observer = new ResizeObserver(() => map?.resize())
      observer.observe(element)
    }).catch(() => { window.clearTimeout(timeout); fail() })
    return () => {
      disposed = true
      window.clearTimeout(timeout)
      observer?.disconnect()
      map?.remove()
    }
  }, [latitude, longitude, theme, reducedMotion, attempt])

  return { container, status, retry: () => setAttempt(value => value + 1) }
}
