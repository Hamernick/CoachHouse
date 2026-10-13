"use client"

import { useCallback, useMemo } from "react"
import { Position, type Node } from "@xyflow/react"

import {
  getNextOnboardingStage,
  getPreviousOnboardingStage,
  WORKSPACE_ONBOARDING_STAGE_DEFINITIONS,
  WORKSPACE_ONBOARDING_STAGE_ORDER,
} from "./workspace-board-onboarding-flow"
import { WORKSPACE_CARD_META } from "./workspace-board-copy"
import { getWorkspaceAcceleratorPaywallPath } from "@/lib/workspace/routes"
import { resolveCardDimensions } from "./workspace-board-layout"
import type { WorkspaceBoardOnboardingNodeData } from "./workspace-board-onboarding-guide-node"
import type {
  WorkspaceBoardOnboardingFlowState,
  WorkspaceBoardState,
  WorkspaceSeedData,
} from "./workspace-board-types"

const ONBOARDING_GUIDE_NODE_ID = "workspace-onboarding-guide-node"

type UseWorkspaceBoardOnboardingGuideArgs = {
  boardState: WorkspaceBoardState
  visibleWorkspaceNodes: WorkspaceBoardState["nodes"]
  seed: WorkspaceSeedData
  isCanvasFullscreen: boolean
  presentationMode: boolean
  acceleratorStepNodeVisible: boolean
  acceleratorCurrentStepHref: string | null
  onOpenAcceleratorStepNode: () => void
  onOnboardingFlowChange: (next: WorkspaceBoardOnboardingFlowState) => void
}

