"use client"

import type { Node } from "reactflow"

import {
  type WorkspaceAcceleratorCardRuntimeSnapshot,
  type WorkspaceAcceleratorTutorialCallout,
  type WorkspaceAcceleratorTutorialInteractionPolicy,
} from "@/features/workspace-accelerator-card"
import type {
  WorkspaceCanvasTutorialNodeData,
  WorkspaceCanvasTutorialStepId,
} from "@/features/workspace-canvas-tutorial"

import type {
  WorkspaceBoardAcceleratorStepNodeData,
  WorkspaceBoardNodeData,
} from "../../workspace-board-node"
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
import type { WorkspaceCardShortcutItemModel } from "../shortcuts/workspace-card-shortcut-model"
import {
  WORKSPACE_CANVAS_V2_CARD_IDS,
  WORKSPACE_CANVAS_V2_DOCK_CARD_IDS,
  WORKSPACE_CANVAS_V2_CARD_CONTRACT,
  type WorkspaceCanvasV2CardId,
} from "../contracts/workspace-card-contract"
import { resolveOrgCardSize } from "./workspace-canvas-surface-v2-positioning"
import { resolveWorkspaceCanvasCollapsedAcceleratorCardSize } from "./workspace-canvas-surface-v2-accelerator-card-size"
import type { WorkspaceCanvasPersonNodeData } from "./workspace-canvas-person-node-model"
import type {
  WorkspaceOntologyActionRequest,
  WorkspaceOntologyNodeData,
  WorkspaceOntologyRootControl,
} from "@/features/workspace-ontology"

export { reconcileWorkspaceCanvasV2Nodes } from "./workspace-canvas-surface-v2-reconcile"
export {
  buildWorkspaceCanvasV2CardNode,
  resolveWorkspaceCanvasRenderNodes,
} from "./workspace-canvas-surface-v2-render-nodes"
export {
  WORKSPACE_CANVAS_PERSON_NODE_SIZE,
  buildWorkspaceCanvasPersonNode,
  getWorkspaceCanvasPersonNodeId,
  isWorkspaceCanvasPersonNodeData,
  toWorkspaceCanvasPersonNodePerson,
  type WorkspaceCanvasPersonNodeData,
  type WorkspaceCanvasPersonNodePerson,
  type WorkspaceCanvasPersonPlacement,
} from "./workspace-canvas-person-node-model"

export {
  WORKSPACE_CANVAS_V2_CARD_IDS,
  WORKSPACE_CANVAS_V2_DOCK_CARD_IDS,
  type WorkspaceCanvasV2CardId,
} from "../contracts/workspace-card-contract"

const NOOP_ON_VAULT_VIEW_MODE_CHANGE = (_next: WorkspaceVaultViewMode) => {}

export type WorkspaceCanvasNodeData =
  | WorkspaceBoardNodeData
  | WorkspaceBoardAcceleratorStepNodeData
  | WorkspaceCanvasPersonNodeData
  | WorkspaceCanvasTutorialNodeData
  | WorkspaceOntologyNodeData
export type WorkspaceCanvasNode = Node<WorkspaceCanvasNodeData>

export const WORKSPACE_CANVAS_V2_VAULT_MODE: WorkspaceVaultViewMode = "dropzone"

export function isWorkspaceCanvasV2CardId(
  value: string
): value is WorkspaceCanvasV2CardId {
  return WORKSPACE_CANVAS_V2_CARD_IDS.includes(value as WorkspaceCanvasV2CardId)
}

function resolveContractCardSize({
  cardId,
  nodes,
}: {
  cardId: WorkspaceCanvasV2CardId
  nodes: WorkspaceBoardState["nodes"]
}): WorkspaceCardSize {
  const contract = WORKSPACE_CANVAS_V2_CARD_CONTRACT[cardId]
  const fallback = contract.defaultSize
  const nodeSize = nodes.find((node) => node.id === cardId)?.size
  if (!nodeSize) return fallback
  return contract.allowedSizes.some((size) => size === nodeSize)
    ? nodeSize
    : fallback
}

