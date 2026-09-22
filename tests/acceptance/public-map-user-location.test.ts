import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  buildLocationFeedback,
  hasGrantedPublicMapLocation,
  hasRunPublicMapLocationEntrance,
  markPublicMapLocationGranted,
  markPublicMapLocationEntranceRun,
  normalizePublicMapUserCoordinates,
  PUBLIC_MAP_GEOLOCATION_OPTIONS,
  PUBLIC_MAP_LOCATION_ENTRANCE_SESSION_KEY,
  PUBLIC_MAP_LOCATION_GRANTED_SESSION_KEY,
  resolvePublicMapLocationPermissionAction,
  resolveUserLocationStatusFromError,
} from "@/components/public/public-map-index/user-location"
import { FALLBACK_ZOOM } from "@/components/public/public-map-index/map-view-helpers"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("public map user location", () => {
  it("maps browser permission states without prompting automatically", () => {
    expect(resolvePublicMapLocationPermissionAction("granted")).toBe("request")
    expect(resolvePublicMapLocationPermissionAction("prompt")).toBe("prompt")
    expect(resolvePublicMapLocationPermissionAction("denied")).toBe("denied")
  })

  it("uses low-accuracy location requests with bounded caching", () => {
    expect(PUBLIC_MAP_GEOLOCATION_OPTIONS).toEqual({
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 300_000,
    })
    expect(resolveUserLocationStatusFromError({ code: 1 })).toBe("denied")
    expect(resolveUserLocationStatusFromError({ code: 2 })).toBe("unavailable")
    expect(resolveUserLocationStatusFromError({ code: 3 })).toBe("timed_out")
    expect(buildLocationFeedback("timed_out")?.message).toContain(
      "location request timed out"
    )
  })

  it("rejects invalid coordinates", () => {
    expect(
      normalizePublicMapUserCoordinates({ latitude: 41.88, longitude: -87.63 })
    ).toEqual({ latitude: 41.88, longitude: -87.63 })
    expect(
      normalizePublicMapUserCoordinates({ latitude: 91, longitude: -87.63 })
    ).toBeNull()
    expect(
      normalizePublicMapUserCoordinates({
        latitude: 41.88,
        longitude: Infinity,
      })
    ).toBeNull()
  })

  it("gates the entrance in tab-scoped session storage", () => {
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    }

    expect(hasRunPublicMapLocationEntrance(storage)).toBe(false)
    markPublicMapLocationEntranceRun(storage)
    expect(entries.get(PUBLIC_MAP_LOCATION_ENTRANCE_SESSION_KEY)).toBe("1")
    expect(hasRunPublicMapLocationEntrance(storage)).toBe(true)
    expect(hasGrantedPublicMapLocation(storage)).toBe(false)
    markPublicMapLocationGranted(storage)
    expect(entries.get(PUBLIC_MAP_LOCATION_GRANTED_SESSION_KEY)).toBe("1")
    expect(hasGrantedPublicMapLocation(storage)).toBe(true)
  })

  it("keeps location client-only and the entrance non-essential", () => {
    const hookSource = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )
    const runtimeSource = readSource(
      "src/components/public/public-map-index/public-map-index-runtime.ts"
    )

    expect(hookSource).toContain("window.sessionStorage")
    expect(hookSource).toContain('.query({ name: "geolocation" })')
    expect(hookSource).toContain('requestPosition("entrance")')
    expect(hookSource).toContain("setControlOpen(!storedGrant)")
    expect(hookSource).toContain("essential: false")
    expect(hookSource).not.toContain("localStorage")
    expect(hookSource).not.toContain("fetch(")
    expect(runtimeSource).not.toContain("getCurrentPosition")
  })

  it("checks permission before the deferred map starts without flashing consent", () => {
    const hookSource = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )

    expect(hookSource).toContain(
      "const [controlOpen, setControlOpen] = useState(false)"
    )
    expect(hookSource).not.toContain("entranceStartedRef")
    expect(hookSource).toMatch(
      /setStatus\("checking"\)[\s\S]*?\.query\(\{ name: "geolocation" \}\)/
    )
    expect(hookSource).not.toContain(
      "else if (hasRunPublicMapLocationEntrance(window.sessionStorage))"
    )
    expect(hookSource).not.toContain(
      "if (!coordinates && entranceStartedRef.current) setControlOpen(true)"
    )
    expect(hookSource).toContain(
      'source === "entrance" && attempt === 0 && error.code === 2'
    )
    expect(hookSource).toContain("readPosition(1)")
    expect(hookSource.match(/if \(storedGrant\) \{/g)).toHaveLength(3)
    expect(hookSource.match(/requestPosition\("entrance"\)/g)).toHaveLength(3)
  })

  it("keeps the location indicator unchanged under night lighting", () => {
    const hookSource = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )

    expect(hookSource.match(/"circle-emissive-strength": 1/g)).toHaveLength(2)
  })

  it("opens a centered prompt over a slowly rotating wider globe", () => {
    const hookSource = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )
    const rotationSource = readSource(
      "src/components/public/public-map-index/spinning-globe.ts"
    )
    const locationControlSource = readSource(
      "src/components/public/public-map-index/location-control.tsx"
    )
    const sidebarThemeSource = readSource(
      "src/components/public/public-map-index/sidebar-theme.ts"
    )

    expect(FALLBACK_ZOOM).toBe(1.5)
    expect(hookSource).toContain('setStatus("prompt")')
    expect(hookSource).toContain("setControlOpen(!storedGrant)")
    expect(rotationSource).toContain(
      "PUBLIC_MAP_GLOBE_SECONDS_PER_REVOLUTION = 180"
    )
    expect(rotationSource).toContain('"(prefers-reduced-motion: reduce)"')
    expect(rotationSource).toContain('map.on("moveend", spinGlobe)')
    expect(rotationSource).toContain(
      "const rotationLatitude = map.getCenter().lat"
    )
    expect(rotationSource).toContain("!event.originalEvent")
    expect(rotationSource).toContain('document.visibilityState !== "hidden"')
    expect(hookSource).toContain("startSpinningMapGlobe")
    expect(locationControlSource).toContain(
      "absolute inset-0 z-[60] flex items-center justify-center p-4"
    )
    expect(sidebarThemeSource).toContain(
      "bg-background/88 text-foreground backdrop-blur-xl"
    )
    expect(sidebarThemeSource).toContain("dark:border-input dark:bg-input/35")
    expect(sidebarThemeSource).not.toContain('"dark border-input')
    expect(locationControlSource).toContain(
      "PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME"
    )
    expect(locationControlSource).not.toContain("bg-card/92")
    expect(locationControlSource).not.toContain("bg-background/92")
    expect(locationControlSource).not.toContain("dark:bg-input/30")
    expect(locationControlSource).not.toContain("bg-background/95")
    expect(locationControlSource).not.toContain("absolute top-10 left-0")
  })

  it("focuses a granted location at neighborhood scale", () => {
    const hookSource = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )

    expect(hookSource).toContain("PUBLIC_MAP_USER_LOCATION_ZOOM = 13")
    expect(hookSource).toContain(
      "zoom: Math.max(map.getZoom(), PUBLIC_MAP_USER_LOCATION_ZOOM)"
    )
    expect(hookSource).toMatch(
      /const storedGrant = hasGrantedPublicMapLocation\(window\.sessionStorage\)[\s\S]*\.query\(\{ name: "geolocation" \}\)[\s\S]*requestPosition\("entrance"\)/
    )
  })

  it("keeps a fast location result until the deferred map is ready", () => {
    const indexSource = readSource("src/components/public/public-map-index.tsx")
    const locationWeatherSource = readSource(
      "src/components/public/public-map-index/use-public-map-location-weather.ts"
    )
    const runtimeSource = readSource(
      "src/components/public/public-map-index/public-map-index-runtime.ts"
    )
    const hookSource = readSource(
      "src/components/public/public-map-index/use-public-map-user-location.ts"
    )

    expect(indexSource).toContain("mapStartRef")
    expect(locationWeatherSource).toContain(
      "onRequestMapStart: () => mapStartRef.current?.()"
    )
    expect(runtimeSource).toContain("mapStartRef.current = startMap")
    expect(hookSource).toContain("shouldFocusLocationRef")
    expect(hookSource).toMatch(
      /shouldFocusLocationRef\.current =\s*source === "manual"[\s\S]*setCoordinates\(nextCoordinates\)[\s\S]*setStatus\("centered"\)/
    )
    expect(hookSource).toMatch(
      /const handleConfirm = useCallback\(\(\) => \{\s*onRequestMapStart\(\)\s*requestPosition\("manual"\)/
    )
    expect(hookSource).not.toMatch(
      /const nextCoordinates[\s\S]*?const map = mapRef\.current[\s\S]*?if \(!map \|\| !mapLoadedRef\.current\) return/
    )
  })

  it("places mobile map controls in a shared safe-area row", () => {
    const locationControlSource = readSource(
      "src/components/public/public-map-index/location-control.tsx"
    )
    const mapSurfaceSource = readSource(
      "src/components/public/public-map-index/map-surface.tsx"
    )
    const sidebarSource = readSource(
      "src/components/public/public-map-index/sidebar.tsx"
    )
    const welcomeControlSource = readSource(
      "src/components/public/public-map-index/member-onboarding-preview-controls.tsx"
    )
    const statusPillSource = readSource(
      "src/components/public/public-map-index/directory-status-pill.tsx"
    )

    expect(locationControlSource).toContain("safe-area-inset-top")
    expect(locationControlSource).toContain("safe-area-inset-left")
    expect(locationControlSource).toContain("data-public-map-location-controls")
    expect(locationControlSource).not.toContain("absolute inset-0 md:z-[60]")
    expect(locationControlSource).toContain("Location timed out")
    expect(locationControlSource).toContain(
      "public-map-location-card:current-location"
    )
    expect(locationControlSource).toContain("getReactGrabOwnerProps")
    expect(locationControlSource).toContain("getReactGrabLinkedSurfaceProps")
    expect(locationControlSource).toContain("PublicMapDirectoryStatusPill")
    expect(locationControlSource).toContain(
      "PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME"
    )
    expect(statusPillSource).toContain("PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME")
    expect(locationControlSource).toContain(
      "size-8 shrink-0 touch-manipulation rounded-full"
    )
    expect(locationControlSource).toContain("data-public-map-location-trigger")
    expect(locationControlSource).toContain("Use your location?")
    expect(locationControlSource.replace(/\s+/g, " ")).toContain(
      "Your location is not saved"
    )
    expect(welcomeControlSource).toContain("left-1/2")
    expect(welcomeControlSource).toContain("-translate-x-1/2")
    expect(welcomeControlSource).toContain(">Welcome</span>")
    expect(welcomeControlSource).not.toContain("Hide welcome")
    expect(welcomeControlSource).toContain("PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME")
    expect(locationControlSource).toContain("{additionalControls}")
    expect(welcomeControlSource).toContain("md:left-1/2 md:z-30 md:-translate-x-1/2")
    expect(mapSurfaceSource).toContain("styles.surface")
    expect(welcomeControlSource).toContain("data-public-map-welcome-control")
    expect(mapSurfaceSource).toContain("data-public-map-status-overlays")
    expect(mapSurfaceSource).toContain("safe-area-inset-top")
    expect(mapSurfaceSource).toContain("safe-area-inset-right")
    expect(mapSurfaceSource).toContain("max-w-[calc(100%_-_2rem)]")
    expect(sidebarSource).toContain("safe-area-inset-bottom")
    expect(sidebarSource).toContain("safe-area-inset-left")
    expect(sidebarSource).toContain("data-public-map-sidebar-open-control")
    expect(sidebarSource).not.toContain(
      '"absolute top-4 left-4 z-20 transition-[opacity,transform]'
    )
  })

  it("limits geolocation to same-origin find routes", () => {
    const configSource = readSource("next.config.ts")

    expect(configSource).toContain('source: "/"')
    expect(configSource).toContain('key: "Permissions-Policy"')
    expect(configSource).toContain('value: "geolocation=(self)"')
  })
})
