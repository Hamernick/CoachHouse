"use client"

import { Position, type Edge } from "@xyflow/react"

import type {
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
} from "@/features/workspace-accelerator-card"

import {
  resolveWorkspaceAcceleratorStepEdgeHandles,
} from "./workspace-board-accelerator-step-layout"
import { ACCELERATOR_STEP_NODE_ID } from "./workspace-board-accelerator-step-node-data"
import {
  buildWorkspaceCardEdgeGeometryLookupFromBoardNodes,
  resolveWorkspaceCardConnectionHandleIds,
} from "./workspace-board-connection-handles"
import { resolveWorkspaceCardNodeStyle } from "./workspace-board-layout"
import { WORKSPACE_ONBOARDING_GUIDE_NODE_ID } from "./workspace-board-flow-surface-onboarding-guide"
import { workspaceNodeClassName } from "./workspace-board-node-class-name"
import type { WorkspaceBoardNodeData } from "./workspace-board-node"
import type {
  WorkspaceBoardState,
  WorkspaceAutoLayoutMode,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceCommunicationsState,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
  WorkspaceVaultViewMode,
} from "./workspace-board-types"
import type { WorkspaceFlowNode } from "./workspace-board-flow-node-types"

export const ACCELERATOR_STEP_EDGE_ID = "edge-accelerator-to-active-step"
export const ONBOARDING_GUIDE_EDGE_ID = "edge-workspace-onboarding-guide-target"

export {
  ACCELERATOR_STEP_NODE_ID,
  ACCELERATOR_STEP_NODE_DIMENSIONS,
  buildAcceleratorStepNodeData,
} from "./workspace-board-accelerator-step-node-data"
export type {
  WorkspaceFlowNode,
  WorkspaceFlowNodeData,
} from "./workspace-board-flow-node-types"

export function buildWorkspaceEdges({
  connections,
  visibleEdgeCardIds,
  edgeStyle,
  acceleratorStepNodeData,
  acceleratorWorkspaceNode,
  autoLayoutMode,
  onboardingGuideNodeData,
  onboardingTargetWorkspaceNode,
  presentationMode,
  visibleWorkspaceNodes,
}: {
  connections: WorkspaceBoardState["connections"]
  visibleEdgeCardIds: Set<WorkspaceCardId>
  edgeStyle: { strokeWidth: number; opacity: number }
  acceleratorStepNodeData: WorkspaceFlowNode | null
  acceleratorWorkspaceNode: WorkspaceBoardState["nodes"][number] | null
  autoLayoutMode: WorkspaceAutoLayoutMode
  onboardingGuideNodeData: WorkspaceFlowNode | null
  onboardingTargetWorkspaceNode: WorkspaceBoardState["nodes"][number] | null
  presentationMode: boolean
  visibleWorkspaceNodes: WorkspaceBoardState["nodes"]
}): Edge[] {
  const nodeGeometryLookup =
    buildWorkspaceCardEdgeGeometryLookupFromBoardNodes(visibleWorkspaceNodes)
  const baseEdges: Edge[] = connections
    .filter(
      (edge) =>
        visibleEdgeCardIds.has(edge.source) && visibleEdgeCardIds.has(edge.target)
    )
    .map((edge) => {
      const handleIds = resolveWorkspaceCardConnectionHandleIds({
        source: nodeGeometryLookup[edge.source],
        target: nodeGeometryLookup[edge.target],
      })

      return {
        ...edge,
        sourceHandle: handleIds?.sourceHandle,
        targetHandle: handleIds?.targetHandle,
        type: "smoothstep",
        animated: false,
        style: edgeStyle,
      }
    })

  if (acceleratorStepNodeData && acceleratorWorkspaceNode) {
    const handleIds = resolveWorkspaceAcceleratorStepEdgeHandles(autoLayoutMode)
    baseEdges.push({
      id: ACCELERATOR_STEP_EDGE_ID,
      source: acceleratorWorkspaceNode.id,
      target: ACCELERATOR_STEP_NODE_ID,
      sourceHandle: handleIds.sourceHandle,
      targetHandle: handleIds.targetHandle,
      type: "smoothstep",
      animated: true,
      style: {
        ...edgeStyle,
        stroke: "rgba(148, 163, 184, 0.72)",
        strokeWidth: presentationMode ? 1.2 : 1.5,
        strokeDasharray: "4 4",
      },
    })
  }

  if (onboardingGuideNodeData && onboardingTargetWorkspaceNode) {
    baseEdges.push({
      id: ONBOARDING_GUIDE_EDGE_ID,
      source: WORKSPACE_ONBOARDING_GUIDE_NODE_ID,
      target: onboardingTargetWorkspaceNode.id,
      type: "smoothstep",
      animated: true,
      style: {
        ...edgeStyle,
        stroke: "rgba(56, 189, 248, 0.74)",
        strokeWidth: presentationMode ? 1.2 : 1.6,
        strokeDasharray: "5 4",
      },
    })
  }

  return baseEdges
}

