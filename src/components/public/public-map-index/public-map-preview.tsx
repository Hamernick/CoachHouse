"use client"

import "mapbox-gl/dist/mapbox-gl.css"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import type mapboxgl from "mapbox-gl"
import { normalizePublicMapTheme } from "@/lib/public-map/public-map-theme"
import type { PublicMapPointFeature } from "@/lib/public-map/public-map-geojson"
import { registerPublicMapPinStyleImageMissingHandler } from "@/lib/public-map/public-map-pin-marker-images"
import { applyPublicMapSpaceFog } from "./constants"
import { publicMapViewOptions } from "./map-view-options"
import { syncPublicMapMarkerArtwork } from "./sync-public-map-marker-artwork"

export function PublicMapPreview({ token }: { token?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = normalizePublicMapTheme(useTheme().resolvedTheme)
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading")

  useEffect(() => {
    if (!containerRef.current || !token?.trim().startsWith("pk.")) {
      setStatus("unavailable")
      return
    }
    let cancelled = false
    let map: mapboxgl.Map | undefined
    let observer: ResizeObserver | undefined
    let stopImageHandler = () => {}
    let features: PublicMapPointFeature[] = []
    const controller = new AbortController()
    setStatus("loading")
    const timeout = window.setTimeout(() => setStatus("unavailable"), 15_000)

    const syncMarkers = () => {
      if (!map || cancelled || !map.isStyleLoaded()) return
      const { profileImageLoads } = syncPublicMapMarkerArtwork({
        map, features, maxRelevanceTier: 3, showLabels: false, theme,
      })
      void Promise.all(profileImageLoads)
    }

    void fetch("/api/public/home-map-preview", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { features?: PublicMapPointFeature[] } | null) => {
        if (cancelled) return
        features = payload?.features ?? []
        syncMarkers()
      })
      .catch(() => {})

    void import("mapbox-gl").then((module) => {
      if (cancelled || !containerRef.current) return
      const mapbox = module.default
      map = new mapbox.Map({
        container: containerRef.current,
        accessToken: token.trim(),
        ...publicMapViewOptions(theme),
        interactive: false,
        attributionControl: false,
        renderWorldCopies: false,
        logoPosition: "bottom-left",
      })
      map.addControl(new mapbox.AttributionControl({ compact: false }), "bottom-right")
      stopImageHandler = registerPublicMapPinStyleImageMissingHandler({ map, theme })
      map.on("style.load", () => {
        if (!map || cancelled) return
        applyPublicMapSpaceFog(map)
        syncMarkers()
      })
      map.on("load", syncMarkers)
      map.on("idle", () => {
        if (cancelled || !map?.areTilesLoaded()) return
        window.clearTimeout(timeout)
        setStatus("ready")
      })
      map.on("error", () => {
        if (!cancelled && !map?.loaded()) setStatus("unavailable")
      })
      observer = new ResizeObserver(() => map?.resize())
      observer.observe(containerRef.current)
    }).catch(() => {
      if (!cancelled) setStatus("unavailable")
    })

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
      observer?.disconnect()
      stopImageHandler()
      map?.remove()
    }
  }, [theme, token])

  return (
    <figure className="absolute inset-0 m-0 overflow-hidden bg-[#05070d] [&_.mapboxgl-ctrl-attrib]:!bg-black/55 [&_.mapboxgl-ctrl-attrib]:!text-[10px] [&_.mapboxgl-ctrl-attrib_a]:!text-white/70">
      <figcaption className="sr-only">Public organizations and community resources</figcaption>
      <div ref={containerRef} className={status === "ready" ? "absolute inset-0" : "absolute inset-0 opacity-0"} />
      {status !== "ready" ? <p role="status" className="absolute inset-0 grid place-items-center text-xs text-white/70">{status === "loading" ? "Loading map…" : "Map unavailable"}</p> : null}
    </figure>
  )
}