export function resolveWorkspaceCanvasAcceleratorCardSize({
  nodes,
  acceleratorRuntimeSnapshot,
}: {
  nodes: WorkspaceBoardState["nodes"]
  acceleratorRuntimeSnapshot?: WorkspaceAcceleratorCardRuntimeSnapshot | null
}): WorkspaceCardSize {
  const persistedSize = resolveContractCardSize({
    cardId: "accelerator",
    nodes,
  })

  if (acceleratorRuntimeSnapshot?.isModuleViewerOpen === true) {
    return "lg"
  }

  return resolveWorkspaceCanvasCollapsedAcceleratorCardSize({
    currentSize: persistedSize,
    previousCollapsedSize: null,
  })
}

export function buildWorkspaceCanvasV2CardDataLookup({
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
  acceleratorTutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  acceleratorTutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  onAcceleratorTutorialActionComplete?: () => void
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
  organizationMapButtonCallout?: WorkspaceBoardNodeData["organizationMapButtonCallout"]
  onOrganizationMapButtonTutorialComplete?: WorkspaceBoardNodeData["onOrganizationMapButtonTutorialComplete"]
  tutorialStepId?: WorkspaceCanvasTutorialStepId | null
  ontologyRootControls?: Partial<
    Record<WorkspaceCardId, WorkspaceOntologyRootControl>
  >
  ontologyActionRequest?: WorkspaceOntologyActionRequest | null
}): Record<WorkspaceCardId, WorkspaceBoardNodeData> {
  const baseData = {
    canEdit: allowEditing,
    presentationMode,
    communications,
    tracker,
    acceleratorState,
    seed,
    organizationEditorData,
    onCommunicationsChange,
    onTrackerChange,
    onAcceleratorStateChange,
    onFocusCard,
    onOpenCard,
    onHideCard,
    fiscalSponsorshipCardVisible: !hiddenCardIds.includes("fiscal-sponsorship"),
    isCanvasFullscreen: false,
    tutorialStepId: tutorialStepId ?? null,
    ontologyActionRequest: ontologyActionRequest ?? null,
  } as const

  const orgSize = resolveOrgCardSize(nodes)
  const roadmapSize = resolveContractCardSize({
    cardId: "roadmap",
    nodes,
  })

  return {
    "organization-overview": {
      ...baseData,
      ontologyRootControl: ontologyRootControls?.["organization-overview"],
      cardId: "organization-overview",
      size: orgSize,
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      organizationShortcutItems,
      organizationMapButtonCallout: organizationMapButtonCallout ?? null,
      onOrganizationMapButtonTutorialComplete,
      isJourneyTarget:
        journeyGuideState.targetCardId === "organization-overview",
      onSizeChange: (_cardId, nextSize) =>
        onSizeChange("organization-overview", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) =>
            onCardMeasuredHeightChange("organization-overview", size, height)
        : undefined,
    },
    programs: {
      ...baseData,
      ontologyRootControl: ontologyRootControls?.programs,
      cardId: "programs",
      size: resolveContractCardSize({
        cardId: "programs",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "programs",
      onSizeChange: (_cardId, nextSize) => onSizeChange("programs", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) => onCardMeasuredHeightChange("programs", size, height)
        : undefined,
    },
    roadmap: {
      ...baseData,
      ontologyRootControl: ontologyRootControls?.roadmap,
      cardId: "roadmap",
      size: roadmapSize,
      vaultViewMode,
      isJourneyTarget: journeyGuideState.targetCardId === "roadmap",
      onSizeChange: (_cardId, nextSize) => onSizeChange("roadmap", nextSize),
      onVaultViewModeChange,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) => onCardMeasuredHeightChange("roadmap", size, height)
        : undefined,
    },
    deck: {
      ...baseData,
      cardId: "deck",
      size: resolveContractCardSize({
        cardId: "deck",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "deck",
      onSizeChange: (_cardId, nextSize) => onSizeChange("deck", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) => onCardMeasuredHeightChange("deck", size, height)
        : undefined,
    },
    accelerator: {
      ...baseData,
      ontologyRootControl: ontologyRootControls?.accelerator,
      cardId: "accelerator",
      size: resolveWorkspaceCanvasAcceleratorCardSize({
        nodes,
        acceleratorRuntimeSnapshot,
      }),
      vaultViewMode,
      journeyGuideState,
      isJourneyTarget: journeyGuideState.targetCardId === "accelerator",
      onSizeChange: (_cardId, nextSize) =>
        onSizeChange("accelerator", nextSize),
      onVaultViewModeChange,
      acceleratorStepNodeVisible,
      onOpenAcceleratorStepNode,
      onHideAcceleratorStepNode,
      onAcceleratorRuntimeChange,
      onAcceleratorRuntimeActionsChange,
      acceleratorTutorialCallout,
      acceleratorTutorialInteractionPolicy,
      onAcceleratorTutorialActionComplete,
      onWorkspaceOnboardingSubmit: onInitialOnboardingSubmit,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) =>
            onCardMeasuredHeightChange("accelerator", size, height)
        : undefined,
    },
    "brand-kit": {
      ...baseData,
      cardId: "brand-kit",
      size: resolveContractCardSize({
        cardId: "brand-kit",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "brand-kit",
      onSizeChange: (_cardId, nextSize) => onSizeChange("brand-kit", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) =>
            onCardMeasuredHeightChange("brand-kit", size, height)
        : undefined,
    },
    "economic-engine": {
      ...baseData,
      cardId: "economic-engine",
      size: resolveContractCardSize({
        cardId: "economic-engine",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "economic-engine",
      onSizeChange: (_cardId, nextSize) =>
        onSizeChange("economic-engine", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) =>
            onCardMeasuredHeightChange("economic-engine", size, height)
        : undefined,
    },
    calendar: {
      ...baseData,
      ontologyRootControl: ontologyRootControls?.calendar,
      cardId: "calendar",
      size: resolveContractCardSize({
        cardId: "calendar",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "calendar",
      onSizeChange: (_cardId, nextSize) => onSizeChange("calendar", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) => onCardMeasuredHeightChange("calendar", size, height)
        : undefined,
    },
    communications: {
      ...baseData,
      cardId: "communications",
      size: resolveContractCardSize({
        cardId: "communications",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "communications",
      onSizeChange: (_cardId, nextSize) =>
        onSizeChange("communications", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) =>
            onCardMeasuredHeightChange("communications", size, height)
        : undefined,
    },
    atlas: {
      ...baseData,
      cardId: "atlas",
      size: resolveContractCardSize({
        cardId: "atlas",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "atlas",
      onSizeChange: (_cardId, nextSize) => onSizeChange("atlas", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) => onCardMeasuredHeightChange("atlas", size, height)
        : undefined,
    },
    "fiscal-sponsorship": {
      ...baseData,
      ontologyRootControl: ontologyRootControls?.["fiscal-sponsorship"],
      cardId: "fiscal-sponsorship",
      size: resolveContractCardSize({
        cardId: "fiscal-sponsorship",
        nodes,
      }),
      vaultViewMode: WORKSPACE_CANVAS_V2_VAULT_MODE,
      isJourneyTarget: journeyGuideState.targetCardId === "fiscal-sponsorship",
      onSizeChange: (_cardId, nextSize) =>
        onSizeChange("fiscal-sponsorship", nextSize),
      onVaultViewModeChange: NOOP_ON_VAULT_VIEW_MODE_CHANGE,
      onMeasuredHeightChange: onCardMeasuredHeightChange
        ? (size, height) =>
            onCardMeasuredHeightChange("fiscal-sponsorship", size, height)
        : undefined,
    },
  }
}
