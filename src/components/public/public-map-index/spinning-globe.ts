import type mapboxgl from "mapbox-gl"
import { PUBLIC_MAP_GLOBE_MAX_SPIN_ZOOM } from "@/lib/public-map/globe-settings"

export { PUBLIC_MAP_GLOBE_MAX_SPIN_ZOOM } from "@/lib/public-map/globe-settings"

export const PUBLIC_MAP_GLOBE_SECONDS_PER_REVOLUTION = 180

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

type SpinningGlobeController = {
  refresh: () => void
  stop: () => void
}

export function startSpinningMapGlobe({
  map,
  onUserMovement,
  shouldRotate = () => true,
  stopOnUserMovement = false,
}: {
  map: mapboxgl.Map
  onUserMovement?: () => void
  shouldRotate?: () => boolean
  stopOnUserMovement?: boolean
}): SpinningGlobeController {
  if (typeof window === "undefined") {
    return { refresh: () => {}, stop: () => {} }
  }

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY)
  const rotationLatitude = map.getCenter().lat
  let disposed = false
  let stoppedByUser = false

  const canRotate = () =>
    !disposed &&
    !stoppedByUser &&
    document.visibilityState !== "hidden" &&
    !reducedMotion.matches &&
    shouldRotate() &&
    map.getZoom() < PUBLIC_MAP_GLOBE_MAX_SPIN_ZOOM

  const spinGlobe = () => {
    if (!canRotate()) return

    const center = map.getCenter()
    map.easeTo({
      center: [
        center.lng - 360 / PUBLIC_MAP_GLOBE_SECONDS_PER_REVOLUTION,
        rotationLatitude,
      ],
      duration: 1_000,
      easing: (progress) => progress,
      essential: false,
    })
  }

  const handleUserMovement = (event: mapboxgl.MapEventOf<"movestart">) => {
    if (!stopOnUserMovement || !event.originalEvent) return
    stoppedByUser = true
    onUserMovement?.()
    map.stop()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      map.stop()
      return
    }
    spinGlobe()
  }

  const handleReducedMotionChange = () => {
    if (reducedMotion.matches) {
      map.stop()
      return
    }
    spinGlobe()
  }

  map.on("movestart", handleUserMovement)
  map.on("moveend", spinGlobe)
  document.addEventListener("visibilitychange", handleVisibilityChange)
  reducedMotion.addEventListener("change", handleReducedMotionChange)
  spinGlobe()

  return {
    refresh: spinGlobe,
    stop: () => {
      disposed = true
      map.off("movestart", handleUserMovement)
      map.off("moveend", spinGlobe)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      reducedMotion.removeEventListener("change", handleReducedMotionChange)
    },
  }
}
