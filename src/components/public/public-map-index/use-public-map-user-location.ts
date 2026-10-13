"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type mapboxgl from "mapbox-gl"

import {
  addMapLayerSafely,
  addMapSourceSafely,
  getMapSourceSafely,
  isMapStyleAccessError,
} from "./map-style-guards"
import {
  buildLocationFeedback,
  hasGrantedPublicMapLocation,
  hasRunPublicMapLocationEntrance,
  markPublicMapLocationGranted,
  markPublicMapLocationEntranceRun,
  normalizePublicMapUserCoordinates,
  PUBLIC_MAP_GEOLOCATION_OPTIONS,
  resolvePublicMapLocationPermissionAction,
  resolveUserLocationStatusFromError,
  type PublicMapUserCoordinates,
  type UserLocationStatus,
} from "./user-location"
import { startSpinningMapGlobe } from "./spinning-globe"

export const PUBLIC_MAP_USER_LOCATION_SOURCE_ID = "public-map-user-location"
export const PUBLIC_MAP_USER_LOCATION_HALO_LAYER_ID =
  "public-map-user-location-halo"
export const PUBLIC_MAP_USER_LOCATION_CORE_LAYER_ID =
  "public-map-user-location-core"

const PUBLIC_MAP_USER_LOCATION_ZOOM = 13

function buildUserLocationFeature(
  coordinates: PublicMapUserCoordinates
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [coordinates.longitude, coordinates.latitude],
    },
  }
}

