"use client"

import { Position } from "@xyflow/react"

import type {
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorStepKind,
} from "@/features/workspace-accelerator-card"

import { resolveWorkspaceAcceleratorStepPlacement } from "./workspace-board-accelerator-step-layout"
import { resolveCardDimensions } from "./workspace-board-layout"
import type { WorkspaceBoardAcceleratorStepNodeData } from "./workspace-board-node"
import type {
  WorkspaceAutoLayoutMode,
  WorkspaceBoardState,
} from "./workspace-board-types"
import type { WorkspaceFlowNode } from "./workspace-board-flow-node-types"

export const ACCELERATOR_STEP_NODE_ID = "accelerator-active-step-node"

type AcceleratorStepNodeDimensions = { width: number; height: number }
const COMPACT_ASSIGNMENT_FIELD_TYPES = new Set([
  "select",
  "short_text",
  "multi_select",
  "slider",
])

export const ACCELERATOR_STEP_NODE_DIMENSIONS: Record<
  | WorkspaceAcceleratorStepKind
  | "default"
  | "assignmentCompact"
  | "assignmentExpanded"
  | "assignmentWithBudget",
  AcceleratorStepNodeDimensions
> = {
  default: { width: 520, height: 360 },
  lesson: { width: 520, height: 360 },
  video: { width: 600, height: 440 },
  resources: { width: 540, height: 360 },
  assignmentCompact: { width: 580, height: 340 },
  assignment: { width: 760, height: 420 },
  assignmentExpanded: { width: 920, height: 560 },
  assignmentWithBudget: { width: 1180, height: 720 },
  deck: { width: 520, height: 520 },
  complete: { width: 560, height: 360 },
}

function resolveAcceleratorStepNodeDimensions(
  stepKind: WorkspaceAcceleratorStepKind,
  assignmentFields: Array<{ type: string }>,
  workspaceOnboardingView?: "welcome" | "organization-setup" | null,
) {
  if (workspaceOnboardingView === "organization-setup") {
    return ACCELERATOR_STEP_NODE_DIMENSIONS.assignmentExpanded
  }

  if (workspaceOnboardingView === "welcome") {
    return ACCELERATOR_STEP_NODE_DIMENSIONS.video
  }

  if (stepKind === "assignment") {
    const hasBudgetTableField = assignmentFields.some(
      (field) => field.type === "budget_table",
    )
    if (hasBudgetTableField) {
      return ACCELERATOR_STEP_NODE_DIMENSIONS.assignmentWithBudget
    }

    const hasCompactAssignmentShape =
      assignmentFields.length > 0 &&
      assignmentFields.length <= 2 &&
      assignmentFields.every((field) =>
        COMPACT_ASSIGNMENT_FIELD_TYPES.has(field.type),
      )
    if (hasCompactAssignmentShape) {
      return ACCELERATOR_STEP_NODE_DIMENSIONS.assignmentCompact
    }

    const hasExpandedAssignmentField = assignmentFields.some(
      (field) =>
        field.type === "long_text" || field.type === "custom_program",
    )

    if (hasExpandedAssignmentField) {
      return ACCELERATOR_STEP_NODE_DIMENSIONS.assignmentExpanded
    }

    return ACCELERATOR_STEP_NODE_DIMENSIONS.assignment
  }
  return (
    ACCELERATOR_STEP_NODE_DIMENSIONS[stepKind] ??
    ACCELERATOR_STEP_NODE_DIMENSIONS.default
  )
}

export function buildAcceleratorStepNodeData({
  acceleratorRuntimeSnapshot,
  acceleratorStepNodePositionOverride,
  acceleratorStepNodeVisible,
  autoLayoutMode,
  allowEditing,
  acceleratorWorkspaceNode,
  isCanvasFullscreen,
  presentationMode,
  onPrevious,
  onNext,
  onComplete,
  onClose,
  tutorialCallout,
  onWorkspaceOnboardingSubmit,
}: {
  acceleratorRuntimeSnapshot: WorkspaceAcceleratorCardRuntimeSnapshot | null
  acceleratorStepNodePositionOverride: { x: number; y: number } | null
  acceleratorStepNodeVisible: boolean
  autoLayoutMode: WorkspaceAutoLayoutMode
  allowEditing: boolean
  acceleratorWorkspaceNode: WorkspaceBoardState["nodes"][number] | null
  isCanvasFullscreen: boolean
  presentationMode: boolean
  onPrevious: () => void
  onNext: () => void
  onComplete: () => void
  onClose: () => void
  tutorialCallout?: WorkspaceBoardAcceleratorStepNodeData["tutorialCallout"]
  onWorkspaceOnboardingSubmit?: (form: FormData) => Promise<void>
}): WorkspaceFlowNode | null {
  const runtimeStep = acceleratorRuntimeSnapshot?.currentStep
  if (!runtimeStep) return null
  if (!acceleratorWorkspaceNode) return null
  if (!acceleratorStepNodeVisible || isCanvasFullscreen) return null

  const sourceDimensions = resolveCardDimensions(
    acceleratorWorkspaceNode.size,
    acceleratorWorkspaceNode.id,
  )
  const stepDimensions = resolveAcceleratorStepNodeDimensions(
    runtimeStep.stepKind,
    runtimeStep.moduleContext?.assignmentFields ?? [],
    runtimeStep.moduleContext?.workspaceOnboarding?.view ?? null,
  )
  const placement = resolveWorkspaceAcceleratorStepPlacement(autoLayoutMode)
  const positionX =
    placement === "above"
      ? acceleratorWorkspaceNode.x +
        (sourceDimensions.width - stepDimensions.width) / 2
      : acceleratorWorkspaceNode.x + sourceDimensions.width + 56
  const positionY =
    placement === "above"
      ? acceleratorWorkspaceNode.y - stepDimensions.height - 56
      : acceleratorWorkspaceNode.y +
        Math.max(0, (sourceDimensions.height - stepDimensions.height) / 2)
  const position = acceleratorStepNodePositionOverride ?? {
    x: positionX,
    y: positionY,
  }

  return {
    id: ACCELERATOR_STEP_NODE_ID,
    type: "accelerator-step",
    position,
    draggable: allowEditing && !isCanvasFullscreen,
    dragHandle:
      allowEditing && !isCanvasFullscreen
        ? ".accelerator-step-node-drag-handle"
        : undefined,
    selectable: false,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    className: "h-auto select-none",
    style: {
      width: stepDimensions.width,
      minHeight: stepDimensions.height,
    },
    data: {
      step: runtimeStep,
      placeholderVideoUrl: acceleratorRuntimeSnapshot.placeholderVideoUrl ?? null,
      placement,
      stepIndex: Math.max(
        acceleratorRuntimeSnapshot.currentModuleStepIndex,
        0,
      ),
      stepTotal: Math.max(
        acceleratorRuntimeSnapshot.currentModuleStepTotal,
        1,
      ),
      canGoPrevious: acceleratorRuntimeSnapshot.canGoPrevious,
      canGoNext: acceleratorRuntimeSnapshot.canGoNext,
      completed: acceleratorRuntimeSnapshot.isCurrentStepCompleted,
      moduleCompleted: acceleratorRuntimeSnapshot.isCurrentModuleCompleted,
      onPrevious,
      onNext,
      onComplete,
      onClose,
      presentationMode,
      tutorialCallout: tutorialCallout ?? null,
      onWorkspaceOnboardingSubmit: onWorkspaceOnboardingSubmit,
    },
  }
}