export function buildWorkspaceNodes({
  visibleWorkspaceNodes,
  acceleratorStepNodeData,
  onboardingGuideNodeData,
  allowEditing,
  isCanvasFullscreen,
  presentationMode,
  communications,
  tracker,
  accelerator,
  vaultViewMode,
  seed,
  organizationEditorData,
  onSizeChange,
  onCommunicationsChange,
  onTrackerChange,
  onVaultViewModeChange,
  onAcceleratorStateChange,
  acceleratorStepNodeVisible,
  onOpenAcceleratorStepNode,
  onHideAcceleratorStepNode,
  onAcceleratorRuntimeChange,
  onAcceleratorRuntimeActionsChange,
  onToggleCanvasFullscreen,
}: {
  visibleWorkspaceNodes: WorkspaceBoardState["nodes"]
  acceleratorStepNodeData: WorkspaceFlowNode | null
  onboardingGuideNodeData: WorkspaceFlowNode | null
  allowEditing: boolean
  isCanvasFullscreen: boolean
  presentationMode: boolean
  communications: WorkspaceBoardState["communications"]
  tracker: WorkspaceBoardState["tracker"]
  accelerator: WorkspaceBoardState["accelerator"]
  vaultViewMode: WorkspaceVaultViewMode
  seed: WorkspaceSeedData
  organizationEditorData: WorkspaceOrganizationEditorData
  onSizeChange: (cardId: WorkspaceCardId, size: WorkspaceCardSize) => void
  onCommunicationsChange: (next: WorkspaceCommunicationsState) => void
  onTrackerChange: (next: WorkspaceBoardState["tracker"]) => void
  onVaultViewModeChange: (next: WorkspaceVaultViewMode) => void
  onAcceleratorStateChange: (next: WorkspaceBoardState["accelerator"]) => void
  acceleratorStepNodeVisible: boolean
  onOpenAcceleratorStepNode: (stepId?: string | null) => void
  onHideAcceleratorStepNode: () => void
  onAcceleratorRuntimeChange: (
    snapshot: WorkspaceAcceleratorCardRuntimeSnapshot
  ) => void
  onAcceleratorRuntimeActionsChange: (
    actions: WorkspaceAcceleratorCardRuntimeActions
  ) => void
  onToggleCanvasFullscreen: (cardId: WorkspaceCardId) => void
}): WorkspaceFlowNode[] {
  const workspaceNodes: WorkspaceFlowNode[] = visibleWorkspaceNodes.map(
    (node) => {
      const acceleratorRuntimeData =
        node.id === "accelerator"
          ? {
              acceleratorStepNodeVisible,
              onOpenAcceleratorStepNode,
              onHideAcceleratorStepNode,
              onAcceleratorRuntimeChange,
              onAcceleratorRuntimeActionsChange,
            }
          : {}

      return {
        id: node.id,
        type: "workspace",
        position: { x: node.x, y: node.y },
        draggable: allowEditing && !isCanvasFullscreen,
        selectable: false,
        dragHandle: allowEditing ? ".workspace-card-drag-handle" : undefined,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        className: workspaceNodeClassName(node.size, node.id),
        style: resolveWorkspaceCardNodeStyle(node.size, node.id),
        data: {
          cardId: node.id,
          size: node.size,
          canEdit: allowEditing,
          presentationMode,
          communications,
          tracker,
          vaultViewMode,
          acceleratorState: accelerator,
          seed,
          organizationEditorData,
          onSizeChange,
          onCommunicationsChange,
          onTrackerChange,
          onVaultViewModeChange,
          onAcceleratorStateChange,
          onToggleCanvasFullscreen,
          ...acceleratorRuntimeData,
        },
      }
    }
  )

  if (onboardingGuideNodeData) {
    workspaceNodes.push(onboardingGuideNodeData)
  }

  if (acceleratorStepNodeData) {
    workspaceNodes.push(acceleratorStepNodeData)
  }

  return workspaceNodes
}
