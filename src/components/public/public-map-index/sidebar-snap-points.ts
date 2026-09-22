function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export type PublicMapDrawerSnapPoints = readonly [string, string, number]
export type PublicMapDrawerSnapPointIndex = 0 | 1 | 2

const PUBLIC_MAP_DRAWER_COLLAPSED_HEIGHT = 168

export function resolveNextPublicMapDrawerSnapPointIndex(
  currentIndex: PublicMapDrawerSnapPointIndex
): PublicMapDrawerSnapPointIndex {
  if (currentIndex === 0) return 1
  if (currentIndex === 1) return 2
  return 1
}

export function buildPublicMapDrawerSnapPoints(
  surfaceHeight: number,
  withNavigation = false
): PublicMapDrawerSnapPoints {
  const safeSurfaceHeight = Math.max(0, Math.round(surfaceHeight))

  if (safeSurfaceHeight <= 0) {
    return [withNavigation ? "86px" : "168px", "336px", 1] as const
  }

  // Keep the lowest stop limited to the drawer controls, without list content.
  const collapsedHeight = withNavigation ? 86 : PUBLIC_MAP_DRAWER_COLLAPSED_HEIGHT
  const defaultHeight = Math.round(
    clamp(safeSurfaceHeight * 0.56, 336, Math.max(360, safeSurfaceHeight - 88))
  )
  return [`${collapsedHeight}px`, `${defaultHeight}px`, 1] as const
}

function parseSnapPointPixels(
  snapPoint: number | string,
  surfaceHeight: number
) {
  const pixels =
    typeof snapPoint === "number"
      ? snapPoint >= 0 && snapPoint <= 1
        ? snapPoint * surfaceHeight
        : snapPoint
      : Number.parseFloat(snapPoint.replace("px", ""))

  return Number.isFinite(pixels) ? pixels : null
}

export function resolvePublicMapDrawerVisibleHeight({
  snapPoint,
  surfaceHeight,
}: {
  snapPoint: number | string
  surfaceHeight: number
}) {
  const safeSurfaceHeight = Math.max(0, Math.round(surfaceHeight))
  const pixels = parseSnapPointPixels(snapPoint, safeSurfaceHeight)

  if (pixels == null) return 0
  return Math.round(clamp(pixels, 0, safeSurfaceHeight))
}

export function resolvePublicMapDrawerSnapPointIndex({
  snapPoint,
  snapPoints,
  surfaceHeight,
}: {
  snapPoint: number | string | null
  snapPoints: PublicMapDrawerSnapPoints
  surfaceHeight: number
}): PublicMapDrawerSnapPointIndex | null {
  if (snapPoint == null) return null

  const exactIndex = snapPoints.findIndex(
    (candidate) => candidate === snapPoint
  )
  if (exactIndex >= 0) return exactIndex as PublicMapDrawerSnapPointIndex

  const targetPixels = parseSnapPointPixels(snapPoint, surfaceHeight)

  if (targetPixels == null) return null

  let resolvedIndex: PublicMapDrawerSnapPointIndex = 0
  let smallestDifference = Number.POSITIVE_INFINITY

  snapPoints.forEach((candidate, index) => {
    const candidatePixels = parseSnapPointPixels(candidate, surfaceHeight)
    if (candidatePixels == null) return

    const difference = Math.abs(candidatePixels - targetPixels)
    if (difference >= smallestDifference) return

    resolvedIndex = index as PublicMapDrawerSnapPointIndex
    smallestDifference = difference
  })

  return resolvedIndex
}
