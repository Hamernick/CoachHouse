"use client"

import { useMemo } from "react"

import type {
  WorkspaceBoardAcceleratorState,
  WorkspaceBoardState,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceCommunicationsState,
  WorkspaceJourneyGuideState,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
  WorkspaceTrackerState,
  WorkspaceVaultViewMode,
} from "../../workspace-board-types"
import type { WorkspaceBoardNodeData } from "../../workspace-board-node-types"
import type {
  WorkspaceOntologyActionRequest,
  WorkspaceOntologyRootControl,
} from "@/features/workspace-ontology"
import type {
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "@/features/workspace-accelerator-card"
import type { WorkspaceCanvasTutorialStepId } from "@/features/workspace-canvas-tutorial"
import type { WorkspaceCardShortcutItemModel } from "../shortcuts/workspace-card-shortcut-model"
import { buildWorkspaceCanvasV2CardDataLookup } from "./workspace-canvas-surface-v2-helpers"

export function useWorkspaceCanvasCardDataLookup({
  allowEditing,
  presentationMode,
  acceleratorState,
  communications,
  tracker,
  hiddenCardIds,
  nodes,
  seed,
  organizationEditorData,
  onSizeChange,
  onCommunicationsChange,
  onTrackerChange,
  onAcceleratorStateChange,
  onInitialOnboardingSubmit,
  vaultViewMode,
  onVaultViewModeChange,
  acceleratorStepNodeVisible,
  onOpenAcceleratorStepNode,
  onHideAcceleratorStepNode,
  onAcceleratorRuntimeChange,
  onAcceleratorRuntimeActionsChange,
  acceleratorRuntimeSnapshot,
  acceleratorTutorialCallout,
  acceleratorTutorialInteractionPolicy,
  onAcceleratorTutorialActionComplete,
  journeyGuideState,
  onFocusCard,
  onOpenCard,
  onHideCard,
  onCardMeasuredHeightChange,
  organizationShortcutItems,
  organizationMapButtonCallout,
  onOrganizationMapButtonTutorialComplete,
  tutorialStepId,
  ontologyRootControls,
  ontologyActionRequest,
}: {
  allowEditing: boolean
  presentationMode: boolean
  acceleratorState: WorkspaceBoardAcceleratorState
  communications: WorkspaceCommunicationsState
  tracker: WorkspaceTrackerState
  hiddenCardIds: WorkspaceBoardState["hiddenCardIds"]
  nodes: WorkspaceBoardState["nodes"]
  seed: WorkspaceSeedData
  organizationEditorData: WorkspaceOrganizationEditorData
  onSizeChange: (cardId: WorkspaceCardId, size: WorkspaceCardSize) => void
  onCommunicationsChange: (next: WorkspaceCommunicationsState) => void
  onTrackerChange: (next: WorkspaceTrackerState) => void
  onAcceleratorStateChange: (next: WorkspaceBoardAcceleratorState) => void
  onInitialOnboardingSubmit: (form: FormData) => Promise<void>
  vaultViewMode: WorkspaceVaultViewMode
  onVaultViewModeChange: (next: WorkspaceVaultViewMode) => void
  acceleratorStepNodeVisible: boolean
  onOpenAcceleratorStepNode: (stepId?: string | null) => void
  onHideAcceleratorStepNode: () => void
  onAcceleratorRuntimeChange: (
    snapshot: WorkspaceAcceleratorCardRuntimeSnapshot
  ) => void
  onAcceleratorRuntimeActionsChange: WorkspaceBoardNodeData["onAcceleratorRuntimeActionsChange"]
  acceleratorRuntimeSnapshot?: WorkspaceAcceleratorCardRuntimeSnapshot | null
  acceleratorTutorialCallout: WorkspaceBoardNodeData["acceleratorTutorialCallout"]
  acceleratorTutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  onAcceleratorTutorialActionComplete: WorkspaceBoardNodeData["onAcceleratorTutorialActionComplete"]
  journeyGuideState: WorkspaceJourneyGuideState
  onFocusCard: (cardId: WorkspaceCardId) => void
  onOpenCard: (cardId: WorkspaceCardId) => void
  onHideCard: (cardId: WorkspaceCardId) => void
  onCardMeasuredHeightChange?: (
    cardId: WorkspaceCardId,
    size: WorkspaceCardSize,
    height: number
  ) => void
  organizationShortcutItems: WorkspaceCardShortcutItemModel[]
  organizationMapButtonCallout: WorkspaceBoardNodeData["organizationMapButtonCallout"]
  onOrganizationMapButtonTutorialComplete: WorkspaceBoardNodeData["onOrganizationMapButtonTutorialComplete"]
  tutorialStepId?: WorkspaceCanvasTutorialStepId | null
  ontologyRootControls?: Partial<
    Record<WorkspaceCardId, WorkspaceOntologyRootControl>
  >
  ontologyActionRequest?: WorkspaceOntologyActionRequest | null
}) {
  return useMemo(
    () =>
      buildWorkspaceCanvasV2CardDataLookup({
        allowEditing,
        presentationMode,
        acceleratorState,
        communications,
        tracker,
        hiddenCardIds,
        nodes,
        seed,
        organizationEditorData,
        onSizeChange,
        onCommunicationsChange,
        onTrackerChange,
        onAcceleratorStateChange,
        onInitialOnboardingSubmit,
        vaultViewMode,
        onVaultViewModeChange,
        acceleratorStepNodeVisible,
        onOpenAcceleratorStepNode,
        onHideAcceleratorStepNode,
        onAcceleratorRuntimeChange,
        onAcceleratorRuntimeActionsChange,
        acceleratorRuntimeSnapshot,
        acceleratorTutorialCallout,
        acceleratorTutorialInteractionPolicy,
        onAcceleratorTutorialActionComplete,
        journeyGuideState,
        onFocusCard,
        onOpenCard,
        onHideCard,
        onCardMeasuredHeightChange,
        organizationShortcutItems,
        organizationMapButtonCallout,
        onOrganizationMapButtonTutorialComplete,
        tutorialStepId,
        ontologyRootControls,
        ontologyActionRequest,
      }),
    [
      acceleratorState,
      acceleratorStepNodeVisible,
      acceleratorTutorialCallout,
      acceleratorTutorialInteractionPolicy,
      allowEditing,
      communications,
      hiddenCardIds,
      journeyGuideState,
      nodes,
      onAcceleratorRuntimeActionsChange,
      acceleratorRuntimeSnapshot,
      onAcceleratorRuntimeChange,
      onAcceleratorStateChange,
      onAcceleratorTutorialActionComplete,
      onCardMeasuredHeightChange,
      onCommunicationsChange,
      onFocusCard,
      onOpenCard,
      onHideCard,
      onHideAcceleratorStepNode,
      onInitialOnboardingSubmit,
      onOpenAcceleratorStepNode,
      onOrganizationMapButtonTutorialComplete,
      onSizeChange,
      onTrackerChange,
      onVaultViewModeChange,
      organizationMapButtonCallout,
      organizationEditorData,
      organizationShortcutItems,
      ontologyRootControls,
      ontologyActionRequest,
      presentationMode,
      seed,
      tutorialStepId,
      tracker,
      vaultViewMode,
    ]
  )
}
