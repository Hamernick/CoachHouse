"use client"

import type { WorkspaceParticleState } from "@/features/workspace-particles"

import {
  clampWorkspaceCanvasTutorialStepIndex,
  resolveWorkspaceCanvasTutorialCallout,
} from "@/features/workspace-canvas-tutorial"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type {
  WorkspaceCanvasCardFocusRequest,
  WorkspaceCanvasTutorialCompletionExitRequest,
} from "./workspace-canvas-v2/runtime/workspace-canvas-viewport-command"

import { WorkspaceBoardFlowSurface } from "./workspace-board-flow-surface"
import { WorkspaceBoardInitialOnboardingSurface } from "./workspace-board-initial-onboarding-surface"
import { WorkspaceBoardRightRail } from "./workspace-board-right-rail"
import { WorkspaceBoardTeamAccessHeaderAction } from "./workspace-board-team-access-header-action"
import { resolveWorkspaceJourneyGuideState } from "./workspace-board-journey"
import type {
  WorkspaceBoardAcceleratorState,
  WorkspaceBoardOnboardingFlowState,
  WorkspaceBoardState,
  WorkspaceCardId,
  WorkspaceCardSize,
  WorkspaceCollaborationInvite,
  WorkspaceCommunicationsState,
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
  WorkspaceTrackerState,
} from "./workspace-board-types"
import type { WorkspaceBoardToggleContext } from "./workspace-board-debug"

export function WorkspaceBoardCanvasBody({
  initialOnboardingActive,
  seed,
  allowEditing,
  boardState,
  invites,
  cursorConnectionState,
  rightRailCurrentUser,
  layoutFitRequestKey,
  acceleratorFocusRequestKey,
  tutorialRestartRequestKey,
  focusCardRequest,
  tutorialCompletionExitRequest,
  journeyGuideState,
  organizationEditorData,
  financeInput,
  onInitialOnboardingSubmit,
  onInvitesChange,
  onSizeChange,
  onCommunicationsChange,
  onTrackerChange,
  onAcceleratorStateChange,
  onOpenAcceleratorStepNode,
  onCloseAcceleratorStepNode,
  onTutorialPrevious,
  onTutorialNext,
  onTutorialRestart,
  onTutorialShortcutOpened,
  onFocusCard,
  onOnboardingFlowChange,
  onParticlesChange,
  onPersistNodePosition,
  onToggleCardVisibility,
  onConnectCards,
  onDisconnectConnection,
  onDisconnectAllConnections,
  onResetDefaultConnections,
  onCursorConnectionStateChange,
  onTutorialCompletionExitHandled,
}: {
  initialOnboardingActive: boolean
  seed: WorkspaceSeedData
  allowEditing: boolean
  boardState: WorkspaceBoardState
  invites: WorkspaceCollaborationInvite[]
  cursorConnectionState: "connecting" | "live" | "degraded"
  rightRailCurrentUser: {
    id: string
    name: string
    avatarUrl: string | null
  }
  layoutFitRequestKey: number
  acceleratorFocusRequestKey: number
  tutorialRestartRequestKey: number
  focusCardRequest: WorkspaceCanvasCardFocusRequest
  tutorialCompletionExitRequest: WorkspaceCanvasTutorialCompletionExitRequest
  journeyGuideState: ReturnType<typeof resolveWorkspaceJourneyGuideState>
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
  onInitialOnboardingSubmit: (form: FormData) => Promise<void>
  onInvitesChange: (nextInvites: WorkspaceCollaborationInvite[]) => void
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
}) {
  const tutorialActive = boardState.onboardingFlow.active
  const tutorialStepIndex = clampWorkspaceCanvasTutorialStepIndex(
    boardState.onboardingFlow.tutorialStepIndex
  )
  const tutorialCallout = tutorialActive
    ? resolveWorkspaceCanvasTutorialCallout(
        tutorialStepIndex,
        boardState.onboardingFlow.openedTutorialStepIds
      )
    : null
  const workspaceDataDrawerCanEdit =
    !seed.presentationMode && (seed.canEdit || seed.isPlatformAdmin === true)

  if (initialOnboardingActive) {
    return (
      <WorkspaceBoardInitialOnboardingSurface
        seed={seed}
        onSubmit={onInitialOnboardingSubmit}
      />
    )
  }

  return (
    <>
      <WorkspaceBoardTeamAccessHeaderAction
        canInvite={seed.canInviteCollaborators}
        members={seed.members}
        invites={invites}
        realtimeState={cursorConnectionState}
        currentUser={rightRailCurrentUser}
        tutorialCallout={
          tutorialCallout?.kind === "team-access"
            ? {
                title: tutorialCallout.label,
                instruction: tutorialCallout.instruction,
              }
            : null
        }
        onInvitesChange={onInvitesChange}
      />
      <WorkspaceBoardRightRail roadmapSections={seed.roadmapSections} />

      <div className="relative flex min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden">
        <WorkspaceBoardFlowSurface
          seed={seed}
          organizationEditorData={organizationEditorData}
          financeInput={financeInput}
          boardState={boardState}
          allowEditing={allowEditing}
          workspaceDataDrawerCanEdit={workspaceDataDrawerCanEdit}
          presentationMode={seed.presentationMode}
          workspaceRoomName={`org:${seed.orgId}:workspace`}
          layoutFitRequestKey={layoutFitRequestKey}
          acceleratorFocusRequestKey={acceleratorFocusRequestKey}
          tutorialRestartRequestKey={tutorialRestartRequestKey}
          onInitialOnboardingSubmit={onInitialOnboardingSubmit}
          focusCardRequest={focusCardRequest}
          tutorialCompletionExitRequest={tutorialCompletionExitRequest}
          journeyGuideState={journeyGuideState}
          onSizeChange={onSizeChange}
          onCommunicationsChange={onCommunicationsChange}
          onTrackerChange={onTrackerChange}
          onAcceleratorStateChange={onAcceleratorStateChange}
          onOpenAcceleratorStepNode={onOpenAcceleratorStepNode}
          onCloseAcceleratorStepNode={onCloseAcceleratorStepNode}
          onTutorialPrevious={onTutorialPrevious}
          onTutorialNext={onTutorialNext}
          onTutorialRestart={onTutorialRestart}
          onTutorialShortcutOpened={onTutorialShortcutOpened}
          onFocusCard={onFocusCard}
          onOnboardingFlowChange={onOnboardingFlowChange}
          onParticlesChange={onParticlesChange}
          onPersistNodePosition={onPersistNodePosition}
          onToggleCardVisibility={onToggleCardVisibility}
          onConnectCards={onConnectCards}
          onDisconnectConnection={onDisconnectConnection}
          onDisconnectAllConnections={onDisconnectAllConnections}
          onResetDefaultConnections={onResetDefaultConnections}
          onCursorConnectionStateChange={onCursorConnectionStateChange}
          onTutorialCompletionExitHandled={onTutorialCompletionExitHandled}
        />
      </div>
    </>
  )
}
