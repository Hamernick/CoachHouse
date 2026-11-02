"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type {
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
} from "@/features/workspace-accelerator-card"

import {
  ACCELERATOR_STEP_EDGE_ID,
  buildAcceleratorStepNodeData,
  buildWorkspaceEdges,
  buildWorkspaceNodes,
  type WorkspaceFlowNode,
  type WorkspaceFlowNodeData,
} from "./workspace-board-flow-surface-accelerator-graph-composition"
import {
  useWorkspaceBoardOnboardingGuide,
} from "./workspace-board-flow-surface-onboarding-guide"
import type {
  WorkspaceBoardAcceleratorState,
  WorkspaceBoardOnboardingFlowState,
  WorkspaceBoardState,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceCommunicationsState,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
  WorkspaceVaultViewMode,
} from "./workspace-board-types"

export {
  ACCELERATOR_STEP_EDGE_ID,
} from "./workspace-board-flow-surface-accelerator-graph-composition"
export type {
  WorkspaceFlowNodeData,
} from "./workspace-board-flow-surface-accelerator-graph-composition"

type UseWorkspaceBoardAcceleratorGraphArgs = {
  boardState: WorkspaceBoardState
  allowEditing: boolean
  presentationMode: boolean
  isCanvasFullscreen: boolean
  seed: WorkspaceSeedData
  organizationEditorData: WorkspaceOrganizationEditorData
  vaultViewMode: WorkspaceVaultViewMode
  onSizeChange: (cardId: WorkspaceCardId, size: WorkspaceCardSize) => void
  onCommunicationsChange: (next: WorkspaceCommunicationsState) => void
  onTrackerChange: (next: WorkspaceBoardState["tracker"]) => void
  onVaultViewModeChange: (next: WorkspaceVaultViewMode) => void
  onAcceleratorStateChange: (next: WorkspaceBoardAcceleratorState) => void
  onOpenAcceleratorStepNode: (stepId: string | null) => void
  onCloseAcceleratorStepNode: (source?: "dock" | "card" | "unknown") => void
  onOnboardingFlowChange: (next: WorkspaceBoardOnboardingFlowState) => void
  onToggleCanvasFullscreen: (cardId: WorkspaceCardId) => void
}

function buildRuntimeStepSignature(
  step: WorkspaceAcceleratorCardRuntimeSnapshot["currentStep"]
) {
  if (!step) return "null"
  return JSON.stringify({
    id: step.id,
    moduleId: step.moduleId,
    moduleTitle: step.moduleTitle,
    stepKind: step.stepKind,
    stepTitle: step.stepTitle,
    stepDescription: step.stepDescription,
    href: step.href,
    status: step.status,
    stepSequenceIndex: step.stepSequenceIndex,
    stepSequenceTotal: step.stepSequenceTotal,
    moduleSequenceIndex: step.moduleSequenceIndex,
    moduleSequenceTotal: step.moduleSequenceTotal,
    groupTitle: step.groupTitle,
    videoUrl: step.videoUrl,
    durationMinutes: step.durationMinutes,
    hasAssignment: step.hasAssignment,
    hasDeck: step.hasDeck,
    resourceIds: step.resources.map((resource) => resource.id),
  })
}

function areRuntimeSnapshotsEqual(
  left: WorkspaceAcceleratorCardRuntimeSnapshot | null,
  right: WorkspaceAcceleratorCardRuntimeSnapshot | null,
) {
  if (!left && !right) return true
  if (!left || !right) return false
  return (
    left.currentIndex === right.currentIndex &&
    left.totalSteps === right.totalSteps &&
    left.canGoPrevious === right.canGoPrevious &&
    left.canGoNext === right.canGoNext &&
    left.currentModuleStepIndex === right.currentModuleStepIndex &&
    left.currentModuleStepTotal === right.currentModuleStepTotal &&
    left.currentModuleCompletedCount === right.currentModuleCompletedCount &&
    left.isCurrentModuleCompleted === right.isCurrentModuleCompleted &&
    left.isCurrentStepCompleted === right.isCurrentStepCompleted &&
    left.selectedLessonGroupKey === right.selectedLessonGroupKey &&
    left.selectedLessonGroupLabel === right.selectedLessonGroupLabel &&
    JSON.stringify(left.lessonGroupOptions ?? []) ===
      JSON.stringify(right.lessonGroupOptions ?? []) &&
    left.firstVisibleChecklistStepId === right.firstVisibleChecklistStepId &&
    Boolean(left.isModuleViewerOpen) === Boolean(right.isModuleViewerOpen) &&
    (left.openModuleId ?? null) === (right.openModuleId ?? null) &&
    left.readinessSummary?.score === right.readinessSummary?.score &&
    buildRuntimeStepSignature(left.currentStep) ===
      buildRuntimeStepSignature(right.currentStep)
  )
}

