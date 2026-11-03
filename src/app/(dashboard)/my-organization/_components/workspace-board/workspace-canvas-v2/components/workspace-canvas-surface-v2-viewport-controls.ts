"use client"

import { beginWorkspaceCameraIntent } from "@/lib/workspace-canvas/camera-intent"
import { useCallback, type MutableRefObject } from "react"
import { getNodesBounds, type ReactFlowInstance } from "@xyflow/react"

import {
  WORKSPACE_CANVAS_V2_CARD_FOCUS_OPTIONS,
  WORKSPACE_CANVAS_V2_LAYOUT_FIT_OPTIONS,
  WORKSPACE_CANVAS_V2_TUTORIAL_SCENE_FIT_OPTIONS,
  WORKSPACE_CANVAS_V2_ZOOM_PUNCH_MS,
} from "./workspace-canvas-surface-v2-config"
import type { WorkspaceCanvasSurfaceV2Props } from "./workspace-canvas-surface-v2-types"
import {
  executeWorkspaceCanvasViewportCommand,
  resolveWorkspaceCanvasCameraDuration,
  resolveWorkspaceCanvasViewportCommand,
  type WorkspaceCanvasSceneFitRequest,
} from "../runtime/workspace-canvas-viewport-command"

export function useWorkspaceCanvasViewportControls({
  flowInstanceRef,
  tutorialActive,
  tutorialSceneFitRequest,
  tutorialCompletionExitRequest,
  focusCardRequest,
  visibleNodeIds,
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  tutorialActive: boolean
  tutorialSceneFitRequest: WorkspaceCanvasSceneFitRequest
  tutorialCompletionExitRequest: WorkspaceCanvasSurfaceV2Props["tutorialCompletionExitRequest"]
  focusCardRequest: WorkspaceCanvasSurfaceV2Props["focusCardRequest"]
  visibleNodeIds: string[]
}) {
  const handleZoomIn = useCallback(() => {
    if (flowInstanceRef.current) beginWorkspaceCameraIntent(flowInstanceRef.current)
    void flowInstanceRef.current?.zoomIn({
      duration: resolveWorkspaceCanvasCameraDuration(
        WORKSPACE_CANVAS_V2_ZOOM_PUNCH_MS
      ),
    })
  }, [flowInstanceRef])

  const handleZoomOut = useCallback(() => {
    if (flowInstanceRef.current) beginWorkspaceCameraIntent(flowInstanceRef.current)
    void flowInstanceRef.current?.zoomOut({
      duration: resolveWorkspaceCanvasCameraDuration(
        WORKSPACE_CANVAS_V2_ZOOM_PUNCH_MS
      ),
    })
  }, [flowInstanceRef])

  const handleRecenterView = useCallback(() => {
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return
    if (!tutorialActive) {
      const nodes = flowInstance.getNodes().filter(node => !node.hidden)
      if (!nodes.length) return
      // fitView omits virtualized, not-yet-measured nodes. Particle nodes already
      // declare their dimensions; include those bounds before they scroll in.
      beginWorkspaceCameraIntent(flowInstance)
      void flowInstance.fitBounds(getNodesBounds(nodes), {
        ...WORKSPACE_CANVAS_V2_LAYOUT_FIT_OPTIONS,
        duration: resolveWorkspaceCanvasCameraDuration(WORKSPACE_CANVAS_V2_LAYOUT_FIT_OPTIONS.duration),
      })
      return
    }
    const command = resolveWorkspaceCanvasViewportCommand({
      tutorialSceneFitRequest,
      tutorialCompletionExitRequest,
      focusCardRequest,
      visibleNodeIds,
    })
    if (!command) return

    executeWorkspaceCanvasViewportCommand({
      flowInstance,
      command,
      layoutFitOptions: WORKSPACE_CANVAS_V2_LAYOUT_FIT_OPTIONS,
      sceneFitOptions: WORKSPACE_CANVAS_V2_TUTORIAL_SCENE_FIT_OPTIONS,
      focusCardOptions: WORKSPACE_CANVAS_V2_CARD_FOCUS_OPTIONS,
    })
  }, [
    flowInstanceRef,
    focusCardRequest,
    tutorialActive,
    tutorialCompletionExitRequest,
    tutorialSceneFitRequest,
    visibleNodeIds,
  ])

  return {
    handleZoomIn,
    handleZoomOut,
    handleRecenterView,
  }
}
