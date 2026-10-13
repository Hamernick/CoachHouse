"use client"

import Image from "next/image"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import StatusIndicator from "@/components/8starlabs-ui/status-indicator"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useLaunchViewerLocation } from "../hooks/use-launch-viewer-location"
import type { LaunchGlobeLocation } from "../lib/globe-location"
import type { mountLaunchGlobe } from "./organization-launch-globe-runtime"
import fallback from "./organization-launch-globe-fallback.svg"

type GlobeProps = {
  location?: LaunchGlobeLocation | null
  onAddLocation?: () => void
  locationLabel?: string
  actionLabel?: string
  pending?: boolean
  error?: string | null
  viewerLocation?: boolean
}

export function OrganizationLaunchMap({ location = null, onAddLocation, locationLabel, useViewerLocation = false }: GlobeProps & { useViewerLocation?: boolean }) {
  if (useViewerLocation) return <ViewerLocationGlobe />
  return <LaunchGlobePreview key={`${location?.latitude}:${location?.longitude}`} location={location} onAddLocation={onAddLocation} locationLabel={locationLabel} />
}

function ViewerLocationGlobe() {
  const { location, pending, error, locate } = useLaunchViewerLocation()
  return <LaunchGlobePreview key={`${location?.latitude}:${location?.longitude}`} location={location} locationLabel="Your location · Only you" onAddLocation={locate} actionLabel="Use my location" pending={pending} error={error} viewerLocation />
}

function LaunchGlobePreview({ location = null, onAddLocation, locationLabel, actionLabel = "Add location", pending = false, error, viewerLocation = false }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<ReturnType<typeof mountLaunchGlobe> | null>(null)
  const selectedLocationRef = useRef(location)
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading")
  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return
    void import("./organization-launch-globe-runtime").then(({ mountLaunchGlobe }) => {
      if (cancelled) return
      runtimeRef.current = mountLaunchGlobe(container, () => setStatus("unavailable"), selectedLocationRef.current)
      setStatus("ready")
    }).catch(() => {
      if (!cancelled) setStatus("unavailable")
    })
    return () => { cancelled = true; runtimeRef.current?.dispose(); runtimeRef.current = null }
  }, [])
  return (
    <div className="relative mx-2 mb-2 aspect-video overflow-hidden rounded-xl bg-[#050505]" data-organization-launch-map="true">
      <Image src={fallback} alt="" fill unoptimized aria-hidden="true" className={`object-cover ${status === "loading" ? "opacity-40" : ""}`} />
      <div
        ref={containerRef}
        data-vaul-no-drag=""
        role="img"
        aria-busy={status === "loading"}
        aria-label={status === "ready" ? location ? `Globe centered on ${locationLabel || "your organization’s saved location"}` : "Globe. Drag or use arrow keys to rotate." : status === "loading" ? "Loading map" : "Map unavailable"}
        tabIndex={status === "ready" && !location ? 0 : undefined}
        className={`nodrag nopan focus-ring absolute inset-0 touch-pan-y rounded-xl ${location ? "" : "cursor-grab active:cursor-grabbing"}`}
      />
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span role="status" className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-[11px] leading-4 text-white/90">
            <LoaderCircleIcon aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
            Loading map…
          </span>
        </div>
      ) : null}
      {location && status === "ready" ? (
        <div aria-hidden="true" data-launch-location-marker="true" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <StatusIndicator state="active" size="md" className="gap-0" />
        </div>
      ) : null}
      {location ? <div className="pointer-events-none absolute top-2 right-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 text-[11px] text-white/85">
        <StatusIndicator state="active" size="sm" className="shrink-0 gap-0" />
        <span className="truncate">{locationLabel || "Org location"}</span>
      </div> : onAddLocation ? <Button type="button" variant="ghost" size="sm" data-vaul-no-drag="" onClick={onAddLocation} disabled={pending} aria-busy={pending} className="nodrag nopan absolute top-1 right-1 min-h-11 rounded-full px-3 text-[11px] bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white dark:hover:bg-zinc-800">{pending ? "Finding you…" : actionLabel}</Button> : null}
      {error ? <p role="status" className="absolute right-2 bottom-2 left-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white">{error}</p> : null}
      {status === "unavailable" ? <p role="status" className="absolute bottom-2 left-3 text-[10px] text-white/70">{location ? `${viewerLocation ? "Location found" : "Location saved"} · map unavailable` : "Map unavailable"}</p> : null}
    </div>
  )
}
