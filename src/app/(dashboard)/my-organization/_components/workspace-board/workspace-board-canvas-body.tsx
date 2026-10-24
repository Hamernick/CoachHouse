"use client"

import type { PlaceWorkspaceTool } from "./workspace-board-tool-placement"
import {
  WorkspaceSetupGuide,
} from "@/features/workspace-canvas-tutorial"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import type {
  WorkspaceCanvasCardFocusRequest,
  WorkspaceCanvasTutorialCompletionExitRequest,
} from "./workspace-canvas-v2/runtime/workspace-canvas-viewport-command"

import { WorkspaceBoardFlowSurface } from "./workspace-board-flow-surface"
import { WorkspaceBoardInitialOnboardingSurface } from "./workspace-board-initial-onboarding-surface"
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
  onTutorialRestart: _onTutorialRestart,
  onTutorialShortcutOpened,
  onFocusCard,
  onOnboardingFlowChange,
  onPersistNodePosition,
  onPlaceWorkspaceTool,
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
  onPersistNodePosition: (cardId: WorkspaceCardId, x: number, y: number) => void
  onPlaceWorkspaceTool: PlaceWorkspaceTool
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
  const router = useRouter()
  const canvasState = useMemo(() => ({
    ...boardState,
    onboardingFlow: { ...boardState.onboardingFlow, active: false },
  }), [boardState])
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
        tutorialCallout={null}
        onInvitesChange={onInvitesChange}
      />

      <div data-workspace-guide-canvas="true" className="relative flex min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {!seed.presentationMode ? <WorkspaceSetupGuide
          key={`${seed.viewerId}:${seed.orgId}`}
          scope={`${seed.viewerId}:${seed.orgId}`}
          onFocusCard={onFocusCard}
          initialActive={boardState.onboardingFlow.active}
          restartKey={tutorialRestartRequestKey}
          evidence={{ ...organizationEditorData.initialProfile, programCount: organizationEditorData.programs.length, canEdit: workspaceDataDrawerCanEdit, hasAcceleratorAccess: seed.hasAcceleratorAccess }}
          onClose={() => onOnboardingFlowChange({ ...boardState.onboardingFlow, active: false, updatedAt: new Date().toISOString() })}
        /> : null}
        <WorkspaceBoardFlowSurface
          seed={seed}
          organizationEditorData={organizationEditorData}
          financeInput={financeInput}
          boardState={canvasState}
          allowEditing={allowEditing}
          workspaceDataDrawerCanEdit={workspaceDataDrawerCanEdit}
          presentationMode={seed.presentationMode}
          workspaceRoomName={`org:${seed.orgId}:workspace${boardState.workspaceCanvasId ? `:${boardState.workspaceCanvasId}` : ""}`}
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
          onTutorialRestart={() => router.push("/workspace?guide=1", { scroll: false })}
          onTutorialShortcutOpened={onTutorialShortcutOpened}
          onFocusCard={onFocusCard}
          onOnboardingFlowChange={onOnboardingFlowChange}
          onPersistNodePosition={onPersistNodePosition}
          onPlaceWorkspaceTool={onPlaceWorkspaceTool}
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
