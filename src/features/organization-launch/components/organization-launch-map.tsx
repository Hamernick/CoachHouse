"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { normalizePublicMapTheme } from "@/lib/public-map/public-map-theme"
import { cn } from "@/lib/utils"
import { useLaunchStreetMap } from "../hooks/use-launch-street-map"
import type { LaunchGlobeLocation } from "../lib/globe-location"
import "mapbox-gl/dist/mapbox-gl.css"

type MapProps = {
  location?: LaunchGlobeLocation | null
  onAddLocation?: () => void
  locationLabel?: string
  organizationName?: string | null
  photoUrl?: string | null
  online?: boolean
}

export function OrganizationLaunchMap(props: MapProps) {
  const { resolvedTheme } = useTheme()
  const theme = normalizePublicMapTheme(resolvedTheme)
  const reducedMotion = Boolean(useReducedMotion())
  return (
    <div className="relative mx-2 mb-2 aspect-video overflow-hidden rounded-2xl bg-muted" data-organization-launch-map="true">
      <AnimatePresence initial={false} mode="wait">
        <motion.div key={`${props.location?.latitude}:${props.location?.longitude}:${theme}`} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
          <OrganizationLocationPreview {...props} theme={theme} reducedMotion={reducedMotion} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function OrganizationLocationPreview({ location = null, onAddLocation, locationLabel, organizationName, photoUrl, online = false, theme, reducedMotion }: MapProps & {
  theme: "light" | "dark"
  reducedMotion: boolean
}) {
  const { container, status, retry } = useLaunchStreetMap(location, theme, reducedMotion)
  const name = organizationName?.trim() || "Your organization"
  const initials = organizationName?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("")
  const ready = Boolean(location) && status === "ready"
  const subtitle = online ? "Online organization" : locationLabel || (location ? "Saved location" : "Add your organization’s location")
  return (
    <>
      <div ref={container} data-vaul-no-drag="" role="region" aria-label={location ? `Map showing ${name}’s saved location` : `${name} location`}
        aria-busy={Boolean(location) && status === "loading"}
        className={cn("nodrag nopan absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none", ready ? "opacity-100" : "opacity-0")} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/0 to-transparent" />
      <AnimatePresence>
        {ready ? <motion.div key="photo-marker" data-launch-location-marker="true" aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full"
          initial={{ opacity: 0, y: reducedMotion ? 0 : -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.9 }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 22 }}>
          <div className="flex flex-col items-center drop-shadow-lg">
            <Avatar className="size-16 border-[3px] border-background bg-background shadow-sm">
              <AvatarImage src={photoUrl || undefined} alt="" className="object-cover" />
              <AvatarFallback className="text-lg font-semibold">{initials || <MapPinIcon className="size-6" />}</AvatarFallback>
            </Avatar>
            <span className="-mt-0.5 h-3 w-1 rounded-b-full bg-background" />
            <span className="absolute -bottom-1 size-2 rounded-full bg-primary ring-4 ring-primary/15" />
          </div>
        </motion.div> : null}
      </AnimatePresence>
      {!location ? <div className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center" aria-hidden="true">
        <Avatar className="size-14 border-2 border-background">
          <AvatarImage src={photoUrl || undefined} alt="" className="object-cover" />
          <AvatarFallback>{initials || <MapPinIcon className="size-5" />}</AvatarFallback>
        </Avatar>
      </div> : null}
      <div className="pointer-events-none absolute right-12 bottom-7 left-4 flex flex-col gap-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <AnimatePresence>
        {location && status === "loading" ? <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }} className="pointer-events-none absolute inset-0 grid place-items-center">
          <span role="status" className="rounded-full bg-background/90 px-3 py-2 text-xs text-muted-foreground motion-safe:animate-pulse">Loading map…</span>
        </motion.div> : null}
      </AnimatePresence>
      {location && status === "unavailable" ? <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2 rounded-xl bg-background/90 px-3 py-2">
        <p role="status" className="text-xs text-muted-foreground">Location saved · map unavailable</p>
        <Button type="button" variant="ghost" size="sm" onClick={retry} className="nodrag nopan">Retry</Button>
      </div> : null}
      {!location && onAddLocation ? <Button type="button" variant="secondary" size="sm" data-vaul-no-drag="" onClick={onAddLocation}
        className="nodrag nopan absolute top-3 right-3 rounded-full">{online ? "Edit location" : "Add location"}</Button> : null}
    </>
  )
}
