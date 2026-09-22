import type { WorkspaceParticleState } from "@/features/workspace-particles"
import type { WorkspaceCanvasTutorialStepId } from "@/features/workspace-canvas-tutorial"
import type { WorkspaceOntologyState } from "@/features/workspace-ontology"

import type { WorkspaceCommunicationsState } from "./workspace-board-communications-types"
import type {
  WorkspaceAutoLayoutMode,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceLayoutPreset,
} from "./workspace-board-constants"
import type { WorkspaceTrackerState } from "./workspace-board-tracker-types"

export type WorkspaceNodeState = {
  id: WorkspaceCardId
  x: number
  y: number
  size: WorkspaceCardSize
  positionMode?: WorkspaceNodePositionMode
}

export type WorkspaceNodePositionMode = "managed" | "manual"

export type WorkspaceConnectionState = {
  id: string
  source: WorkspaceCardId
  target: WorkspaceCardId
}

export type WorkspaceBoardAcceleratorState = {
  activeStepId: string | null
  completedStepIds: string[]
}

export const WORKSPACE_ONBOARDING_STAGES = [2, 3, 4] as const

export type WorkspaceOnboardingStage =
  (typeof WORKSPACE_ONBOARDING_STAGES)[number]

export type WorkspaceBoardOnboardingFlowState = {
  active: boolean
  stage: WorkspaceOnboardingStage
  tutorialStepIndex: number
  openedTutorialStepIds: WorkspaceCanvasTutorialStepId[]
  acknowledgedTutorialStepIds: WorkspaceCanvasTutorialStepId[]
  completedStages: WorkspaceOnboardingStage[]
  updatedAt: string
}

export type WorkspaceBoardVisibilityState = {
  allCardsHiddenExplicitly: boolean
}

export type WorkspaceBoardAcceleratorUiState = {
  stepOpen: boolean
  lastStepId: string | null
}

export type WorkspaceBoardForwardCompatibilityState = {
  nodes: Record<string, unknown>[]
  connections: Record<string, unknown>[]
  hiddenCardIds: string[]
}

export type WorkspaceBoardState = {
  version: 1
  preset: WorkspaceLayoutPreset
  autoLayoutMode: WorkspaceAutoLayoutMode
  nodes: WorkspaceNodeState[]
  connections: WorkspaceConnectionState[]
  communications: WorkspaceCommunicationsState
  tracker: WorkspaceTrackerState
  accelerator: WorkspaceBoardAcceleratorState
  acceleratorUi?: WorkspaceBoardAcceleratorUiState
  onboardingFlow: WorkspaceBoardOnboardingFlowState
  hiddenCardIds: WorkspaceCardId[]
  visibility?: WorkspaceBoardVisibilityState
  particles?: WorkspaceParticleState
  ontology?: WorkspaceOntologyState
  forwardCompatibility?: WorkspaceBoardForwardCompatibilityState
  updatedAt: string
}
