// Match the renderer's Web Mercator range; (0, 0) is an import placeholder.
export function hasPublicMapCoordinates<T extends { latitude: number | null; longitude: number | null }>(item: T): item is T & { latitude: number; longitude: number } {
  return typeof item.latitude === "number" && Number.isFinite(item.latitude) &&
    Math.abs(item.latitude) <= 85.051129 &&
    typeof item.longitude === "number" && Number.isFinite(item.longitude) &&
    Math.abs(item.longitude) <= 180 && !(item.latitude === 0 && item.longitude === 0)
}
