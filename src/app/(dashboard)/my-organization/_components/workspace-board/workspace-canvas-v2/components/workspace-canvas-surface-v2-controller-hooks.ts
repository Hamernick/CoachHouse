"use client"

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
} from "react"
import { type OnNodeDrag } from "@xyflow/react"

import {
  resolveWorkspaceCanvasTutorialCallout,
  resolveWorkspaceCanvasTutorialContinueMode,
} from "@/features/workspace-canvas-tutorial"

import { WORKSPACE_CANVAS_EVENTS } from "../contracts/workspace-canvas-events"
import { logWorkspaceCanvasEvent } from "../runtime/workspace-canvas-logger"
import type { WorkspaceCanvasSceneFitRequest } from "../runtime/workspace-canvas-viewport-command"
import { useWorkspaceCardShortcutItems } from "./workspace-canvas-surface-v2-hooks"
import type { WorkspaceCanvasSurfaceV2Props } from "./workspace-canvas-surface-v2-types"
import {
  isWorkspaceCanvasV2CardId,
  type WorkspaceCanvasV2CardId,
} from "./workspace-canvas-surface-v2-helpers"
import { ACCELERATOR_STEP_NODE_ID } from "../../workspace-board-flow-surface-accelerator-graph-composition"
import type {
  WorkspaceBoardState,
  WorkspaceCardId,
} from "../../workspace-board-types"
import type { WorkspaceBoardToggleContext } from "../../workspace-board-debug"
import { shouldWorkspaceTutorialCardSnapToDock } from "./workspace-canvas-surface-v2-tutorial-docking"

const WORKSPACE_CANVAS_TUTORIAL_NODE_ID = "workspace-canvas-tutorial"

export function useWorkspaceCanvasNodeDragStop({
  allowEditing,
  tutorialActive,
  boardNodeLookup,
  onPersistNodePosition,
  setAcceleratorStepNodePositionOverride,
  setTutorialCardPositionOverrides,
  setTutorialUndockedCardIds,
  tutorialDockTargets,
  onTutorialNodeDragStop,
}: {
  allowEditing: boolean
  tutorialActive: boolean
  boardNodeLookup: Map<string, { x: number; y: number }>
  onPersistNodePosition: WorkspaceCanvasSurfaceV2Props["onPersistNodePosition"]
  setAcceleratorStepNodePositionOverride: Dispatch<
    SetStateAction<{ x: number; y: number } | null>
  >
  setTutorialCardPositionOverrides: Dispatch<
    SetStateAction<
      Partial<Record<WorkspaceCanvasV2CardId, { x: number; y: number }>>
    >
  >
  setTutorialUndockedCardIds: Dispatch<
    SetStateAction<WorkspaceCanvasV2CardId[]>
  >
  tutorialDockTargets: Partial<
    Record<
      WorkspaceCanvasV2CardId,
      { x: number; y: number; snapRadius: number }
    >
  >
  onTutorialNodeDragStop: OnNodeDrag
}) {
  return useCallback<OnNodeDrag>(
    (event, node, nodes) => {
      if (node.id === WORKSPACE_CANVAS_TUTORIAL_NODE_ID) {
        onTutorialNodeDragStop(event, node, nodes)
        return
      }

      if (node.id === ACCELERATOR_STEP_NODE_ID) {
        if (!allowEditing) return
        const nextX = Math.round(node.position.x)
        const nextY = Math.round(node.position.y)
        setAcceleratorStepNodePositionOverride((previous) => {
          if (previous?.x === nextX && previous?.y === nextY) {
            return previous
          }
          return { x: nextX, y: nextY }
        })
        return
      }
      if (!isWorkspaceCanvasV2CardId(node.id)) return

      const tutorialCardId = node.id
      const nextX = Math.round(node.position.x)
      const nextY = Math.round(node.position.y)
      if (tutorialActive) {
        const dockTarget = tutorialDockTargets[tutorialCardId]
        const shouldSnap =
          dockTarget &&
          shouldWorkspaceTutorialCardSnapToDock({
            position: { x: nextX, y: nextY },
            dockTarget,
          })

        setTutorialUndockedCardIds((previous) => {
          if (shouldSnap) {
            return previous.filter((cardId) => cardId !== tutorialCardId)
          }

          return previous.includes(tutorialCardId)
            ? previous
            : [...previous, tutorialCardId]
        })
        setTutorialCardPositionOverrides((previous) => {
          if (shouldSnap) {
            if (!(tutorialCardId in previous)) {
              return previous
            }

            const next = { ...previous }
            delete next[tutorialCardId]
            return next
          }

          const current = previous[tutorialCardId]
          if (current?.x === nextX && current?.y === nextY) {
            return previous
          }
          return {
            ...previous,
            [tutorialCardId]: { x: nextX, y: nextY },
          }
        })
        return
      }
      if (!allowEditing) return
      const previous = boardNodeLookup.get(node.id)
      if (!previous) return
      if (previous.x === nextX && previous.y === nextY) return

      onPersistNodePosition(node.id, nextX, nextY)
      logWorkspaceCanvasEvent(WORKSPACE_CANVAS_EVENTS.ORG_NODE_DRAG_STOP, {
        cardId: node.id,
        x: nextX,
        y: nextY,
      })
    },
    [
      allowEditing,
      boardNodeLookup,
      onTutorialNodeDragStop,
      onPersistNodePosition,
      setAcceleratorStepNodePositionOverride,
      setTutorialUndockedCardIds,
      setTutorialCardPositionOverrides,
      tutorialDockTargets,
      tutorialActive,
    ]
  )
}

