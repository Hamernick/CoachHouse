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

export function resolveWorkspaceDataDrawerViewportHeight(snapPoint: unknown) {
  const resolvedSnapPoint =
    resolveWorkspaceDataDrawerSnapPoint(snapPoint) ??
    WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
  const visibleHeight =
    typeof resolvedSnapPoint === "number"
      ? `${resolvedSnapPoint * 100}%`
      : resolvedSnapPoint

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

// Floating dock geometry includes 16px clearance at both canvas edges.
// Vaul offsets remain relative to the full canvas, so subtract both gaps
// from its visible detent when sizing the panel inside the transparent shell.
export function resolveWorkspaceFloatingDrawerHeight(
  canvasHeight: number,
  snapPoint: number | string | null,
  composerHeight: number,
  chromeHeight = 58
) {
  if (isWorkspaceDataDrawerCollapsedSnapPoint(snapPoint))
    return chromeHeight + composerHeight
  const fraction =
    typeof snapPoint === "number"
      ? snapPoint
      : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
  return Math.max(chromeHeight + composerHeight, canvasHeight * fraction - 32)
}
