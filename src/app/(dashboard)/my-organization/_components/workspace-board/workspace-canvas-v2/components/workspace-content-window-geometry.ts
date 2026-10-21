import type { WorkspaceCanvasDrawerTab } from "./workspace-canvas-overlay-drawer-tabs"

export type WorkspaceContentWindowGeometry = { width: number; height: number }

// All dimensions are canvas-local CSS pixels. Include the measured composer in
// dockHeight so multiline input can never cover the window or its controls.
export function resolveWorkspaceContentWindowGeometry({
  canvasWidth,
  canvasHeight,
  dockHeight,
  maximized,
  tab,
}: {
  canvasWidth: number
  canvasHeight: number
  dockHeight: number
  maximized: boolean
  tab?: WorkspaceCanvasDrawerTab
}): WorkspaceContentWindowGeometry | null {
  if (
    ![canvasWidth, canvasHeight, dockHeight].every(Number.isFinite) ||
    dockHeight < 0
  )
    return null
  // Reserve the taller touch-navigation rows in workspace-dock.module.css.
  // Mouse layouts start 12px higher; both retain composer and edge clearance.
  const top = canvasWidth <= 700 ? 120 : 70
  const availableHeight = canvasHeight - dockHeight - top - 16
  if (canvasWidth <= 16 || availableHeight <= 0) return null
  const availableWidth = canvasWidth - 16
  // Accelerator's overview uses two columns at 640px of inner width (18px
  // shell/panel inset). Give its stacked layout a readable single-column width.
  const acceleratorStacked = availableWidth < 658
  const size = tab === "tools"
    ? { width: 560, height: 360 }
    : tab === "organization"
      ? { width: 768, height: 560 }
      : tab === "documents"
        ? { width: 760, height: 560 }
        : tab === "accelerator"
          ? { width: acceleratorStacked ? 520 : 1040, height: acceleratorStacked ? 1200 : 1000 }
          : { width: 960, height: 560 }
  return {
    width: maximized ? availableWidth : Math.min(size.width, availableWidth),
    height: maximized ? availableHeight : Math.min(size.height, availableHeight),
  }
}
