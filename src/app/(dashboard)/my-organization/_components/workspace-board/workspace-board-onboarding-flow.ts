import {
  WORKSPACE_CANVAS_TUTORIAL_MANAGED_CARD_IDS,
  buildWorkspaceCanvasTutorialCompletionHiddenCardIds,
  clampWorkspaceCanvasTutorialStepIndex,
  resolveWorkspaceCanvasTutorialStepCount,
  resolveWorkspaceCanvasTutorialTrimmedStepIds,
  resolveWorkspaceCanvasTutorialVisibleCardIds,
} from "@/features/workspace-canvas-tutorial"
import { buildAutoLayoutNodesForMode } from "./workspace-board-auto-layout-modes"
import { buildDefaultWorkspaceConnections } from "./workspace-board-layout"
import { resolveCardDimensions, roundToSnap } from "./workspace-board-layout-config"
import type {
  WorkspaceBoardOnboardingFlowState,
  WorkspaceBoardState,
  WorkspaceCardId,
} from "./workspace-board-types"
import { normalizeWorkspaceHiddenCardIds } from "./workspace-board-hidden-cards"
import {
  getNextOnboardingStage,
  getPreviousOnboardingStage,
  resolveWorkspaceOnboardingStageFromSearchParam,
  WORKSPACE_ONBOARDING_STAGE_DEFINITIONS,
  WORKSPACE_ONBOARDING_STAGE_ORDER,
  type WorkspaceOnboardingStageDefinition,
} from "./workspace-board-onboarding-stages"
import {
  applyWorkspaceOnboardingStageOverride,
  areWorkspaceOnboardingFlowStatesEqual,
  buildDefaultWorkspaceOnboardingFlowState,
  normalizeWorkspaceOnboardingFlowState,
} from "./workspace-board-onboarding-flow-state"

export {
  applyWorkspaceOnboardingStageOverride,
  areWorkspaceOnboardingFlowStatesEqual,
  buildDefaultWorkspaceOnboardingFlowState,
  getNextOnboardingStage,
  getPreviousOnboardingStage,
  normalizeWorkspaceOnboardingFlowState,
  resolveWorkspaceOnboardingStageFromSearchParam,
  WORKSPACE_ONBOARDING_STAGE_DEFINITIONS,
  WORKSPACE_ONBOARDING_STAGE_ORDER,
}
export type { WorkspaceOnboardingStageDefinition }

const WORKSPACE_TUTORIAL_MANAGED_CARD_ID_SET = new Set<WorkspaceCardId>(
  WORKSPACE_CANVAS_TUTORIAL_MANAGED_CARD_IDS,
)

function resolveTutorialSnapshotFlowState(
  flowState: WorkspaceBoardOnboardingFlowState,
) {
  const tutorialStepIndex = clampWorkspaceCanvasTutorialStepIndex(
    flowState.tutorialStepIndex,
  )

  return {
    ...flowState,
    active: true,
    tutorialStepIndex,
    openedTutorialStepIds: resolveWorkspaceCanvasTutorialTrimmedStepIds(
      tutorialStepIndex,
      flowState.openedTutorialStepIds,
    ),
    acknowledgedTutorialStepIds: resolveWorkspaceCanvasTutorialTrimmedStepIds(
      tutorialStepIndex,
      flowState.acknowledgedTutorialStepIds,
    ),
  }
}

function resolveTutorialSnapshotHiddenCardIds(
  existingHiddenCardIds: WorkspaceCardId[],
  flowState: WorkspaceBoardOnboardingFlowState,
) {
  const nextVisibleCardIdSet = new Set<WorkspaceCardId>(
    resolveWorkspaceCanvasTutorialVisibleCardIds(
      flowState.tutorialStepIndex,
      flowState.openedTutorialStepIds,
    ) as WorkspaceCardId[],
  )
  const managedHiddenCardIds = WORKSPACE_CANVAS_TUTORIAL_MANAGED_CARD_IDS.filter(
    (cardId) => !nextVisibleCardIdSet.has(cardId),
  )
  const unmanagedHiddenCardIds = existingHiddenCardIds.filter(
    (cardId) => !WORKSPACE_TUTORIAL_MANAGED_CARD_ID_SET.has(cardId),
  )

  return normalizeWorkspaceHiddenCardIds([
    ...managedHiddenCardIds,
    ...unmanagedHiddenCardIds,
  ], {
    enforceFixedVisibleCards: false,
  })
}

export function applyWorkspaceTutorialSnapshot(
  boardState: WorkspaceBoardState,
  flowState: WorkspaceBoardOnboardingFlowState,
): WorkspaceBoardState {
  if (!flowState.active) {
    return {
      ...boardState,
      onboardingFlow: flowState,
    }
  }

  const nextFlowState = resolveTutorialSnapshotFlowState(flowState)
  const nextHiddenCardIds = resolveTutorialSnapshotHiddenCardIds(
    boardState.hiddenCardIds,
    nextFlowState,
  )
  const acceleratorHidden = nextHiddenCardIds.includes("accelerator")

  return {
    ...boardState,
    onboardingFlow: nextFlowState,
    hiddenCardIds: nextHiddenCardIds,
    visibility: {
      allCardsHiddenExplicitly: false,
    },
    acceleratorUi: boardState.acceleratorUi
      ? {
          ...boardState.acceleratorUi,
          stepOpen: acceleratorHidden ? false : boardState.acceleratorUi.stepOpen,
        }
      : boardState.acceleratorUi,
  }
}

