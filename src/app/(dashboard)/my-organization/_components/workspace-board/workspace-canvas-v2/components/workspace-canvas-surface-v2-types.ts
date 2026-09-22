import type { WorkspaceParticleState } from "@/features/workspace-particles"
import type { WorkspaceBoardToggleContext } from "../../workspace-board-debug"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
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
} from "../../workspace-board-types"
import type {
  WorkspaceCanvasCardFocusRequest,
  WorkspaceCanvasTutorialCompletionExitRequest,
} from "../runtime/workspace-canvas-viewport-command"

export type WorkspaceCanvasSurfaceV2Props = {
  boardState: WorkspaceBoardState
  allowEditing: boolean
  workspaceDataDrawerCanEdit: boolean
  presentationMode: boolean
  seed: WorkspaceSeedData
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
  layoutFitRequestKey: number
  acceleratorFocusRequestKey: number
  tutorialRestartRequestKey: number
  focusCardRequest: WorkspaceCanvasCardFocusRequest
  tutorialCompletionExitRequest: WorkspaceCanvasTutorialCompletionExitRequest
  journeyGuideState: WorkspaceJourneyGuideState
  onInitialOnboardingSubmit: (form: FormData) => Promise<void>
  onSizeChange: (cardId: WorkspaceCardId, size: WorkspaceCardSize) => void
  onCommunicationsChange: (next: WorkspaceCommunicationsState) => void
  onTrackerChange: (next: WorkspaceTrackerState) => void
  onAcceleratorStateChange: (next: WorkspaceBoardAcceleratorState) => void
  onOpenAcceleratorStepNode: (stepId: string | null) => void
  onCloseAcceleratorStepNode: (source?: "dock" | "card" | "unknown") => void
  onTutorialPrevious: () => void
  onTutorialNext: () => void
  onTutorialRestart: () => void
  onTutorialShortcutOpened: () => void
  onFocusCard: (cardId: WorkspaceCardId) => void
  onParticlesChange: (state: WorkspaceParticleState) => void
  onPersistNodePosition: (cardId: WorkspaceCardId, x: number, y: number) => void
  onConnectCards: (source: WorkspaceCardId, target: WorkspaceCardId) => void
  onDisconnectConnection: (connectionId: string) => void
  onDisconnectAllConnections: () => void
  onToggleCardVisibility: (
    cardId: WorkspaceCardId,
    context?: WorkspaceBoardToggleContext
  ) => void
  onTutorialCompletionExitHandled: () => void
}
