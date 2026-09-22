"use client"

import type { WorkspaceParticleState } from "@/features/workspace-particles"

import { memo } from "react"

import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import { WorkspaceCanvasSurfaceV2 } from "./workspace-canvas-v2"
import { WorkspaceRealtimeCursorsOverlay } from "./workspace-board-flow-surface-cursors"

import { type WorkspaceBoardToggleContext } from "./workspace-board-debug"
import type {
  WorkspaceCanvasCardFocusRequest,
  WorkspaceCanvasTutorialCompletionExitRequest,
} from "./workspace-canvas-v2/runtime/workspace-canvas-viewport-command"
import type {
  WorkspaceBoardAcceleratorState,
  WorkspaceBoardOnboardingFlowState,
  WorkspaceBoardState,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceCommunicationsState,
  WorkspaceJourneyGuideState,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
} from "./workspace-board-types"

export type WorkspaceBoardFlowSurfaceProps = {
  seed: WorkspaceSeedData
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
  boardState: WorkspaceBoardState
  allowEditing: boolean
  workspaceDataDrawerCanEdit: boolean
  presentationMode: boolean
  workspaceRoomName: string
  layoutFitRequestKey: number
  acceleratorFocusRequestKey: number
  tutorialRestartRequestKey: number
  onInitialOnboardingSubmit: (form: FormData) => Promise<void>
  focusCardRequest: WorkspaceCanvasCardFocusRequest
  tutorialCompletionExitRequest: WorkspaceCanvasTutorialCompletionExitRequest
  journeyGuideState: WorkspaceJourneyGuideState
  onSizeChange: (cardId: WorkspaceCardId, size: WorkspaceCardSize) => void
  onCommunicationsChange: (next: WorkspaceCommunicationsState) => void
  onTrackerChange: (next: WorkspaceBoardState["tracker"]) => void
  onAcceleratorStateChange: (next: WorkspaceBoardAcceleratorState) => void
  onOpenAcceleratorStepNode: (stepId: string | null) => void
  onCloseAcceleratorStepNode: (source?: "dock" | "card" | "unknown") => void
  onTutorialPrevious: () => void
  onTutorialNext: () => void
  onTutorialRestart: () => void
  onTutorialShortcutOpened: () => void
  onFocusCard: (cardId: WorkspaceCardId) => void
  onOnboardingFlowChange: (next: WorkspaceBoardOnboardingFlowState) => void
  onParticlesChange: (state: WorkspaceParticleState) => void
  onPersistNodePosition: (cardId: WorkspaceCardId, x: number, y: number) => void
  onToggleCardVisibility: (
    cardId: WorkspaceCardId,
    context?: WorkspaceBoardToggleContext
  ) => void
  onConnectCards: (source: WorkspaceCardId, target: WorkspaceCardId) => void
  onDisconnectConnection: (connectionId: string) => void
  onDisconnectAllConnections: () => void
  onResetDefaultConnections: () => void
  onCursorConnectionStateChange: (
    state: "connecting" | "live" | "degraded"
  ) => void
  onTutorialCompletionExitHandled: () => void
}

export const WorkspaceBoardFlowSurface = memo(
  function WorkspaceBoardFlowSurface(props: WorkspaceBoardFlowSurfaceProps) {
    return (
      <>
        <WorkspaceCanvasSurfaceV2
          boardState={props.boardState}
          allowEditing={props.allowEditing}
          workspaceDataDrawerCanEdit={props.workspaceDataDrawerCanEdit}
          presentationMode={props.presentationMode}
          seed={props.seed}
          organizationEditorData={props.organizationEditorData}
          financeInput={props.financeInput}
          layoutFitRequestKey={props.layoutFitRequestKey}
          acceleratorFocusRequestKey={props.acceleratorFocusRequestKey}
          tutorialRestartRequestKey={props.tutorialRestartRequestKey}
          onInitialOnboardingSubmit={props.onInitialOnboardingSubmit}
          focusCardRequest={props.focusCardRequest}
          tutorialCompletionExitRequest={props.tutorialCompletionExitRequest}
          journeyGuideState={props.journeyGuideState}
          onSizeChange={props.onSizeChange}
          onCommunicationsChange={props.onCommunicationsChange}
          onTrackerChange={props.onTrackerChange}
          onAcceleratorStateChange={props.onAcceleratorStateChange}
          onOpenAcceleratorStepNode={props.onOpenAcceleratorStepNode}
          onCloseAcceleratorStepNode={props.onCloseAcceleratorStepNode}
          onTutorialPrevious={props.onTutorialPrevious}
          onTutorialNext={props.onTutorialNext}
          onTutorialRestart={props.onTutorialRestart}
          onTutorialShortcutOpened={props.onTutorialShortcutOpened}
          onFocusCard={props.onFocusCard}
          onParticlesChange={props.onParticlesChange}
          onPersistNodePosition={props.onPersistNodePosition}
          onConnectCards={props.onConnectCards}
          onDisconnectConnection={props.onDisconnectConnection}
          onDisconnectAllConnections={props.onDisconnectAllConnections}
          onToggleCardVisibility={props.onToggleCardVisibility}
          onTutorialCompletionExitHandled={
            props.onTutorialCompletionExitHandled
          }
        />
        <WorkspaceRealtimeCursorsOverlay
          roomName={props.workspaceRoomName}
          username={props.seed.viewerName}
          suspendPublishing={props.presentationMode}
          onConnectionStateChange={props.onCursorConnectionStateChange}
        />
      </>
    )
  }
)

WorkspaceBoardFlowSurface.displayName = "WorkspaceBoardFlowSurface"
