import { PUBLIC_MAP_GLOBE_MAX_SPIN_ZOOM } from "@/lib/public-map/globe-settings"

type Coordinate = { lng: number; lat: number }
type ScreenRectangle = { left: number; top: number; right: number; bottom: number }

// A rotated/pitched screen's geographic extremes may be at any of its corners.
export function resourceMapScreenBounds(
  screen: ScreenRectangle,
  canvas: Pick<ScreenRectangle, "left" | "top">,
  unproject: (point: [number, number]) => Coordinate
) {
  const corners = [
    [screen.left, screen.top], [screen.right, screen.top],
    [screen.right, screen.bottom], [screen.left, screen.bottom],
  ].map(([x, y]) => unproject([x - canvas.left, y - canvas.top]))
  const longitudes = corners.map((point) => point.lng)
  const rawWest = Math.min(...longitudes), rawEast = Math.max(...longitudes)
  const center = unproject([
    (screen.left + screen.right) / 2 - canvas.left,
    (screen.top + screen.bottom) / 2 - canvas.top,
  ]).lng
  // Unwrap around the visible center: 179/-179 becomes a 2-degree interval.
  // The center disambiguates genuinely wide views; corner endpoints alone cannot.
  // Preserve explicit whole-world coverage before modulo would collapse it.
  const unwrapped = rawEast - rawWest >= 360 ? longitudes : longitudes.map(
    (lng) => center + ((lng - center + 180) % 360 + 360) % 360 - 180
  )
  return [
    Math.min(...unwrapped),
    Math.min(...corners.map((point) => point.lat)),
    Math.max(...unwrapped),
    Math.max(...corners.map((point) => point.lat)),
  ] as const
}

export function serializeResourceMapBounds([westEdge, southEdge, eastEdge, northEdge]: readonly number[]) {
  if (![westEdge, southEdge, eastEdge, northEdge].every(Number.isFinite)) return null
  const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180
  const fullWorld = eastEdge - westEdge >= 360
  // Round outwards so places at the viewport edge are not dropped.
  const floor = (value: number) => Math.floor(value * 1000) / 1000
  const ceil = (value: number) => Math.ceil(value * 1000) / 1000
  return [
    fullWorld ? -180 : wrap(floor(westEdge)),
    Math.max(-90, floor(southEdge)),
    fullWorld ? 180 : wrap(ceil(eastEdge)),
    Math.min(90, ceil(northEdge)),
  ].map((value) => value.toFixed(3)).join(",")
}

// Globe extrema can lie along curved edges, outside the screen-corner samples.
// Use Mapbox's projection-aware bounds for every non-rectangular projection.
export function resolveResourceMapQueryBounds(
  projection: string,
  viewport: readonly number[],
  screen: (() => readonly number[]) | null,
  zoom = Infinity
) {
  // The overview rotates every second. Keep its paginated query stable so slow
  // responses can finish; Mapbox still clips pins to the visible hemisphere.
  if (projection === "globe" && zoom < PUBLIC_MAP_GLOBE_MAX_SPIN_ZOOM) {
    return "-180.000,-90.000,180.000,90.000"
  }
  return serializeResourceMapBounds(projection === "mercator" && screen ? screen() : viewport)
    ?? serializeResourceMapBounds(viewport)
}
