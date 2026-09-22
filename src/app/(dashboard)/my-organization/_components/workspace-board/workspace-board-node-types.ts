import type {
  WorkspaceAcceleratorTutorialCallout,
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorTutorialInteractionPolicy,
} from "@/features/workspace-accelerator-card"
import type { WorkspaceCanvasTutorialStepId } from "@/features/workspace-canvas-tutorial"
import type {
  WorkspaceOntologyActionRequest,
  WorkspaceOntologyRootControl,
} from "@/features/workspace-ontology"
import type { WorkspaceCardShortcutItemModel } from "./workspace-canvas-v2/shortcuts/workspace-card-shortcut-model"
import type { WorkspaceAcceleratorStepPlacement } from "./workspace-board-accelerator-step-layout"
import type {
  WorkspaceBoardAcceleratorState,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceCommunicationsState,
  WorkspaceJourneyGuideState,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
  WorkspaceTrackerState,
  WorkspaceVaultViewMode,
} from "./workspace-board-types"

export type WorkspaceBoardNodeData = {
  cardId: WorkspaceCardId
  size: WorkspaceCardSize
  canEdit: boolean
  presentationMode: boolean
  communications: WorkspaceCommunicationsState
  tracker: WorkspaceTrackerState
  vaultViewMode: WorkspaceVaultViewMode
  acceleratorState: WorkspaceBoardAcceleratorState
  seed: WorkspaceSeedData
  organizationEditorData?: WorkspaceOrganizationEditorData
  onSizeChange: (cardId: WorkspaceCardId, size: WorkspaceCardSize) => void
  onCommunicationsChange: (next: WorkspaceCommunicationsState) => void
  onTrackerChange: (next: WorkspaceTrackerState) => void
  onVaultViewModeChange: (next: WorkspaceVaultViewMode) => void
  onAcceleratorStateChange: (next: WorkspaceBoardAcceleratorState) => void
  acceleratorStepNodeVisible?: boolean
  onOpenAcceleratorStepNode?: (stepId?: string | null) => void
  onHideAcceleratorStepNode?: () => void
  onAcceleratorRuntimeChange?: (
    snapshot: WorkspaceAcceleratorCardRuntimeSnapshot
  ) => void
  onAcceleratorRuntimeActionsChange?: (
    actions: WorkspaceAcceleratorCardRuntimeActions
  ) => void
  acceleratorTutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  acceleratorTutorialInteractionPolicy?: WorkspaceAcceleratorTutorialInteractionPolicy | null
  onAcceleratorTutorialActionComplete?: (
    mode?: "complete" | "complete-and-advance"
  ) => void
  onWorkspaceOnboardingSubmit?: (form: FormData) => Promise<void>
  journeyGuideState?: WorkspaceJourneyGuideState | null
  isJourneyTarget?: boolean
  onFocusCard?: (cardId: WorkspaceCardId) => void
  onOpenCard?: (cardId: WorkspaceCardId) => void
  onHideCard?: (cardId: WorkspaceCardId) => void
  fiscalSponsorshipCardVisible?: boolean
  onMeasuredHeightChange?: (size: WorkspaceCardSize, height: number) => void
  isCanvasFullscreen?: boolean
  onToggleCanvasFullscreen?: (cardId: WorkspaceCardId) => void
  organizationShortcutItems?: WorkspaceCardShortcutItemModel[]
  organizationMapButtonCallout?: {
    instruction: string
  } | null
  onOrganizationMapButtonTutorialComplete?: (
    mode?: "complete" | "complete-and-advance"
  ) => void
  tutorialStepId?: WorkspaceCanvasTutorialStepId | null
  ontologyRootControl?: WorkspaceOntologyRootControl
  ontologyActionRequest?: WorkspaceOntologyActionRequest | null
}

export type WorkspaceBoardAcceleratorStepNodeData = {
  step: WorkspaceAcceleratorCardRuntimeSnapshot["currentStep"]
  placeholderVideoUrl?: string | null
  placement: WorkspaceAcceleratorStepPlacement
  stepIndex: number
  stepTotal: number
  canGoPrevious: boolean
  canGoNext: boolean
  completed: boolean
  moduleCompleted: boolean
  onPrevious: () => void
  onNext: () => void
  onComplete: () => void
  onClose: () => void
  presentationMode: boolean
  tutorialCallout?: WorkspaceAcceleratorTutorialCallout | null
  onWorkspaceOnboardingSubmit?: (form: FormData) => Promise<void>
}
