"use client"

import { useEffect, type MutableRefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import { WORKSPACE_CANVAS_EVENTS } from "../contracts/workspace-canvas-events"
import { logWorkspaceCanvasEvent } from "./workspace-canvas-logger"
import {
  executeWorkspaceCanvasViewportCommand,
  resolveWorkspaceCanvasViewportCommand,
  type WorkspaceCanvasCameraFitOptions,
  type WorkspaceCanvasTutorialCompletionExitRequest,
} from "./workspace-canvas-viewport-command"

function scheduleDoubleFrame(callback: () => void) {
  let frameA = 0
  let frameB = 0
  frameA = window.requestAnimationFrame(() => {
    frameB = window.requestAnimationFrame(() => {
      callback()
    })
  })
  return () => {
    window.cancelAnimationFrame(frameA)
    window.cancelAnimationFrame(frameB)
  }
}

export function useWorkspaceCanvasTutorialCompletionExitEffects({
  flowInstanceRef,
  isFlowReady,
  visibleNodeIds,
  tutorialSceneFitActive,
  tutorialCompletionExitRequest,
  handledTutorialCompletionExitRequestKeyRef,
  pendingTutorialCompletionExitRequestKeyRef,
  layoutFitOptions,
  sceneFitOptions,
  acceleratorFocusOptions,
  focusCardOptions,
  onTutorialCompletionExitHandled,
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
  visibleNodeIds: string[]
  tutorialSceneFitActive: boolean
  tutorialCompletionExitRequest: WorkspaceCanvasTutorialCompletionExitRequest
  handledTutorialCompletionExitRequestKeyRef: MutableRefObject<number>
  pendingTutorialCompletionExitRequestKeyRef: MutableRefObject<number>
  layoutFitOptions: WorkspaceCanvasCameraFitOptions
  sceneFitOptions: WorkspaceCanvasCameraFitOptions
  acceleratorFocusOptions: WorkspaceCanvasCameraFitOptions
  focusCardOptions: WorkspaceCanvasCameraFitOptions
  onTutorialCompletionExitHandled: () => void
}) {
  useEffect(() => {
    if (tutorialSceneFitActive) return
    if (!tutorialCompletionExitRequest) return
    if (tutorialCompletionExitRequest.requestKey <= 0) return
    if (
      tutorialCompletionExitRequest.requestKey <=
      handledTutorialCompletionExitRequestKeyRef.current
    ) {
      return
    }
    if (
      tutorialCompletionExitRequest.requestKey ===
      pendingTutorialCompletionExitRequestKeyRef.current
    ) {
      return
    }
    if (!isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return

    pendingTutorialCompletionExitRequestKeyRef.current =
      tutorialCompletionExitRequest.requestKey

    return scheduleDoubleFrame(() => {
      const command = resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: null,
        tutorialCompletionExitRequest,
        focusCardRequest: null,
        visibleNodeIds,
      })
      if (!command) {
        pendingTutorialCompletionExitRequestKeyRef.current = 0
        return
      }

      const result = executeWorkspaceCanvasViewportCommand({
        flowInstance,
        command,
        layoutFitOptions,
        sceneFitOptions,
        focusCardOptions,
        acceleratorFocusOptions,
      })
      if (!result.executed) {
        pendingTutorialCompletionExitRequestKeyRef.current = 0
        return
      }

      handledTutorialCompletionExitRequestKeyRef.current =
        tutorialCompletionExitRequest.requestKey
      pendingTutorialCompletionExitRequestKeyRef.current = 0
      onTutorialCompletionExitHandled()
      logWorkspaceCanvasEvent(
        WORKSPACE_CANVAS_EVENTS.CAMERA_LAYOUT_FIT_REQUEST,
        {
          requestKey: tutorialCompletionExitRequest.requestKey,
          cardId:
            tutorialCompletionExitRequest.kind === "focus-card"
              ? tutorialCompletionExitRequest.cardId
              : undefined,
          nodeCount: result.nodeCount,
          reason: "tutorial_completion_exit",
        }
      )
    })
  }, [
    acceleratorFocusOptions,
    flowInstanceRef,
    focusCardOptions,
    handledTutorialCompletionExitRequestKeyRef,
    isFlowReady,
    layoutFitOptions,
    onTutorialCompletionExitHandled,
    pendingTutorialCompletionExitRequestKeyRef,
    sceneFitOptions,
    tutorialCompletionExitRequest,
    tutorialSceneFitActive,
    visibleNodeIds,
  ])
}
