import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type OnNodeDrag } from "@xyflow/react"

import {
  type WorkspaceCanvasTutorialNodeData,
  type WorkspaceCanvasTutorialPresentationMaskLayout,
  clampWorkspaceCanvasTutorialStepIndex,
  resolveWorkspaceCanvasTutorialVisibleCardIds,
} from "@/features/workspace-canvas-tutorial"

import type { WorkspaceBoardState } from "../../workspace-board-types"
import { type WorkspaceCardId } from "../../workspace-board-types"
import { useWorkspaceCanvasTutorialVisibility } from "./workspace-canvas-surface-v2-hooks"
import {
  resolveWorkspaceCanvasTutorialSceneBreakpoint,
  type WorkspaceCanvasTutorialSceneBreakpoint,
} from "./workspace-canvas-surface-v2-onboarding-scenes"
import {
  WORKSPACE_CANVAS_TUTORIAL_NODE_ID,
  resolveWorkspaceCanvasTutorialRuntime,
  resolveWorkspaceCanvasTutorialSceneSignature,
} from "./workspace-canvas-surface-v2-tutorial-runtime"
import { resolveWorkspaceCanvasPresentationPlan } from "../runtime/workspace-canvas-presentation-engine"

function readViewportWidth() {
  return typeof window === "undefined" ? 1440 : window.innerWidth
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

export function useWorkspaceCanvasTutorialScene({
  boardState,
  onPrevious,
  onNext,
  acceleratorModuleViewerOpen = false,
}: {
  boardState: WorkspaceBoardState
  onPrevious: () => void
  onNext: () => void
  acceleratorModuleViewerOpen?: boolean
}) {
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth)
  const [tutorialNodeDragOverride, setTutorialNodeDragOverride] = useState<{
    x: number
    y: number
  } | null>(null)
  const [tutorialPresentationMaskLayout, setTutorialPresentationMaskLayout] =
    useState<WorkspaceCanvasTutorialPresentationMaskLayout | null>(null)
  const [tutorialLayoutAnimating, setTutorialLayoutAnimating] = useState(false)
  const previousSceneSignatureRef = useRef<string | null>(null)
  const previousStepIndexRef = useRef<number | null>(null)
  const previousBreakpointRef = useRef<WorkspaceCanvasTutorialSceneBreakpoint | null>(
    null,
  )
  const {
    tutorialActive,
    tutorialSelectedCardId,
    emptyStateMessage,
  } = useWorkspaceCanvasTutorialVisibility({
    boardState,
  })
  const prefersReducedMotion = usePrefersReducedMotion()
  const tutorialStepIndex = clampWorkspaceCanvasTutorialStepIndex(
    boardState.onboardingFlow.tutorialStepIndex,
  )
  const tutorialBreakpoint = useMemo<WorkspaceCanvasTutorialSceneBreakpoint>(
    () => resolveWorkspaceCanvasTutorialSceneBreakpoint(viewportWidth),
    [viewportWidth],
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!tutorialActive) {
      previousSceneSignatureRef.current = null
      previousStepIndexRef.current = null
      previousBreakpointRef.current = null
      setTutorialNodeDragOverride(null)
      setTutorialPresentationMaskLayout(null)
      setTutorialLayoutAnimating(false)
    }
  }, [tutorialActive])

  const tutorialSceneSignature = useMemo(
    () =>
      resolveWorkspaceCanvasTutorialSceneSignature({
        tutorialActive,
        tutorialStepIndex,
        openedTutorialStepIds: boardState.onboardingFlow.openedTutorialStepIds,
        breakpoint: tutorialBreakpoint,
      }),
    [
      boardState.onboardingFlow.openedTutorialStepIds,
      tutorialActive,
      tutorialBreakpoint,
      tutorialStepIndex,
    ],
  )
  const tutorialVisibleCardIds = useMemo(
    () =>
      resolveWorkspaceCanvasTutorialVisibleCardIds(
        tutorialStepIndex,
        boardState.onboardingFlow.openedTutorialStepIds,
      ) as WorkspaceCardId[],
    [
      boardState.onboardingFlow.openedTutorialStepIds,
      tutorialStepIndex,
    ],
  )

  const tutorialRuntime = useMemo(
    () => {
      if (!tutorialActive) {
        return null
      }

      return resolveWorkspaceCanvasTutorialRuntime({
        tutorialStepIndex,
        openedTutorialStepIds: boardState.onboardingFlow.openedTutorialStepIds,
        visibleCardIds: tutorialVisibleCardIds,
        existingNodes: boardState.nodes,
        breakpoint: tutorialBreakpoint,
        acceleratorModuleViewerOpen,
      })
    },
    [
      acceleratorModuleViewerOpen,
      boardState.nodes,
      boardState.onboardingFlow.openedTutorialStepIds,
      tutorialActive,
      tutorialBreakpoint,
      tutorialStepIndex,
      tutorialVisibleCardIds,
    ],
  )
  const tutorialTransitionPlan = useMemo(
    () =>
      resolveWorkspaceCanvasPresentationPlan({
        tutorialActive,
        previousStepIndex: previousStepIndexRef.current,
        tutorialStepIndex,
        openedTutorialStepIds: boardState.onboardingFlow.openedTutorialStepIds,
        prefersReducedMotion,
        tutorialNodeAttached: tutorialRuntime?.tutorialNodeAttached ?? false,
        tutorialSelectedCardId,
        visibleCardIds: tutorialVisibleCardIds,
      }),
    [
      boardState.onboardingFlow.openedTutorialStepIds,
      prefersReducedMotion,
      tutorialActive,
      tutorialRuntime?.tutorialNodeAttached,
      tutorialSelectedCardId,
      tutorialStepIndex,
      tutorialVisibleCardIds,
    ],
  )

  useEffect(() => {
    if (!tutorialActive || !tutorialSceneSignature) return

    const previousSignature = previousSceneSignatureRef.current
    const previousStepIndex = previousStepIndexRef.current
    const previousBreakpoint = previousBreakpointRef.current

    previousSceneSignatureRef.current = tutorialSceneSignature
    previousStepIndexRef.current = tutorialStepIndex
    previousBreakpointRef.current = tutorialBreakpoint

    if (!previousSignature || previousSignature === tutorialSceneSignature) {
      return
    }

    const didStepChange = previousStepIndex !== tutorialStepIndex
    const didBreakpointChange = previousBreakpoint !== tutorialBreakpoint

    if (didStepChange || didBreakpointChange) {
      setTutorialNodeDragOverride(null)
    }

    setTutorialLayoutAnimating(false)
    return
  }, [
    tutorialActive,
    tutorialBreakpoint,
    tutorialSceneSignature,
    tutorialStepIndex,
    tutorialTransitionPlan,
  ])

  const handleTutorialNodeDragStop = useCallback<OnNodeDrag>(
    (_, node) => {
      if (!tutorialActive) return
      if (node.id !== WORKSPACE_CANVAS_TUTORIAL_NODE_ID) return

      setTutorialLayoutAnimating(false)
      setTutorialNodeDragOverride({
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      })
    },
    [tutorialActive],
  )

  const handleTutorialPresentationMaskLayoutChange = useCallback(
    (layout: WorkspaceCanvasTutorialPresentationMaskLayout | null) => {
      setTutorialPresentationMaskLayout((current: WorkspaceCanvasTutorialPresentationMaskLayout | null) => {
        if (
          current?.cardId === layout?.cardId &&
          current?.x === layout?.x &&
          current?.y === layout?.y &&
          current?.width === layout?.width &&
          current?.height === layout?.height
        ) {
          return current
        }

        return layout
      })
    },
    [],
  )

  const tutorialNodeData = useMemo(() => {
    if (!tutorialActive || !tutorialRuntime) return null

    const data: WorkspaceCanvasTutorialNodeData = {
      stepIndex: tutorialStepIndex,
      openedStepIds: boardState.onboardingFlow.openedTutorialStepIds,
      attached: tutorialRuntime.tutorialNodeAttached,
      dragEnabled: false,
      variant:
        tutorialTransitionPlan.shellMode === "guided-shell"
          ? "attached"
          : "welcome",
      onPresentationMaskLayoutChange: handleTutorialPresentationMaskLayoutChange,
      onPrevious,
      onNext,
    }

    return {
      id: WORKSPACE_CANVAS_TUTORIAL_NODE_ID,
      type: "workspace-tutorial" as const,
      position: tutorialNodeDragOverride ?? tutorialRuntime.tutorialNodePosition,
      zIndex: 20,
      draggable: false,
      selectable: false,
      className: "workspace-tutorial-node select-none",
      style: tutorialRuntime.tutorialNodeStyle,
      data,
    }
  }, [
    boardState.onboardingFlow.openedTutorialStepIds,
    handleTutorialPresentationMaskLayoutChange,
    onNext,
    onPrevious,
    tutorialActive,
    tutorialNodeDragOverride,
    tutorialRuntime,
    tutorialStepIndex,
    tutorialTransitionPlan.shellMode,
  ])

  return {
    tutorialActive,
    tutorialSelectedCardId,
    tutorialNodeData,
    tutorialEdgeTargetId: tutorialRuntime?.tutorialEdgeTargetCardId ?? null,
    tutorialSceneCardPositionOverrides:
      tutorialRuntime?.cardPositionOverrides ?? null,
    tutorialScenePrimaryCardId: tutorialRuntime?.primaryCardId ?? null,
    tutorialSceneGuideGap: tutorialRuntime?.guideGap ?? 0,
    tutorialSceneBreakpoint: tutorialBreakpoint,
    tutorialSceneCameraViewport: tutorialRuntime?.cameraViewport
      ? {
          ...tutorialRuntime.cameraViewport,
          delayMs: tutorialTransitionPlan.cameraDelayMs,
          duration:
            tutorialTransitionPlan.cameraDurationMs > 0
              ? tutorialTransitionPlan.cameraDurationMs
              : tutorialRuntime.cameraViewport.duration,
        }
      : null,
    tutorialSceneNodeIds: tutorialRuntime?.sceneNodeIds ?? [],
    tutorialPresentationMaskLayout,
    tutorialSceneSignature,
    tutorialLayoutAnimating,
    emptyStateMessage,
    handleTutorialNodeDragStop,
  }
}
