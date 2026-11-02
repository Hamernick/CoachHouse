import type { ReactFlowInstance } from "@xyflow/react"

// Shared by existing camera owners; stores no route, layout or organization data.
const intents = new WeakMap<object, symbol>()

export function captureWorkspaceCameraIntent(canvas: object) {
  const ticket = intents.get(canvas)
  return () => intents.get(canvas) === ticket
}

export function beginWorkspaceCameraIntent(canvas: object) {
  intents.set(canvas, Symbol("camera intent"))
  return captureWorkspaceCameraIntent(canvas)
}

/** React Flow's immediate transform interrupts the current D3 zoom transition. */
export function interruptWorkspaceCamera(canvas: Pick<ReactFlowInstance, "getViewport" | "setViewport">) {
  const current = beginWorkspaceCameraIntent(canvas)
  void canvas.setViewport(canvas.getViewport(), { duration: 0 }).catch(() => {
    // No retry: another owner/user may already control this viewport.
  })
  return current
}