export function useWorkspaceTutorialSceneFitRequest({
  tutorialActive,
  sceneSignature,
  sceneViewport,
  sceneNodeIds,
  sceneLayoutKey,
  sceneRequestSeed = 0,
}: {
  tutorialActive: boolean
  sceneSignature: string | null
  sceneViewport: {
    x: number
    y: number
    zoom: number
    duration: number
    delayMs?: number
  } | null
  sceneNodeIds: string[]
  sceneLayoutKey: string | null
  sceneRequestSeed?: number
}): WorkspaceCanvasSceneFitRequest {
  const requestStateRef = useRef<{
    requestKey: number
    signature: string | null
  }>({
    requestKey: 0,
    signature: null,
  })

  return useMemo(() => {
    if (!tutorialActive) {
      requestStateRef.current.signature = null
      return null
    }
    if (!sceneSignature || !sceneViewport || sceneNodeIds.length === 0) {
      return null
    }
    const requestSignature = [
      sceneSignature,
      sceneRequestSeed,
      sceneLayoutKey ?? "__scene-layout__",
      Math.round(sceneViewport.x),
      Math.round(sceneViewport.y),
      Math.round(sceneViewport.zoom * 1000),
      sceneViewport.duration,
      sceneViewport.delayMs ?? 0,
    ].join("::")
    if (requestStateRef.current.signature !== requestSignature) {
      requestStateRef.current = {
        requestKey: requestStateRef.current.requestKey + 1,
        signature: requestSignature,
      }
    }

    return {
      requestKey: requestStateRef.current.requestKey,
      signature: requestStateRef.current.signature ?? requestSignature,
      layoutKey: sceneLayoutKey ?? "__scene-layout__",
      nodeIds: sceneNodeIds,
      ...sceneViewport,
    }
  }, [
    sceneLayoutKey,
    sceneNodeIds,
    sceneRequestSeed,
    sceneSignature,
    sceneViewport,
    tutorialActive,
  ])
}

export function useWorkspaceTutorialAwareShortcutItems({
  boardState,
  visibleCardIds,
  tutorialActive,
  tutorialSelectedCardId,
  focusCardRequest,
  onToggleCardVisibility,
  onFocusCard,
  onTutorialShortcutOpened,
}: {
  boardState: WorkspaceBoardState
  visibleCardIds: WorkspaceCardId[]
  tutorialActive: boolean
  tutorialSelectedCardId: WorkspaceCardId | null
  focusCardRequest: WorkspaceCanvasSurfaceV2Props["focusCardRequest"]
  onToggleCardVisibility: WorkspaceCanvasSurfaceV2Props["onToggleCardVisibility"]
  onFocusCard: WorkspaceCanvasSurfaceV2Props["onFocusCard"]
  onTutorialShortcutOpened: WorkspaceCanvasSurfaceV2Props["onTutorialShortcutOpened"]
}) {
  const tutorialContinueMode = resolveWorkspaceCanvasTutorialContinueMode(
    boardState.onboardingFlow.tutorialStepIndex,
    boardState.onboardingFlow.openedTutorialStepIds
  )
  return useWorkspaceCardShortcutItems({
    hiddenCardIds: boardState.hiddenCardIds,
    visibleCardIds,
    selectedCardId: tutorialActive
      ? tutorialSelectedCardId
      : (focusCardRequest?.cardId ?? null),
    tutorialActive,
    tutorialStepIndex: boardState.onboardingFlow.tutorialStepIndex,
    openedTutorialStepIds: boardState.onboardingFlow.openedTutorialStepIds,
    onToggleCardVisibility: onToggleCardVisibility as (
      cardId: WorkspaceCardId,
      context?: WorkspaceBoardToggleContext
    ) => void,
    onFocusCard,
    onTutorialAdvance:
      tutorialActive && tutorialContinueMode === "shortcut"
        ? onTutorialShortcutOpened
        : null,
  })
}
