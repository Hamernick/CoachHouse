"use client"

import { useCallback, type MutableRefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

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
    void flowInstanceRef.current?.zoomIn({
      duration: resolveWorkspaceCanvasCameraDuration(
        WORKSPACE_CANVAS_V2_ZOOM_PUNCH_MS
      ),
    })
  }, [flowInstanceRef])

  const handleZoomOut = useCallback(() => {
    void flowInstanceRef.current?.zoomOut({
      duration: resolveWorkspaceCanvasCameraDuration(
        WORKSPACE_CANVAS_V2_ZOOM_PUNCH_MS
      ),
    })
  }, [flowInstanceRef])

  const handleRecenterView = useCallback(() => {
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return
    const command = resolveWorkspaceCanvasViewportCommand({
      tutorialSceneFitRequest: tutorialActive ? tutorialSceneFitRequest : null,
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
