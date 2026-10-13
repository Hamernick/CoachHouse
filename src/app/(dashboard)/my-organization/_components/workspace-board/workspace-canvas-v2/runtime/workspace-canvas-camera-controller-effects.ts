"use client"

import { useEffect, type MutableRefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import { ACCELERATOR_STEP_NODE_ID } from "../../workspace-board-flow-surface-accelerator-graph-composition"
import { WORKSPACE_CANVAS_EVENTS } from "../contracts/workspace-canvas-events"
import { logWorkspaceCanvasEvent } from "./workspace-canvas-logger"
import {
  executeWorkspaceCanvasViewportCommand,
  type WorkspaceCanvasCameraFitOptions,
  type WorkspaceCanvasCardFocusRequest,
} from "./workspace-canvas-viewport-command"

export function scheduleDoubleFrame(callback: () => void) {
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

function resolveNodeMeasuredDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null
}

export function hasRenderableNodeBounds(
  node: ReturnType<ReactFlowInstance["getNodes"]>[number]
) {
  const measured = node.measured
  const width =
    resolveNodeMeasuredDimension(measured?.width) ??
    resolveNodeMeasuredDimension(node.width)
  const height =
    resolveNodeMeasuredDimension(measured?.height) ??
    resolveNodeMeasuredDimension(node.height)
  return width !== null && height !== null
}

export function useWorkspaceCanvasFitEffects({
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
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
  visibleNodeIds: string[]
  tutorialSceneFitActive: boolean
  didInitialFitRef: MutableRefObject<boolean>
  previousVisibleNodeCountRef: MutableRefObject<number>
  handledLayoutFitRequestKeyRef: MutableRefObject<number>
  layoutFitRequestKey: number
  layoutFitOptions: WorkspaceCanvasCameraFitOptions
  sceneFitOptions: WorkspaceCanvasCameraFitOptions
  acceleratorFocusOptions: WorkspaceCanvasCameraFitOptions
  focusCardOptions: WorkspaceCanvasCameraFitOptions
  suppressInitialFit?: boolean
}) {
  useEffect(() => {
    if (suppressInitialFit) return
    if (tutorialSceneFitActive) return
    if (!isFlowReady) return
    if (didInitialFitRef.current) return
    if (visibleNodeIds.length === 0) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return

    didInitialFitRef.current = true
    return scheduleDoubleFrame(() => {
      const result = executeWorkspaceCanvasViewportCommand({
        flowInstance,
        command: {
          kind: "fit-visible",
          nodeIds: visibleNodeIds,
        },
        layoutFitOptions: {
          ...layoutFitOptions,
          duration: 0,
        },
        sceneFitOptions,
        focusCardOptions,
        acceleratorFocusOptions,
      })
      if (!result.executed) return
      logWorkspaceCanvasEvent(WORKSPACE_CANVAS_EVENTS.CAMERA_INITIAL_FIT, {
        nodeCount: result.nodeCount,
      })
    })
  }, [
    acceleratorFocusOptions,
    didInitialFitRef,
    flowInstanceRef,
    focusCardOptions,
    isFlowReady,
    layoutFitOptions,
    sceneFitOptions,
    suppressInitialFit,
    tutorialSceneFitActive,
    visibleNodeIds,
  ])

  useEffect(() => {
    const previousCount = previousVisibleNodeCountRef.current
    const nextCount = visibleNodeIds.length
    previousVisibleNodeCountRef.current = nextCount

    if (suppressInitialFit) return
    if (tutorialSceneFitActive) return
    if (!isFlowReady) return
    if (previousCount !== 0 || nextCount <= 0) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return

    return scheduleDoubleFrame(() => {
      const result = executeWorkspaceCanvasViewportCommand({
        flowInstance,
        command: {
          kind: "fit-visible",
          nodeIds: visibleNodeIds,
        },
        layoutFitOptions: {
          ...layoutFitOptions,
          duration: Math.max(160, layoutFitOptions.duration),
        },
        sceneFitOptions,
        focusCardOptions,
        acceleratorFocusOptions,
      })
      if (!result.executed) return
      logWorkspaceCanvasEvent(WORKSPACE_CANVAS_EVENTS.CAMERA_INITIAL_FIT, {
        nodeCount: result.nodeCount,
        reason: "visible_nodes_recovered",
      })
    })
  }, [
    acceleratorFocusOptions,
    flowInstanceRef,
    focusCardOptions,
    isFlowReady,
    layoutFitOptions,
    previousVisibleNodeCountRef,
    sceneFitOptions,
    suppressInitialFit,
    tutorialSceneFitActive,
    visibleNodeIds,
  ])

  useEffect(() => {
    if (tutorialSceneFitActive) return
    if (layoutFitRequestKey <= 0) return
    if (layoutFitRequestKey <= handledLayoutFitRequestKeyRef.current) return
    if (!isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return
    if (visibleNodeIds.length === 0) return

    handledLayoutFitRequestKeyRef.current = layoutFitRequestKey
    return scheduleDoubleFrame(() => {
      const result = executeWorkspaceCanvasViewportCommand({
        flowInstance,
        command: {
          kind: "fit-visible",
          nodeIds: visibleNodeIds,
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
          requestKey: layoutFitRequestKey,
          nodeCount: result.nodeCount,
        }
      )
    })
  }, [
    acceleratorFocusOptions,
    flowInstanceRef,
    focusCardOptions,
    handledLayoutFitRequestKeyRef,
    isFlowReady,
    layoutFitOptions,
    layoutFitRequestKey,
    sceneFitOptions,
    tutorialSceneFitActive,
    visibleNodeIds,
  ])
}

export function useWorkspaceCanvasFocusRequestEffects({
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
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
  visibleNodeIds: string[]
  tutorialSceneFitActive: boolean
  acceleratorFocusRequestKey: number
  handledAcceleratorFocusRequestKeyRef: MutableRefObject<number>
  focusCardRequest: WorkspaceCanvasCardFocusRequest
  handledFocusCardRequestKeyRef: MutableRefObject<number>
  layoutFitOptions: WorkspaceCanvasCameraFitOptions
  sceneFitOptions: WorkspaceCanvasCameraFitOptions
  acceleratorFocusOptions: WorkspaceCanvasCameraFitOptions
  focusCardOptions: WorkspaceCanvasCameraFitOptions
}) {
  useEffect(() => {
    if (tutorialSceneFitActive) return
    if (acceleratorFocusRequestKey <= 0) return
    if (
      acceleratorFocusRequestKey <= handledAcceleratorFocusRequestKeyRef.current
    ) {
      return
    }
    if (!isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return
    if (!visibleNodeIds.includes("accelerator")) return

    handledAcceleratorFocusRequestKeyRef.current = acceleratorFocusRequestKey
    return scheduleDoubleFrame(() => {
      const result = executeWorkspaceCanvasViewportCommand({
        flowInstance,
        command: {
          kind: "fit-nodes",
          nodeIds: ["accelerator", ACCELERATOR_STEP_NODE_ID],
          options: "accelerator-focus",
        },
        layoutFitOptions,
        sceneFitOptions,
        focusCardOptions,
        acceleratorFocusOptions,
      })
      if (!result.executed) return
      logWorkspaceCanvasEvent(
        WORKSPACE_CANVAS_EVENTS.CAMERA_ACCELERATOR_FOCUS_REQUEST,
        {
          requestKey: acceleratorFocusRequestKey,
          nodeCount: result.nodeCount,
        }
      )
    })
  }, [
    acceleratorFocusOptions,
    acceleratorFocusRequestKey,
    flowInstanceRef,
    focusCardOptions,
    handledAcceleratorFocusRequestKeyRef,
    isFlowReady,
    layoutFitOptions,
    sceneFitOptions,
    tutorialSceneFitActive,
    visibleNodeIds,
  ])

  useEffect(() => {
    if (tutorialSceneFitActive) return
    if (!focusCardRequest) return
    if (focusCardRequest.requestKey <= 0) return
    if (focusCardRequest.requestKey <= handledFocusCardRequestKeyRef.current) {
      return
    }
    if (!isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return
    if (!visibleNodeIds.includes(focusCardRequest.cardId)) return

    handledFocusCardRequestKeyRef.current = focusCardRequest.requestKey
    return scheduleDoubleFrame(() => {
      const result = executeWorkspaceCanvasViewportCommand({
        flowInstance,
        command: {
          kind: "focus-card",
          cardId: focusCardRequest.cardId,
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
          requestKey: focusCardRequest.requestKey,
          cardId: focusCardRequest.cardId,
          nodeCount: result.nodeCount,
          reason: "focus_card",
        }
      )
    })
  }, [
    acceleratorFocusOptions,
    focusCardOptions,
    focusCardRequest,
    flowInstanceRef,
    handledFocusCardRequestKeyRef,
    isFlowReady,
    layoutFitOptions,
    sceneFitOptions,
    tutorialSceneFitActive,
    visibleNodeIds,
  ])
}
