"use client"

import type { WorkspaceParticleState } from "@/features/workspace-particles"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"

import { WORKSPACE_EDGE_SPECS } from "./workspace-board-copy"
import {
  areOrderedStringListsEqual,
  buildToggleCardVisibilityHandler,
  type WorkspaceCardFocusRequest,
  type WorkspaceTutorialCompletionExitRequest,
  useWorkspaceJourneyAutoFocus,
  useWorkspaceTutorialCompletion,
} from "./workspace-board-canvas-helpers"
import { saveWorkspaceBoardStateAction } from "../../_lib/workspace-actions"
import {
  logWorkspaceBoardDebug,
  summarizeWorkspaceBoardVisibility,
} from "./workspace-board-debug"
import { useWorkspaceNodePositionPersistence } from "./workspace-board-canvas-node-position-persistence"
import {
  applyWorkspaceTutorialSnapshot,
  areWorkspaceOnboardingFlowStatesEqual,
} from "./workspace-board-onboarding-flow"
import { WorkspaceBoardCanvasBody } from "./workspace-board-canvas-body"
import {
  usePersistWorkspaceBoardState,
  useWorkspaceBoardJourneyGuideState,
  useWorkspaceBoardTutorialNavigation,
  useWorkspaceRightRailCurrentUser,
} from "./workspace-board-canvas-state"
import { reduceWorkspaceBoardVisibility } from "./workspace-board-visibility-reducer"
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

