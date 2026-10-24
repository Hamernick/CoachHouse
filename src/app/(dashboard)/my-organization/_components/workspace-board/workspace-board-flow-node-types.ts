"use client"

import type { Node } from "@xyflow/react"

import type {
  WorkspaceCanvasTutorialNodeData,
} from "@/features/workspace-canvas-tutorial"

import type { WorkspaceBoardOnboardingNodeData } from "./workspace-board-onboarding-guide-node"
import type {
  WorkspaceBoardAcceleratorStepNodeData,
  WorkspaceBoardNodeData,
} from "./workspace-board-node"

export type WorkspaceFlowNodeData =
  | WorkspaceBoardNodeData
  | WorkspaceBoardAcceleratorStepNodeData
  | WorkspaceBoardOnboardingNodeData
  | WorkspaceCanvasTutorialNodeData
export type WorkspaceFlowNode = Node<WorkspaceFlowNodeData>