export function buildRestartedWorkspaceTutorialBoardState(
  boardState: WorkspaceBoardState,
) {
  return applyWorkspaceTutorialSnapshot(boardState, {
    ...buildDefaultWorkspaceOnboardingFlowState(),
    active: true,
    updatedAt: new Date().toISOString(),
  })
}

function ensureWorkspaceTutorialCompletionConnections(
  connections: WorkspaceBoardState["connections"],
) {
  const nextConnections = new Map(
    connections.map((connection) => [
      `${connection.source}->${connection.target}`,
      connection,
    ]),
  )

  for (const connection of buildDefaultWorkspaceConnections()) {
    const key = `${connection.source}->${connection.target}`
    if (!nextConnections.has(key)) {
      nextConnections.set(key, connection)
    }
  }

  return Array.from(nextConnections.values())
}

const WORKSPACE_TUTORIAL_COMPLETION_LEFT_X = 96
const WORKSPACE_TUTORIAL_COMPLETION_TOP_Y = 192
const WORKSPACE_TUTORIAL_COMPLETION_COLUMN_GAP = 72

function buildWorkspaceTutorialCompletionNodes({
  existingNodes,
  hiddenCardIds,
  connections,
}: {
  existingNodes: WorkspaceBoardState["nodes"]
  hiddenCardIds: WorkspaceBoardState["hiddenCardIds"]
  connections: WorkspaceBoardState["connections"]
}) {
  const autoLayoutNodes = buildAutoLayoutNodesForMode({
    mode: "dagre-tree",
    existingNodes,
    hiddenCardIds,
    connections,
  })

  const nodeById = new Map(autoLayoutNodes.map((node) => [node.id, node] as const))
  const roadmapNode = nodeById.get("roadmap")
  const organizationNode = nodeById.get("organization-overview")
  const programsNode = nodeById.get("programs")
  const acceleratorNode = nodeById.get("accelerator")

  if (!roadmapNode || !organizationNode || !programsNode || !acceleratorNode) {
    return autoLayoutNodes
  }

  const acceleratorDimensions = resolveCardDimensions(
    acceleratorNode.size,
    "accelerator",
  )
  const roadmapDimensions = resolveCardDimensions(roadmapNode.size, "roadmap")
  const organizationDimensions = resolveCardDimensions(
    organizationNode.size,
    "organization-overview",
  )
  const acceleratorX = roundToSnap(WORKSPACE_TUTORIAL_COMPLETION_LEFT_X)
  const topY = roundToSnap(WORKSPACE_TUTORIAL_COMPLETION_TOP_Y)
  const roadmapX = roundToSnap(
    acceleratorX +
      acceleratorDimensions.width +
      WORKSPACE_TUTORIAL_COMPLETION_COLUMN_GAP,
  )
  const organizationX = roundToSnap(
    roadmapX +
      roadmapDimensions.width +
      WORKSPACE_TUTORIAL_COMPLETION_COLUMN_GAP,
  )
  const programsX = roundToSnap(
    organizationX +
      organizationDimensions.width +
      WORKSPACE_TUTORIAL_COMPLETION_COLUMN_GAP,
  )

  const completionPositionByCardId = new Map<
    WorkspaceCardId,
    { x: number; y: number }
  >([
    ["accelerator", { x: acceleratorX, y: topY }],
    ["roadmap", { x: roadmapX, y: topY }],
    ["organization-overview", { x: organizationX, y: topY }],
    ["programs", { x: programsX, y: topY }],
  ])

  return autoLayoutNodes.map((node) => {
    const override = completionPositionByCardId.get(node.id)
    if (!override) return node
    return {
      ...node,
      x: roundToSnap(override.x),
      y: roundToSnap(override.y),
    }
  })
}

export function buildCompletedWorkspaceTutorialBoardState(
  boardState: WorkspaceBoardState,
) {
  const completionAutoLayoutMode = "dagre-tree" as const
  const fiscalAlreadyVisible =
    boardState.nodes.some((node) => node.id === "fiscal-sponsorship") &&
    !boardState.hiddenCardIds.includes("fiscal-sponsorship")
  const nextHiddenCardIds = buildWorkspaceCanvasTutorialCompletionHiddenCardIds()
    .filter((id) => id !== "fiscal-sponsorship" || !fiscalAlreadyVisible)
  const nextConnections = ensureWorkspaceTutorialCompletionConnections(
    boardState.connections,
  )
  const compactCompletionNodes = boardState.nodes.map((node) =>
    node.id === "accelerator" && node.size === "lg"
      ? { ...node, size: "sm" as const }
      : node,
  )
  const nextState: WorkspaceBoardState = {
    ...boardState,
    autoLayoutMode: completionAutoLayoutMode,
    onboardingFlow: {
      ...boardState.onboardingFlow,
      active: false,
      tutorialStepIndex: resolveWorkspaceCanvasTutorialStepCount() - 1,
      openedTutorialStepIds: [],
      acknowledgedTutorialStepIds: [],
      updatedAt: new Date().toISOString(),
    },
    connections: nextConnections,
    hiddenCardIds: nextHiddenCardIds,
    visibility: {
      allCardsHiddenExplicitly: false,
    },
    nodes: compactCompletionNodes,
  }

  return {
    ...nextState,
    nodes: buildWorkspaceTutorialCompletionNodes({
      existingNodes: compactCompletionNodes,
      hiddenCardIds: nextHiddenCardIds,
      connections: nextConnections,
    }),
  }
}
