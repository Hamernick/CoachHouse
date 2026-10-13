export type WorkspaceContentWindowGeometry = { width: number; height: number }

// All dimensions are canvas-local CSS pixels. Include the measured composer in
// dockHeight so multiline input can never cover the window or its controls.
export function resolveWorkspaceContentWindowGeometry({
  canvasWidth,
  canvasHeight,
  dockHeight,
  maximized,
}: {
  canvasWidth: number
  canvasHeight: number
  dockHeight: number
  maximized: boolean
}): WorkspaceContentWindowGeometry | null {
  if (
    ![canvasWidth, canvasHeight, dockHeight].every(Number.isFinite) ||
    dockHeight < 0
  )
    return null
  const availableHeight = canvasHeight - dockHeight - 48
  if (canvasWidth < 900 || availableHeight < 320) return null
  return {
    width: maximized ? canvasWidth - 32 : Math.min(920, canvasWidth - 48),
    height: maximized
      ? availableHeight
      : Math.min(
          availableHeight,
          Math.max(320, Math.round(availableHeight * 0.7))
        ),
  }
}