export function WorkspaceBoardCanvas({
  initialFocusCardId = null,
  seed,
  onInitialOnboardingSubmit,
  organizationEditorData,
  financeInput,
}: {
  initialFocusCardId?: WorkspaceCardId | null
  seed: WorkspaceSeedData
  onInitialOnboardingSubmit: (form: FormData) => Promise<void>
  organizationEditorData: WorkspaceOrganizationEditorData
  financeInput: WorkspaceFinanceInput
}) {
  const presentationMode = seed.presentationMode
  const hydratedSeedBoardState = useMemo(() => {
    const reducedBoardState = reduceWorkspaceBoardVisibility(seed.boardState, {
      type: "hydrate_legacy_visibility",
    })
    const resolvedBoardState = reducedBoardState.onboardingFlow.active
      ? applyWorkspaceTutorialSnapshot(
          reducedBoardState,
          reducedBoardState.onboardingFlow
        )
      : reducedBoardState

    return initialFocusCardId
      ? {
          ...resolvedBoardState,
          hiddenCardIds: resolvedBoardState.hiddenCardIds.filter(
            (cardId) => cardId !== initialFocusCardId
          ),
        }
      : resolvedBoardState
  }, [initialFocusCardId, seed.boardState])
  const [boardState, setBoardState] = useState<WorkspaceBoardState>(
    hydratedSeedBoardState
  )
  const initialOnboardingActive =
    seed.initialOnboarding.required && !boardState.onboardingFlow.active
  const allowEditing =
    seed.canEdit && !presentationMode && !initialOnboardingActive
  const [invites, setInvites] = useState<WorkspaceCollaborationInvite[]>(
    seed.collaborationInvites
  )
  const [cursorConnectionState, setCursorConnectionState] = useState<
    "connecting" | "live" | "degraded"
  >("connecting")
  const [layoutFitRequestKey, setLayoutFitRequestKey] = useState(0)
  const [acceleratorFocusRequestKey, setAcceleratorFocusRequestKey] =
    useState(0)
  const [tutorialRestartRequestKey, setTutorialRestartRequestKey] = useState(0)
  const [focusCardRequest, setFocusCardRequest] =
    useState<WorkspaceCardFocusRequest>(
      initialFocusCardId ? { cardId: initialFocusCardId, requestKey: 1 } : null
    )
  const [tutorialCompletionExitRequest, setTutorialCompletionExitRequest] =
    useState<WorkspaceTutorialCompletionExitRequest>(null)
  const lastPersistedBoardContentRef = useRef<WorkspaceBoardState>(
    hydratedSeedBoardState
  )
  const persistRequestIdRef = useRef(0)
  const acceleratorStepNodeVisible = boardState.acceleratorUi?.stepOpen === true
  const tutorialActive = boardState.onboardingFlow.active
  const journeyGuideState = useWorkspaceBoardJourneyGuideState({
    seed,
    acceleratorState: boardState.accelerator,
    acceleratorStepNodeVisible,
  })
  useEffect(() => {
    if (!initialFocusCardId) return

    setBoardState((previous) => ({
      ...previous,
      hiddenCardIds: previous.hiddenCardIds.filter(
        (cardId) => cardId !== initialFocusCardId
      ),
    }))
    setFocusCardRequest((previous) => ({
      cardId: initialFocusCardId,
      requestKey: (previous?.requestKey ?? 0) + 1,
    }))
  }, [initialFocusCardId])
  useEffect(() => {
    logWorkspaceBoardDebug("board_seed_loaded", {
      orgId: seed.orgId,
      viewerId: seed.viewerId,
      ...summarizeWorkspaceBoardVisibility(hydratedSeedBoardState),
    })
  }, [hydratedSeedBoardState, seed.orgId, seed.viewerId])
  const handleSizeChange = useCallback(
    (cardId: WorkspaceCardId, size: WorkspaceCardSize) => {
      if (!allowEditing) return
      setBoardState((previous) => ({
        ...previous,
        nodes: previous.nodes.map((node) =>
          node.id === cardId && node.size !== size ? { ...node, size } : node
        ),
      }))
    },
    [allowEditing]
  )
  const handleCommunicationsChange = useCallback(
    (next: WorkspaceCommunicationsState) => {
      if (!allowEditing) return
      setBoardState((previous) => ({
        ...previous,
        communications: next,
      }))
    },
    [allowEditing]
  )
  const handleTrackerChange = useCallback((next: WorkspaceTrackerState) => {
    setBoardState((previous) => ({
      ...previous,
      tracker: next,
    }))
  }, [])
  const handleAcceleratorStateChange = useCallback(
    (next: WorkspaceBoardAcceleratorState) => {
      setBoardState((previous) => {
        const sameActiveStep =
          previous.accelerator.activeStepId === next.activeStepId
        const sameCompletedItems = areOrderedStringListsEqual(
          previous.accelerator.completedStepIds,
          next.completedStepIds
        )
        if (sameActiveStep && sameCompletedItems) {
          return previous
        }

        const nextState: WorkspaceBoardState = {
          ...previous,
          accelerator: next,
        }

        return reduceWorkspaceBoardVisibility(nextState, {
          type: "accelerator_step_sync",
          stepId: next.activeStepId,
        })
      })
    },
    []
  )
  const handleOnboardingFlowChange = useCallback(
    (next: WorkspaceBoardOnboardingFlowState) => {
      setBoardState((previous) => {
        const previousFlow = previous.onboardingFlow
        if (areWorkspaceOnboardingFlowStatesEqual(previousFlow, next)) {
          return previous
        }

        return {
          ...previous,
          onboardingFlow: next,
        }
      })
    },
    []
  )
  const handleCompleteTutorial = useWorkspaceTutorialCompletion({
    allowEditing,
    boardState,
    journeyGuideState,
    setBoardState,
    setTutorialCompletionExitRequest,
  })
  const {
    handleTutorialPrevious,
    handleTutorialNext,
    handleTutorialRestart,
    handleTutorialShortcutOpened,
  } = useWorkspaceBoardTutorialNavigation({
    currentTutorialStepIndex: boardState.onboardingFlow.tutorialStepIndex,
    setBoardState,
    onCompleteTutorial: handleCompleteTutorial,
    onRestart: () => {
      setFocusCardRequest(null)
      setTutorialCompletionExitRequest(null)
      setTutorialRestartRequestKey((previous) => previous + 1)
    },
  })
  const handlePersistNodePosition = useWorkspaceNodePositionPersistence({
    allowEditing,
    boardState,
    lastPersistedBoardContentRef,
    setBoardState,
  })
  const handleFocusCard = useCallback((cardId: WorkspaceCardId) => {
    setFocusCardRequest((previous) => ({
      cardId,
      requestKey: (previous?.requestKey ?? 0) + 1,
    }))
  }, [])
  const handleToggleCardVisibility = useMemo(
    () =>
      buildToggleCardVisibilityHandler({
        setBoardState,
        setAcceleratorFocusRequestKey,
      }),
    []
  )
  const handleOpenAcceleratorStepNode = useCallback(
    (stepId: string | null) => {
      setBoardState((previous) =>
        reduceWorkspaceBoardVisibility(previous, {
          type: "accelerator_step_open",
          stepId,
        })
      )
      if (boardState.autoLayoutMode === "timeline") {
        setAcceleratorFocusRequestKey((previous) => previous + 1)
      }
    },
    [boardState.autoLayoutMode]
  )

  const handleCloseAcceleratorStepNode = useCallback(
    (source: "dock" | "card" | "unknown" = "unknown") => {
      setBoardState((previous) =>
        reduceWorkspaceBoardVisibility(previous, {
          type: "accelerator_step_close",
          source,
        })
      )
    },
    []
  )

  const handleConnectCards = useCallback(
    (source: WorkspaceCardId, target: WorkspaceCardId) => {
      if (!allowEditing) return
      if (source === target) return

      setBoardState((previous) => {
        const hasConnection = previous.connections.some(
          (connection) =>
            connection.source === source && connection.target === target
        )
        if (hasConnection) return previous

        return {
          ...previous,
          connections: [
            ...previous.connections,
            {
              id: `edge-${source}-to-${target}-${Date.now().toString(36)}`,
              source,
              target,
            },
          ],
        }
      })
    },
    [allowEditing]
  )

  const handleDisconnectConnection = useCallback(
    (connectionId: string) => {
      if (!allowEditing) return
      setBoardState((previous) => ({
        ...previous,
        connections: previous.connections.filter(
          (connection) => connection.id !== connectionId
        ),
      }))
    },
    [allowEditing]
  )

  const handleDisconnectAllConnections = useCallback(() => {
    if (!allowEditing) return
    setBoardState((previous) => ({
      ...previous,
      connections: [],
    }))
  }, [allowEditing])

  const handleResetDefaultConnections = useCallback(() => {
    if (!allowEditing) return
    setBoardState((previous) => ({
      ...previous,
      connections: WORKSPACE_EDGE_SPECS.map((edge) => ({ ...edge })),
    }))
  }, [allowEditing])

  const handleParticlesChange = useCallback(
    (particles: WorkspaceParticleState) => {
      if (!allowEditing) return
      setBoardState((previous) => ({ ...previous, particles }))
    },
    [allowEditing]
  )

  const rightRailCurrentUser = useWorkspaceRightRailCurrentUser(seed)

  useWorkspaceJourneyAutoFocus({
    autoLayoutMode: boardState.autoLayoutMode,
    journeyGuideState,
    setFocusCardRequest,
    disabled: tutorialActive || tutorialCompletionExitRequest !== null,
    preserveFocusKeyWhenDisabled: tutorialCompletionExitRequest !== null,
  })
  usePersistWorkspaceBoardState({
    allowEditing,
    boardState,
    lastPersistedBoardContentRef,
    persistRequestIdRef,
    setBoardState,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceBoardCanvasBody
        initialOnboardingActive={initialOnboardingActive}
        seed={seed}
        allowEditing={allowEditing}
        boardState={boardState}
        invites={invites}
        cursorConnectionState={cursorConnectionState}
        rightRailCurrentUser={rightRailCurrentUser}
        layoutFitRequestKey={layoutFitRequestKey}
        acceleratorFocusRequestKey={acceleratorFocusRequestKey}
        tutorialRestartRequestKey={tutorialRestartRequestKey}
        focusCardRequest={focusCardRequest}
        tutorialCompletionExitRequest={tutorialCompletionExitRequest}
        journeyGuideState={journeyGuideState}
        organizationEditorData={organizationEditorData}
        financeInput={financeInput}
        onInitialOnboardingSubmit={onInitialOnboardingSubmit}
        onInvitesChange={setInvites}
        onSizeChange={handleSizeChange}
        onCommunicationsChange={handleCommunicationsChange}
        onTrackerChange={handleTrackerChange}
        onAcceleratorStateChange={handleAcceleratorStateChange}
        onOpenAcceleratorStepNode={handleOpenAcceleratorStepNode}
        onCloseAcceleratorStepNode={handleCloseAcceleratorStepNode}
        onTutorialPrevious={handleTutorialPrevious}
        onTutorialNext={handleTutorialNext}
        onTutorialRestart={handleTutorialRestart}
        onTutorialShortcutOpened={handleTutorialShortcutOpened}
        onFocusCard={handleFocusCard}
        onOnboardingFlowChange={handleOnboardingFlowChange}
        onParticlesChange={handleParticlesChange}
        onPersistNodePosition={handlePersistNodePosition}
        onToggleCardVisibility={handleToggleCardVisibility}
        onConnectCards={handleConnectCards}
        onDisconnectConnection={handleDisconnectConnection}
        onDisconnectAllConnections={handleDisconnectAllConnections}
        onResetDefaultConnections={handleResetDefaultConnections}
        onCursorConnectionStateChange={setCursorConnectionState}
        onTutorialCompletionExitHandled={() =>
          setTutorialCompletionExitRequest(null)
        }
      />
    </div>
  )
}
