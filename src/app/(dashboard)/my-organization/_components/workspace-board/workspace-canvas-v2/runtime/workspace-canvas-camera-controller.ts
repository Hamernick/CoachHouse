"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import { WORKSPACE_CANVAS_EVENTS } from "../contracts/workspace-canvas-events"
import { logWorkspaceCanvasEvent } from "./workspace-canvas-logger"
import {
  hasRenderableNodeBounds,
  scheduleDoubleFrame,
  useWorkspaceCanvasFitEffects,
  useWorkspaceCanvasFocusRequestEffects,
} from "./workspace-canvas-camera-controller-effects"
import { useWorkspaceCanvasTutorialCompletionExitEffects } from "./workspace-canvas-tutorial-completion-exit-effect"
import {
  executeWorkspaceCanvasViewportCommand,
  resolveFlowNodesForIds,
  type WorkspaceCanvasCameraFitOptions,
  type WorkspaceCanvasCardFocusRequest,
  type WorkspaceCanvasSceneFitRequest,
  type WorkspaceCanvasTutorialCompletionExitRequest,
} from "./workspace-canvas-viewport-command"

export function useWorkspaceCanvasCameraController({
  flowInstanceRef,
  isFlowReady,
  visibleNodeIds,
  layoutFitRequestKey,
  acceleratorFocusRequestKey,
  focusCardRequest,
  tutorialCompletionExitRequest,
  sceneFitRequest,
  layoutFitOptions,
  sceneFitOptions,
  acceleratorFocusOptions,
  focusCardOptions,
  suppressInitialFit,
  onTutorialCompletionExitHandled,
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
  visibleNodeIds: string[]
  layoutFitRequestKey: number
  acceleratorFocusRequestKey: number
  focusCardRequest: WorkspaceCanvasCardFocusRequest
  tutorialCompletionExitRequest: WorkspaceCanvasTutorialCompletionExitRequest
  sceneFitRequest: WorkspaceCanvasSceneFitRequest
  layoutFitOptions: WorkspaceCanvasCameraFitOptions
  sceneFitOptions: WorkspaceCanvasCameraFitOptions
  acceleratorFocusOptions: WorkspaceCanvasCameraFitOptions
  focusCardOptions: WorkspaceCanvasCameraFitOptions
  suppressInitialFit?: boolean
  onTutorialCompletionExitHandled: () => void
}) {
  const didInitialFitRef = useRef(false)
  const handledLayoutFitRequestKeyRef = useRef(0)
  const handledAcceleratorFocusRequestKeyRef = useRef(0)
  const handledFocusCardRequestKeyRef = useRef(0)
  const handledTutorialCompletionExitRequestKeyRef = useRef(0)
  const pendingTutorialCompletionExitRequestKeyRef = useRef(0)
  const handledSceneFitRequestRef = useRef<{
    requestKey: number
    signature: string | null
  }>({
    requestKey: 0,
    signature: null,
  })
  const pendingSceneFitRequestRef = useRef<string | null>(null)
  const previousVisibleNodeCountRef = useRef(visibleNodeIds.length)
  const tutorialSceneFitActive =
    sceneFitRequest !== null && sceneFitRequest.requestKey > 0

  useWorkspaceCanvasFitEffects({
    flowInstanceRef,
    isFlowReady,
    visibleNodeIds,
    tutorialSceneFitActive,
    didInitialFitRef,
    previousVisibleNodeCountRef,
    handledLayoutFitRequestKeyRef,
    layoutFitRequestKey,
    layoutFitOptions,
    sceneFitOptions,
    acceleratorFocusOptions,
    focusCardOptions,
    suppressInitialFit,
  })

  useEffect(() => {
    if (!sceneFitRequest) return
    if (sceneFitRequest.requestKey <= 0) return
    const pendingSceneFitRequestSignature = pendingSceneFitRequestRef.current
    const handledSceneFitRequest = handledSceneFitRequestRef.current
    if (sceneFitRequest.signature === handledSceneFitRequest.signature) {
      return
    }
    if (pendingSceneFitRequestSignature === sceneFitRequest.signature) {
      return
    }
    if (!isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return

    let cancelled = false
    let cancelPendingFrame: (() => void) | null = null
    let delayTimer = 0
    pendingSceneFitRequestRef.current = sceneFitRequest.signature
    const hasAuthoredViewport =
      typeof sceneFitRequest.x === "number" &&
      Number.isFinite(sceneFitRequest.x) &&
      typeof sceneFitRequest.y === "number" &&
      Number.isFinite(sceneFitRequest.y) &&
      typeof sceneFitRequest.zoom === "number" &&
      Number.isFinite(sceneFitRequest.zoom)

    const markSceneFitHandled = () => {
      handledSceneFitRequestRef.current = {
        requestKey: sceneFitRequest.requestKey,
        signature: sceneFitRequest.signature,
      }
      pendingSceneFitRequestRef.current = null
    }

    if (hasAuthoredViewport) {
      const applySceneCenter = () => {
        if (cancelled) return
        const result = executeWorkspaceCanvasViewportCommand({
          flowInstance,
          command: {
            kind: "scene-fit",
            sceneFitRequest,
          },
          layoutFitOptions,
          sceneFitOptions,
          focusCardOptions,
          acceleratorFocusOptions,
        })
        if (!result.executed) return
        markSceneFitHandled()
        logWorkspaceCanvasEvent(
          WORKSPACE_CANVAS_EVENTS.CAMERA_LAYOUT_FIT_REQUEST,
          {
            requestKey: sceneFitRequest.requestKey,
            nodeCount: result.nodeCount,
            reason: "scene_fit",
          }
        )
      }

      if ((sceneFitRequest.delayMs ?? 0) > 0) {
        delayTimer = window.setTimeout(
          applySceneCenter,
          sceneFitRequest.delayMs
        )
      } else {
        applySceneCenter()
      }

      return () => {
        cancelled = true
        pendingSceneFitRequestRef.current = null
        window.clearTimeout(delayTimer)
      }
    }

    if (sceneFitRequest.nodeIds.length === 0) {
      pendingSceneFitRequestRef.current = null
      return
    }

    const visibleNodeIdSet = new Set(visibleNodeIds)
    const allNodesVisible = sceneFitRequest.nodeIds.every((nodeId) =>
      visibleNodeIdSet.has(nodeId)
    )
    if (!allNodesVisible) {
      pendingSceneFitRequestRef.current = null
      return
    }

    const sceneNodeIdSet = new Set(sceneFitRequest.nodeIds)

    const attemptSceneFit = (remainingAttempts: number) => {
      cancelPendingFrame = scheduleDoubleFrame(() => {
        if (cancelled) return
        const nodes = resolveFlowNodesForIds(
          flowInstance,
          sceneFitRequest.nodeIds
        )
        if (nodes.length !== sceneFitRequest.nodeIds.length) {
          if (remainingAttempts > 0) {
            attemptSceneFit(remainingAttempts - 1)
          } else {
            pendingSceneFitRequestRef.current = null
          }
          return
        }
        if (!nodes.every(hasRenderableNodeBounds)) {
          if (remainingAttempts > 0) {
            attemptSceneFit(remainingAttempts - 1)
          } else {
            pendingSceneFitRequestRef.current = null
          }
          return
        }

        markSceneFitHandled()
        const result = executeWorkspaceCanvasViewportCommand({
          flowInstance,
          command: {
            kind: "scene-fit",
            sceneFitRequest,
          },
          layoutFitOptions,
          sceneFitOptions,
          focusCardOptions,
          acceleratorFocusOptions,
        })
        if (!result.executed) return
        logWorkspaceCanvasEvent(
          WORKSPACE_CANVAS_EVENTS.CAMERA_LAYOUT_FIT_REQUEST,
          {
            requestKey: sceneFitRequest.requestKey,
            nodeCount: result.nodeCount,
            reason: "scene_fit",
          }
        )
      })
    }

    attemptSceneFit(8)

    return () => {
      cancelled = true
      pendingSceneFitRequestRef.current = null
      cancelPendingFrame?.()
      window.clearTimeout(delayTimer)
    }
  }, [
    acceleratorFocusOptions,
    flowInstanceRef,
    focusCardOptions,
    isFlowReady,
    layoutFitOptions,
    sceneFitOptions,
    sceneFitRequest,
    visibleNodeIds,
  ])

  useWorkspaceCanvasTutorialCompletionExitEffects({
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
  })

  useWorkspaceCanvasFocusRequestEffects({
    flowInstanceRef,
    isFlowReady,
    visibleNodeIds,
    tutorialSceneFitActive,
    acceleratorFocusRequestKey,
    handledAcceleratorFocusRequestKeyRef,
    focusCardRequest,
    handledFocusCardRequestKeyRef,
    layoutFitOptions,
    sceneFitOptions,
    acceleratorFocusOptions,
    focusCardOptions,
  })
}
