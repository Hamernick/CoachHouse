import type { WorkspaceCanvasDrawerTab } from "./workspace-canvas-overlay-drawer-tabs"

export type WorkspaceContentWindowGeometry = { width: number; height: number }

// All dimensions are canvas-local CSS pixels. Include the measured composer in
// dockHeight so multiline input has clearance in the regular window layout.
export function resolveWorkspaceContentWindowGeometry({
  canvasWidth,
  canvasHeight,
  dockHeight,
  topInset = 8,
  maximized,
  tab,
  preferredWidth = 440,
}: {
  canvasWidth: number
  canvasHeight: number
  dockHeight: number
  topInset?: number
  maximized: boolean
  tab?: WorkspaceCanvasDrawerTab
  preferredWidth?: number
}): WorkspaceContentWindowGeometry | null {
  if (
    ![canvasWidth, canvasHeight, dockHeight, topInset].every(Number.isFinite) ||
    topInset < 0 || dockHeight < 0 || canvasWidth <= 16 || canvasHeight <= 0
  )
    return null
  // Fullscreen owns the canvas; the dock stays layered above its padded body.
  if (maximized) return { width: canvasWidth, height: canvasHeight }
  // Organization is a canvas-local sidebar that expands from its profile trigger.
  if (tab === "organization") {
    // On narrower canvases the centered dock intersects the sidebar width.
    const width = Number.isFinite(preferredWidth) ? Math.max(440, preferredWidth) : 440
    const bottom = canvasWidth < 1424 + 2 * (width - 440) ? dockHeight + 16 : 8
    // The sidebar replaces its top trigger; only centered windows clear the tabs.
    const height = canvasHeight - 8 - bottom
    if (canvasWidth <= 16 || height <= 0) return null
    return {
      width: Math.min(width, canvasWidth - 16),
      height,
    }
  }
  // Reserve the actual top navigation and bottom composer independently.
  const availableHeight = canvasHeight - topInset - dockHeight - 8
  if (canvasWidth <= 16 || availableHeight <= 0) return null
  const availableWidth = canvasWidth - 16
  // Accelerator's overview uses two columns at 640px of inner width (18px
  // shell/panel inset). Give its stacked layout a readable single-column width.
  const acceleratorStacked = availableWidth < 658
  const size = tab === "tools"
    ? { width: 560 }
    : tab === "documents"
      ? { width: 760 }
      : tab === "accelerator"
        ? { width: acceleratorStacked ? 520 : 1040 }
        : { width: 960 }
  return {
    width: Math.min(size.width, availableWidth),
    height: availableHeight,
  }
}
