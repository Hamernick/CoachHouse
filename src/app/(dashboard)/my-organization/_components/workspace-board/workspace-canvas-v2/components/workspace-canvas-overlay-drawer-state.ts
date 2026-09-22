export const WORKSPACE_DATA_DRAWER_SNAP_POINTS = ["68px", 0.48, 1] as const
export const WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT =
  WORKSPACE_DATA_DRAWER_SNAP_POINTS[0]
export const WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT =
  WORKSPACE_DATA_DRAWER_SNAP_POINTS[1]
export const WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT =
  WORKSPACE_DATA_DRAWER_SNAP_POINTS[2]

const WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_MAX = 0.11
const WORKSPACE_DATA_DRAWER_FULLSCREEN_SNAP_TOLERANCE = 0.01
const WORKSPACE_DATA_DRAWER_SNAP_POINT_TOLERANCE = 0.01
const WORKSPACE_PARTICLES_MOBILE_DEFAULT_SNAP_POINT = 0.68

export function resolveWorkspaceDataDrawerDisplaySnapPoint(
  snapPoint: number | string | null,
  mobileParticles = false
) {
  return mobileParticles &&
    snapPoint === WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
    ? WORKSPACE_PARTICLES_MOBILE_DEFAULT_SNAP_POINT
    : snapPoint
}

export function resolveWorkspaceDataDrawerStoredSnapPoint(
  snapPoint: unknown,
  mobileParticles = false
) {
  return resolveWorkspaceDataDrawerSnapPoint(
    mobileParticles &&
      snapPoint === WORKSPACE_PARTICLES_MOBILE_DEFAULT_SNAP_POINT
      ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
      : snapPoint
  )
}

export function resolveWorkspaceDataDrawerSnapPoint(snapPoint: unknown) {
  if (snapPoint === WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT) {
    return WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
  }
  if (typeof snapPoint !== "number" || !Number.isFinite(snapPoint)) return null

  return (
    WORKSPACE_DATA_DRAWER_SNAP_POINTS.find(
      (candidate) =>
        typeof candidate === "number" &&
        Math.abs(candidate - snapPoint) <=
          WORKSPACE_DATA_DRAWER_SNAP_POINT_TOLERANCE + Number.EPSILON
    ) ?? null
  )
}

export function resolveWorkspaceDataDrawerViewportHeight(
  snapPoint: unknown,
  mobileParticles = false
) {
  const resolvedSnapPoint =
    resolveWorkspaceDataDrawerSnapPoint(snapPoint) ??
    WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
  const displaySnapPoint = resolveWorkspaceDataDrawerDisplaySnapPoint(
    resolvedSnapPoint,
    mobileParticles
  )
  const visibleHeight =
    typeof displaySnapPoint === "number"
      ? `${displaySnapPoint * 100}%`
      : displaySnapPoint

  return `calc(${visibleHeight} - 2rem)`
}

export function isWorkspaceDataDrawerCollapsedSnapPoint(
  snapPoint: number | string | null
) {
  if (snapPoint === WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT) return true
  return (
    typeof snapPoint === "number" &&
    snapPoint <= WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_MAX
  )
}

export function isWorkspaceDataDrawerFullscreenSnapPoint(
  snapPoint: number | string | null
) {
  if (typeof snapPoint === "number") {
    return (
      snapPoint >=
      WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT -
        WORKSPACE_DATA_DRAWER_FULLSCREEN_SNAP_TOLERANCE
    )
  }
  if (typeof snapPoint !== "string") return false

  const numericSnapPoint = Number(snapPoint)
  return (
    Number.isFinite(numericSnapPoint) &&
    numericSnapPoint >=
      WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT -
        WORKSPACE_DATA_DRAWER_FULLSCREEN_SNAP_TOLERANCE
  )
}