export function useWorkspaceBoardAcceleratorGraph({
  boardState,
  allowEditing,
  presentationMode,
  isCanvasFullscreen,
  seed,
  organizationEditorData,
  vaultViewMode,
  onSizeChange,
  onCommunicationsChange,
  onTrackerChange,
  onVaultViewModeChange,
  onAcceleratorStateChange,
  onOpenAcceleratorStepNode,
  onCloseAcceleratorStepNode,
  onOnboardingFlowChange,
  onToggleCanvasFullscreen,
}: UseWorkspaceBoardAcceleratorGraphArgs) {
  const acceleratorRuntimeActionsRef =
    useRef<WorkspaceAcceleratorCardRuntimeActions | null>(null)
  const [acceleratorRuntimeSnapshot, setAcceleratorRuntimeSnapshot] =
    useState<WorkspaceAcceleratorCardRuntimeSnapshot | null>(null)
  const acceleratorStepNodeVisible =
    boardState.acceleratorUi?.stepOpen === true
  const [acceleratorStepNodePositionOverride, setAcceleratorStepNodePositionOverride] =
    useState<{ x: number; y: number } | null>(null)

  const edgeStyle = useMemo(
    () =>
      presentationMode
        ? { strokeWidth: 1.1, opacity: 0.42 }
        : { strokeWidth: 1.35, opacity: 0.7 },
    [presentationMode]
  )

  const visibleWorkspaceNodes = useMemo(
    () => {
      const visible = boardState.nodes.filter(
        (node) => !boardState.hiddenCardIds.includes(node.id)
      )
      if (visible.length > 0) return visible

      // Safety fallback: if persisted visibility hides every card, still render
      // the core workspace surface so the canvas never boots as a blank screen.
      return boardState.nodes.filter(
        (node) => node.id !== "deck" && node.id !== "atlas"
      )
    },
    [boardState.hiddenCardIds, boardState.nodes]
  )

  const visibleEdgeCardIds = useMemo(
    () => new Set(visibleWorkspaceNodes.map((node) => node.id)),
    [visibleWorkspaceNodes]
  )

  const acceleratorWorkspaceNode = useMemo(
    () =>
      visibleWorkspaceNodes.find((node) => node.id === "accelerator") ??
      null,
    [visibleWorkspaceNodes]
  )

  const handleAcceleratorRuntimeChange = useCallback(
    (snapshot: WorkspaceAcceleratorCardRuntimeSnapshot) => {
      setAcceleratorRuntimeSnapshot((previous) =>
        areRuntimeSnapshotsEqual(previous, snapshot) ? previous : snapshot
      )
    },
    []
  )

  const handleAcceleratorRuntimeActionsChange = useCallback(
    (actions: WorkspaceAcceleratorCardRuntimeActions) => {
      acceleratorRuntimeActionsRef.current = actions
    },
    []
  )

  const handleOpenAcceleratorStepNode = useCallback((stepId?: string | null) => {
    onOpenAcceleratorStepNode(
      stepId ??
        acceleratorRuntimeSnapshot?.currentStep?.id ??
        boardState.accelerator.activeStepId ??
        null,
    )
  }, [
    acceleratorRuntimeSnapshot?.currentStep?.id,
    boardState.accelerator.activeStepId,
    onOpenAcceleratorStepNode,
  ])

  const handleHideAcceleratorStepNode = useCallback(() => {
    onCloseAcceleratorStepNode("card")
  }, [onCloseAcceleratorStepNode])

  const handleAcceleratorStepNodePositionChange = useCallback(
    (x: number, y: number) => {
      setAcceleratorStepNodePositionOverride({ x, y })
    },
    []
  )

  const { onboardingGuideNodeData, onboardingTargetWorkspaceNode } =
    useWorkspaceBoardOnboardingGuide({
      boardState,
      visibleWorkspaceNodes,
      seed,
      isCanvasFullscreen,
      presentationMode,
      acceleratorStepNodeVisible,
      acceleratorCurrentStepHref: acceleratorRuntimeSnapshot?.currentStep?.href ?? null,
      onOpenAcceleratorStepNode: handleOpenAcceleratorStepNode,
      onOnboardingFlowChange,
    })

  const handleAcceleratorStepPrevious = useCallback(() => {
    acceleratorRuntimeActionsRef.current?.goPrevious()
  }, [])

  const handleAcceleratorStepNext = useCallback(() => {
    acceleratorRuntimeActionsRef.current?.goNext()
  }, [])

  const handleAcceleratorStepComplete = useCallback(async () => {
    const actions = acceleratorRuntimeActionsRef.current
    if (!actions) return
    if (!(await actions.markCurrentStepComplete())) return
    actions.goNext()
    onCloseAcceleratorStepNode("card")
  }, [onCloseAcceleratorStepNode])

  useEffect(() => {
    if (!acceleratorWorkspaceNode && acceleratorStepNodePositionOverride !== null) {
      setAcceleratorStepNodePositionOverride(null)
    }
  }, [acceleratorStepNodePositionOverride, acceleratorWorkspaceNode])

  const acceleratorStepNodeData = useMemo<WorkspaceFlowNode | null>(() => {
    return buildAcceleratorStepNodeData({
      acceleratorRuntimeSnapshot,
      acceleratorStepNodePositionOverride,
      acceleratorStepNodeVisible,
      autoLayoutMode: boardState.autoLayoutMode,
      allowEditing,
      acceleratorWorkspaceNode,
      isCanvasFullscreen,
      presentationMode,
      onPrevious: handleAcceleratorStepPrevious,
      onNext: handleAcceleratorStepNext,
      onComplete: handleAcceleratorStepComplete,
      onClose: handleHideAcceleratorStepNode,
    })
  }, [
    acceleratorRuntimeSnapshot,
    acceleratorStepNodePositionOverride,
    acceleratorStepNodeVisible,
    boardState.autoLayoutMode,
    allowEditing,
    acceleratorWorkspaceNode,
    handleAcceleratorStepComplete,
    handleAcceleratorStepNext,
    handleAcceleratorStepPrevious,
    handleHideAcceleratorStepNode,
    isCanvasFullscreen,
    presentationMode,
  ])

  const edges = useMemo(() => {
    return buildWorkspaceEdges({
      connections: boardState.connections,
      visibleEdgeCardIds,
      edgeStyle,
      acceleratorStepNodeData,
      acceleratorWorkspaceNode,
      autoLayoutMode: boardState.autoLayoutMode,
      onboardingGuideNodeData,
      onboardingTargetWorkspaceNode,
      presentationMode,
      visibleWorkspaceNodes,
    })
  }, [
    boardState.connections,
    edgeStyle,
    visibleEdgeCardIds,
    acceleratorStepNodeData,
    acceleratorWorkspaceNode,
    boardState.autoLayoutMode,
    onboardingGuideNodeData,
    onboardingTargetWorkspaceNode,
    presentationMode,
    visibleWorkspaceNodes,
  ])

  const composedNodes = useMemo<WorkspaceFlowNode[]>(() => {
    return buildWorkspaceNodes({
      visibleWorkspaceNodes,
      acceleratorStepNodeData,
      onboardingGuideNodeData,
      allowEditing,
      isCanvasFullscreen,
      presentationMode,
      communications: boardState.communications,
      tracker: boardState.tracker,
      accelerator: boardState.accelerator,
      vaultViewMode,
      seed,
      organizationEditorData,
      onSizeChange,
      onCommunicationsChange,
      onTrackerChange,
      onVaultViewModeChange,
      onAcceleratorStateChange,
      acceleratorStepNodeVisible,
      onOpenAcceleratorStepNode: handleOpenAcceleratorStepNode,
      onHideAcceleratorStepNode: handleHideAcceleratorStepNode,
      onAcceleratorRuntimeChange: handleAcceleratorRuntimeChange,
      onAcceleratorRuntimeActionsChange: handleAcceleratorRuntimeActionsChange,
      onToggleCanvasFullscreen,
    })
  }, [
    acceleratorStepNodeData,
    acceleratorStepNodeVisible,
    allowEditing,
    boardState.communications,
    boardState.accelerator,
    boardState.tracker,
    vaultViewMode,
    handleAcceleratorRuntimeActionsChange,
    handleAcceleratorRuntimeChange,
    handleHideAcceleratorStepNode,
    handleOpenAcceleratorStepNode,
    isCanvasFullscreen,
    onboardingGuideNodeData,
    onCommunicationsChange,
    onSizeChange,
    onToggleCanvasFullscreen,
    onTrackerChange,
    onVaultViewModeChange,
    onAcceleratorStateChange,
    organizationEditorData,
    presentationMode,
    seed,
    visibleWorkspaceNodes,
  ])

  return {
    acceleratorStepNodeVisible,
    composedNodes,
    edges,
    handleAcceleratorStepNodePositionChange,
    handleAcceleratorRuntimeActionsChange,
    handleAcceleratorRuntimeChange,
    handleHideAcceleratorStepNode,
    handleOpenAcceleratorStepNode,
  }
}