function syncUserLocationLayers(
  map: mapboxgl.Map,
  coordinates: PublicMapUserCoordinates
) {
  const data = buildUserLocationFeature(coordinates)
  const source = getMapSourceSafely<mapboxgl.GeoJSONSource>(
    map,
    PUBLIC_MAP_USER_LOCATION_SOURCE_ID
  )

  if (isMapStyleAccessError(source)) return
  if (source) {
    source.setData(data)
  } else if (
    !addMapSourceSafely(map, PUBLIC_MAP_USER_LOCATION_SOURCE_ID, {
      type: "geojson",
      data,
    })
  ) {
    return
  }

  if (!map.getLayer(PUBLIC_MAP_USER_LOCATION_HALO_LAYER_ID)) {
    addMapLayerSafely(map, {
      id: PUBLIC_MAP_USER_LOCATION_HALO_LAYER_ID,
      type: "circle",
      source: PUBLIC_MAP_USER_LOCATION_SOURCE_ID,
      paint: {
        "circle-color": "#2563eb",
        "circle-emissive-strength": 1,
        "circle-opacity": 0.2,
        "circle-radius": 12,
      },
    })
  }

  if (!map.getLayer(PUBLIC_MAP_USER_LOCATION_CORE_LAYER_ID)) {
    addMapLayerSafely(map, {
      id: PUBLIC_MAP_USER_LOCATION_CORE_LAYER_ID,
      type: "circle",
      source: PUBLIC_MAP_USER_LOCATION_SOURCE_ID,
      paint: {
        "circle-color": "#2563eb",
        "circle-emissive-strength": 1,
        "circle-radius": 6,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    })
  }
}

function focusUserLocation(
  map: mapboxgl.Map,
  coordinates: PublicMapUserCoordinates
) {
  map.flyTo({
    center: [coordinates.longitude, coordinates.latitude],
    zoom: Math.max(map.getZoom(), PUBLIC_MAP_USER_LOCATION_ZOOM),
    duration: 900,
    essential: false,
  })
}

export function usePublicMapUserLocation({
  mapRef,
  mapLoadedRef,
  mapLoadVersion,
  onRequestMapStart,
  suppressAutomaticEntrance,
  welcomeOpen,
}: {
  mapRef: RefObject<mapboxgl.Map | null>
  mapLoadedRef: RefObject<boolean>
  mapLoadVersion: number
  onRequestMapStart: () => void
  suppressAutomaticEntrance: boolean
  welcomeOpen: boolean
}) {
  const [status, setStatus] = useState<UserLocationStatus>("idle")
  const [coordinates, setCoordinates] =
    useState<PublicMapUserCoordinates | null>(null)
  const [hasGrantedLocation, setHasGrantedLocation] = useState(false)
  const [controlOpen, setControlOpen] = useState(false)
  const requestSequenceRef = useRef(0)
  const shouldFocusLocationRef = useRef(false)
  const userMovedMapRef = useRef(false)

  useEffect(() => {
    if (
      suppressAutomaticEntrance ||
      welcomeOpen ||
      typeof window === "undefined"
    ) {
      setControlOpen(false)
      return
    }

    const storedGrant = hasGrantedPublicMapLocation(window.sessionStorage)
    setHasGrantedLocation(storedGrant)
    if (storedGrant) setControlOpen(false)
  }, [suppressAutomaticEntrance, welcomeOpen])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    const markUserMovement = (event: mapboxgl.MapEventOf<"movestart">) => {
      if (event.originalEvent) userMovedMapRef.current = true
    }
    map.on("movestart", markUserMovement)
    return () => {
      map.off("movestart", markUserMovement)
    }
  }, [mapLoadVersion, mapLoadedRef, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || typeof window === "undefined") return
    const screen = map.getContainer().closest("[data-public-map-screen]")
    let screenVisible = !screen
    const isMapActive = () => screenVisible && screen?.getAttribute("data-public-map-screen-mode") !== "content"
    const canSpin = !coordinates && !hasGrantedLocation && !suppressAutomaticEntrance && !welcomeOpen && !userMovedMapRef.current
    const rotation = canSpin ? startSpinningMapGlobe({
      map,
      onUserMovement: () => { userMovedMapRef.current = true },
      shouldRotate: () => isMapActive() && !userMovedMapRef.current,
      stopOnUserMovement: true,
    }) : null
    const syncActivity = () => {
      if (isMapActive()) rotation?.refresh()
      else map.stop()
    }
    const observer = screen ? new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === screenVisible) return
      screenVisible = entry.isIntersecting
      syncActivity()
    }, { root: screen.closest<HTMLElement>("[data-public-home-scroll], main"), rootMargin: "-64px 0px 0px 0px" }) : null
    const modeObserver = screen ? new MutationObserver(syncActivity) : null
    if (screen) {
      observer?.observe(screen)
      modeObserver?.observe(screen, { attributes: true, attributeFilter: ["data-public-map-screen-mode"] })
    }
    if (screen?.getAttribute("data-public-map-screen-mode") === "content") map.stop()
    return () => {
      observer?.disconnect()
      modeObserver?.disconnect()
      rotation?.stop()
    }
  }, [
    coordinates,
    hasGrantedLocation,
    mapLoadVersion,
    mapLoadedRef,
    mapRef,
    suppressAutomaticEntrance,
    welcomeOpen,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || !coordinates) return
    syncUserLocationLayers(map, coordinates)
    if (shouldFocusLocationRef.current) {
      shouldFocusLocationRef.current = false
      focusUserLocation(map, coordinates)
    }
  }, [coordinates, mapLoadVersion, mapLoadedRef, mapRef])

  useEffect(
    () => () => {
      requestSequenceRef.current += 1
    },
    []
  )

  const requestPosition = useCallback((source: "entrance" | "manual") => {
    if (
      typeof window === "undefined" ||
      window.isSecureContext === false ||
      !("geolocation" in window.navigator)
    ) {
      setStatus("unavailable")
      setControlOpen(true)
      return
    }

    const requestSequence = requestSequenceRef.current + 1
    requestSequenceRef.current = requestSequence
    setStatus("requesting")

    function readPosition(attempt: number) {
      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestSequenceRef.current !== requestSequence) return
          const nextCoordinates = normalizePublicMapUserCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          if (!nextCoordinates) {
            setStatus("error")
            setControlOpen(true)
            return
          }

          shouldFocusLocationRef.current =
            source === "manual" || !userMovedMapRef.current
          markPublicMapLocationGranted(window.sessionStorage)
          setHasGrantedLocation(true)
          setCoordinates(nextCoordinates)
          setStatus("centered")
          setControlOpen(false)
        },
        (error) => {
          if (requestSequenceRef.current !== requestSequence) return
          if (source === "entrance" && attempt === 0 && error.code === 2) {
            readPosition(1)
            return
          }
          setStatus(resolveUserLocationStatusFromError(error))
          setControlOpen(true)
        },
        PUBLIC_MAP_GEOLOCATION_OPTIONS
      )
    }

    readPosition(0)
  }, [])

  useEffect(() => {
    if (
      suppressAutomaticEntrance ||
      welcomeOpen ||
      typeof window === "undefined"
    ) {
      return
    }

    const storedGrant = hasGrantedPublicMapLocation(window.sessionStorage)
    if (storedGrant) {
      setHasGrantedLocation(true)
      setControlOpen(false)
    } else if (!hasRunPublicMapLocationEntrance(window.sessionStorage)) {
      markPublicMapLocationEntranceRun(window.sessionStorage)
    }

    if (
      window.isSecureContext === false ||
      !("geolocation" in window.navigator)
    ) {
      setStatus("unavailable")
      setControlOpen(!storedGrant)
      return
    }

    if (!("permissions" in window.navigator)) {
      if (storedGrant) {
        requestPosition("entrance")
        return
      }
      setStatus("prompt")
      setControlOpen(true)
      return
    }

    let cancelled = false
    setStatus("checking")
    void window.navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (cancelled) return
        const action = resolvePublicMapLocationPermissionAction(
          permission.state
        )
        if (action === "request") {
          requestPosition("entrance")
          return
        }
        setStatus(action)
        setControlOpen(!storedGrant)
      })
      .catch(() => {
        if (cancelled) return
        if (storedGrant) {
          requestPosition("entrance")
          return
        }
        setStatus("prompt")
        setControlOpen(true)
      })

    return () => {
      cancelled = true
    }
  }, [requestPosition, suppressAutomaticEntrance, welcomeOpen])

  useEffect(() => {
    if (suppressAutomaticEntrance || welcomeOpen) {
      setControlOpen(false)
      return
    }
    if (coordinates || hasGrantedLocation) {
      setControlOpen(false)
    }
  }, [coordinates, hasGrantedLocation, suppressAutomaticEntrance, welcomeOpen])

  const handleControlClick = useCallback(() => {
    const map = mapRef.current
    if (coordinates && map) {
      focusUserLocation(map, coordinates)
      setStatus("centered")
      setControlOpen(false)
      return
    }
    setControlOpen(true)
    if (status === "idle" || status === "checking") setStatus("prompt")
  }, [coordinates, mapRef, status])

  const handleConfirm = useCallback(() => {
    onRequestMapStart()
    requestPosition("manual")
  }, [onRequestMapStart, requestPosition])

  return {
    active: coordinates !== null,
    coordinates,
    controlOpen,
    feedback: buildLocationFeedback(status),
    onConfirm: handleConfirm,
    onControlClick: handleControlClick,
    onOpenChange: setControlOpen,
    status,
  }
}