export function useWorkspaceBoardOnboardingGuide({
  boardState,
  visibleWorkspaceNodes,
  seed,
  isCanvasFullscreen,
  presentationMode,
  acceleratorStepNodeVisible,
  acceleratorCurrentStepHref,
  onOpenAcceleratorStepNode,
  onOnboardingFlowChange,
}: UseWorkspaceBoardOnboardingGuideArgs): {
  onboardingGuideNodeData: Node<WorkspaceBoardOnboardingNodeData> | null
  onboardingTargetWorkspaceNode: WorkspaceBoardState["nodes"][number] | null
} {
  const activeOnboardingStage = boardState.onboardingFlow.active
    ? boardState.onboardingFlow.stage
    : null
  const onboardingStageDefinition = activeOnboardingStage
    ? WORKSPACE_ONBOARDING_STAGE_DEFINITIONS[activeOnboardingStage]
    : null

  const onboardingTargetWorkspaceNode = useMemo(() => {
    if (!onboardingStageDefinition) return null
    return (
      visibleWorkspaceNodes.find(
        (node) => node.id === onboardingStageDefinition.targetCardId
      ) ?? null
    )
  }, [onboardingStageDefinition, visibleWorkspaceNodes])

  const onboardingGuidePosition = useMemo(() => {
    if (!onboardingStageDefinition) return null
    if (visibleWorkspaceNodes.length === 0) return null

    const dimensions = { width: 420, height: 340 }
    const aggregate = visibleWorkspaceNodes.reduce(
      (accumulator, node) => {
        const nodeDimensions = resolveCardDimensions(node.size, node.id)
        return {
          x: accumulator.x + node.x + nodeDimensions.width / 2,
          y: accumulator.y + node.y + nodeDimensions.height / 2,
        }
      },
      { x: 0, y: 0 }
    )
    const centerX = aggregate.x / visibleWorkspaceNodes.length
    const centerY = aggregate.y / visibleWorkspaceNodes.length

    return {
      x: Math.round(centerX - dimensions.width / 2),
      y: Math.round(centerY - dimensions.height / 2),
      width: dimensions.width,
      height: dimensions.height,
    }
  }, [onboardingStageDefinition, visibleWorkspaceNodes])

  const handleOnboardingDismiss = useCallback(() => {
    onOnboardingFlowChange({
      ...boardState.onboardingFlow,
      active: false,
      updatedAt: new Date().toISOString(),
    })
  }, [boardState.onboardingFlow, onOnboardingFlowChange])

  const handleOnboardingPrimaryAction = useCallback(() => {
    if (!activeOnboardingStage) return
    if (activeOnboardingStage === 3) {
      onOpenAcceleratorStepNode()
    }
  }, [activeOnboardingStage, onOpenAcceleratorStepNode])

  const handleOnboardingPrevious = useCallback(() => {
    if (!activeOnboardingStage) return
    const previousStage = getPreviousOnboardingStage(activeOnboardingStage)
    if (!previousStage) return

    onOnboardingFlowChange({
      ...boardState.onboardingFlow,
      active: true,
      stage: previousStage,
      updatedAt: new Date().toISOString(),
    })
  }, [activeOnboardingStage, boardState.onboardingFlow, onOnboardingFlowChange])

  const handleOnboardingNext = useCallback(() => {
    if (!activeOnboardingStage) return
    const nextStage = getNextOnboardingStage(activeOnboardingStage)
    const completedSet = new Set(boardState.onboardingFlow.completedStages)
    completedSet.add(activeOnboardingStage)
    const completedStages = WORKSPACE_ONBOARDING_STAGE_ORDER.filter((stage) =>
      completedSet.has(stage)
    )

    if (!nextStage) {
      onOnboardingFlowChange({
        ...boardState.onboardingFlow,
        active: false,
        stage: activeOnboardingStage,
        completedStages,
        updatedAt: new Date().toISOString(),
      })
      return
    }

    onOnboardingFlowChange({
      ...boardState.onboardingFlow,
      active: true,
      stage: nextStage,
      completedStages,
      updatedAt: new Date().toISOString(),
    })
  }, [activeOnboardingStage, boardState.onboardingFlow, onOnboardingFlowChange])

  const onboardingGuideNodeData = useMemo<Node<WorkspaceBoardOnboardingNodeData> | null>(() => {
    if (!activeOnboardingStage) return null
    if (!onboardingStageDefinition || !onboardingGuidePosition) return null
    if (isCanvasFullscreen || presentationMode) return null

    const acceleratorPaywallHref = getWorkspaceAcceleratorPaywallPath()
    const fallbackAcceleratorHref = seed.hasAcceleratorAccess
      ? acceleratorCurrentStepHref ?? "/accelerator"
      : acceleratorPaywallHref
    const primaryHref =
      activeOnboardingStage === 4
        ? fallbackAcceleratorHref
        : onboardingStageDefinition.primaryHref
    const canCompleteStage =
      activeOnboardingStage === 3 ? acceleratorStepNodeVisible : true
    const targetLabel = WORKSPACE_CARD_META[onboardingStageDefinition.targetCardId].title
    const stageIndex = WORKSPACE_ONBOARDING_STAGE_ORDER.indexOf(
      activeOnboardingStage
    )

    return {
      id: ONBOARDING_GUIDE_NODE_ID,
      type: "onboarding-guide",
      position: { x: onboardingGuidePosition.x, y: onboardingGuidePosition.y },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      className: "select-none",
      style: {
        width: onboardingGuidePosition.width,
        height: onboardingGuidePosition.height,
        minHeight: onboardingGuidePosition.height,
      },
      data: {
        stage: activeOnboardingStage,
        completedStages: boardState.onboardingFlow.completedStages,
        stageIndex: Math.max(stageIndex, 0),
        stageTotal: WORKSPACE_ONBOARDING_STAGE_ORDER.length,
        targetLabel,
        primaryLabel: onboardingStageDefinition.primaryLabel,
        primaryHref,
        canGoPrevious: Boolean(getPreviousOnboardingStage(activeOnboardingStage)),
        canGoNext: Boolean(getNextOnboardingStage(activeOnboardingStage)),
        canCompleteStage,
        onPrimaryAction: handleOnboardingPrimaryAction,
        onPrevious: handleOnboardingPrevious,
        onNext: handleOnboardingNext,
        onDismiss: handleOnboardingDismiss,
      },
    }
  }, [
    activeOnboardingStage,
    acceleratorCurrentStepHref,
    acceleratorStepNodeVisible,
    boardState.onboardingFlow.completedStages,
    handleOnboardingDismiss,
    handleOnboardingNext,
    handleOnboardingPrevious,
    handleOnboardingPrimaryAction,
    isCanvasFullscreen,
    onboardingGuidePosition,
    onboardingStageDefinition,
    presentationMode,
    seed.hasAcceleratorAccess,
  ])

  return {
    onboardingGuideNodeData,
    onboardingTargetWorkspaceNode,
  }
}

export const WORKSPACE_ONBOARDING_GUIDE_NODE_ID = ONBOARDING_GUIDE_NODE_ID
