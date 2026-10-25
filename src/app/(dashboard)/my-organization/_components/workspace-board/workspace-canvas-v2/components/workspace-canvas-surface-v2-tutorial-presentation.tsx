"use client"

import { type ReactNode } from "react"

import {
  resolveWorkspaceCanvasTutorialStep,
  WorkspaceCanvasTutorialPresentationSurface,
  WorkspaceCanvasTutorialStepId,
} from "@/features/workspace-canvas-tutorial"

import { ACCELERATOR_STEP_NODE_ID } from "../../workspace-board-flow-surface-accelerator-graph-composition"
import { WorkspaceBoardCard } from "../../workspace-board-node-card"
import type { WorkspaceBoardNodeData } from "../../workspace-board-node-types"
import type { WorkspaceCardId, WorkspaceCardSize } from "../../workspace-board-types"
import { WorkspaceTutorialCalendarPresentation } from "./workspace-canvas-surface-v2-tutorial-calendar-presentation"
import type { WorkspaceTutorialDockMask } from "./workspace-canvas-surface-v2-tutorial-docking"
import {
  WORKSPACE_TUTORIAL_PRESENTATION_FRAME_INSET,
  type WorkspaceTutorialPresentationFamily,
  resolveWorkspaceTutorialPresentationCardId,
  resolveWorkspaceTutorialPresentationLayoutSpec,
  shouldWorkspaceTutorialTrackEmbeddedAcceleratorRuntime,
  resolveWorkspaceTutorialPresentationSurfaceKind,
  WORKSPACE_TUTORIAL_PRESENTATION_SHELL_SIDE_PADDING,
} from "./workspace-canvas-surface-v2-tutorial-presentation-state"

type WorkspaceTutorialPresentation = {
  family: WorkspaceTutorialPresentationFamily
  content?: ReactNode
  key: string
  cardSize: WorkspaceCardSize
  shellWidth: number
  shellHeight: number
  layoutMode: "centered" | "paired-right-rail"
  surface: WorkspaceCanvasTutorialPresentationSurface | null
  dockMask?: WorkspaceTutorialDockMask | null
  suppressedNodeIds: string[]
} | null

type WorkspaceTutorialDockedCardId =
  | "organization-overview"

const WORKSPACE_TUTORIAL_DOCKED_CARD_IDS = new Set<WorkspaceTutorialDockedCardId>([
  "organization-overview",
])
const WORKSPACE_TUTORIAL_DOCK_SLOT_TOP_OFFSET = 264
const WORKSPACE_TUTORIAL_DOCK_FRAME_INSET = 10
const WORKSPACE_TUTORIAL_DOCK_SNAP_RADIUS = 120
const WORKSPACE_TUTORIAL_DASHED_FRAME_RADIUS = 32
const WORKSPACE_TUTORIAL_FRAMED_SURFACE_FRAME_RADIUS = 28

const NOOP_CARD_SIZE_CHANGE: WorkspaceBoardNodeData["onSizeChange"] = () => {}
const NOOP_ACCELERATOR_STATE_CHANGE: WorkspaceBoardNodeData["onAcceleratorStateChange"] =
  () => {}
const NOOP_ACCELERATOR_RUNTIME_CHANGE: NonNullable<
  WorkspaceBoardNodeData["onAcceleratorRuntimeChange"]
> = () => {}
const NOOP_ACCELERATOR_RUNTIME_ACTIONS_CHANGE: NonNullable<
  WorkspaceBoardNodeData["onAcceleratorRuntimeActionsChange"]
> = () => {}

function isWorkspaceTutorialDockedCardId(
  cardId: WorkspaceCardId,
): cardId is WorkspaceTutorialDockedCardId {
  return WORKSPACE_TUTORIAL_DOCKED_CARD_IDS.has(
    cardId as WorkspaceTutorialDockedCardId,
  )
}

function buildCardPresentation({
  cardId,
  tutorialStepIndex,
  openedStepIds,
  acceleratorModuleViewerOpen,
  cardDataLookup,
  cardMeasuredHeights,
}: {
  cardId: WorkspaceCardId
  tutorialStepIndex: number
  openedStepIds: WorkspaceCanvasTutorialStepId[]
  acceleratorModuleViewerOpen?: boolean
  cardDataLookup: Record<string, WorkspaceBoardNodeData>
  cardMeasuredHeights: Partial<
    Record<WorkspaceCardId, Partial<Record<WorkspaceCardSize, number>>>
  >
}): WorkspaceTutorialPresentation {
  const cardData = cardDataLookup[cardId]
  if (!cardData) return null
  const layoutSpec = resolveWorkspaceTutorialPresentationLayoutSpec({
    tutorialStepIndex,
    openedStepIds,
    acceleratorModuleViewerOpen,
    cardId,
    cardSize: cardData.size,
    measuredHeights: cardMeasuredHeights[cardId],
  })

  if (!layoutSpec) {
    return null
  }

  const presentationCardSize = layoutSpec.cardSize
  const surfaceSpec = layoutSpec.surface
  const presentationCardData: WorkspaceBoardNodeData = {
    ...cardData,
    presentationMode: cardId === "accelerator",
    size: presentationCardSize,
    onSizeChange: NOOP_CARD_SIZE_CHANGE,
  }
  const tutorialStepId = resolveWorkspaceCanvasTutorialStep(tutorialStepIndex).id
  const shouldTrackEmbeddedAcceleratorRuntime =
    cardId === "accelerator" &&
    shouldWorkspaceTutorialTrackEmbeddedAcceleratorRuntime(tutorialStepId)
  const resolvedPresentationCardData: WorkspaceBoardNodeData =
    cardId === "accelerator" && !shouldTrackEmbeddedAcceleratorRuntime
      ? {
          ...presentationCardData,
          onAcceleratorStateChange: NOOP_ACCELERATOR_STATE_CHANGE,
          onAcceleratorRuntimeChange: NOOP_ACCELERATOR_RUNTIME_CHANGE,
          onAcceleratorRuntimeActionsChange:
            NOOP_ACCELERATOR_RUNTIME_ACTIONS_CHANGE,
        }
      : presentationCardData
  const presentationSurfaceKind = resolveWorkspaceTutorialPresentationSurfaceKind({
    cardId,
    family: layoutSpec.family,
  })
  const framedSurface: WorkspaceCanvasTutorialPresentationSurface = {
    kind: presentationSurfaceKind,
    cardId,
    cardWidth: surfaceSpec.cardWidth,
    cardHeight: surfaceSpec.cardHeight,
    frameWidth: surfaceSpec.frameWidth,
    frameHeight: surfaceSpec.frameHeight,
    frameInset: WORKSPACE_TUTORIAL_PRESENTATION_FRAME_INSET,
    frameRadius:
      presentationSurfaceKind === "dashed-frame"
        ? WORKSPACE_TUTORIAL_DASHED_FRAME_RADIUS
        : WORKSPACE_TUTORIAL_FRAMED_SURFACE_FRAME_RADIUS,
    heightMode: layoutSpec.family === "accelerator-module" ? "fill" : "content",
    chrome: layoutSpec.chrome,
  }

  if (cardId === "calendar") {
    return {
      family: layoutSpec.family,
      key: "calendar",
      cardSize: presentationCardSize,
      shellWidth: layoutSpec.shellWidth,
      shellHeight: layoutSpec.shellHeight,
      layoutMode: layoutSpec.layoutMode,
      surface: framedSurface,
      suppressedNodeIds: [cardId],
      content: (
        <WorkspaceTutorialCalendarPresentation />
      ),
    }
  }

  if (cardId === "accelerator") {
    return {
      family: layoutSpec.family,
      key: "accelerator",
      cardSize: presentationCardSize,
      shellWidth: layoutSpec.shellWidth,
      shellHeight: layoutSpec.shellHeight,
      layoutMode: layoutSpec.layoutMode,
      surface: framedSurface,
      suppressedNodeIds: ["accelerator", ACCELERATOR_STEP_NODE_ID],
      content: (
        <div

          className="mx-auto"
          style={{ width: surfaceSpec.cardWidth }}
        >
          <WorkspaceBoardCard data={resolvedPresentationCardData} />
        </div>
      ),
    }
  }

  if (isWorkspaceTutorialDockedCardId(cardId)) {
    const frameWidth =
      surfaceSpec.cardWidth + WORKSPACE_TUTORIAL_DOCK_FRAME_INSET * 2
    const frameHeight =
      surfaceSpec.cardHeight + WORKSPACE_TUTORIAL_DOCK_FRAME_INSET * 2
    return {
      family: layoutSpec.family,
      key: cardId,
      cardSize: presentationCardSize,
      shellWidth: Math.max(
        layoutSpec.shellWidth,
        frameWidth + WORKSPACE_TUTORIAL_PRESENTATION_SHELL_SIDE_PADDING * 2,
      ),
      shellHeight: layoutSpec.shellHeight,
      layoutMode: layoutSpec.layoutMode,
      surface: {
        kind: "dashed-frame",
        cardId,
        cardWidth: surfaceSpec.cardWidth,
        cardHeight: surfaceSpec.cardHeight,
        frameWidth,
        frameHeight,
        frameInset: WORKSPACE_TUTORIAL_DOCK_FRAME_INSET,
        frameRadius: WORKSPACE_TUTORIAL_DASHED_FRAME_RADIUS,
        chrome: layoutSpec.chrome,
      },
      content: (
        <div
          className="mx-auto"
          style={{ width: surfaceSpec.cardWidth }}
        >
          <WorkspaceBoardCard data={resolvedPresentationCardData} />
        </div>
      ),
      dockMask: {
        cardId,
        cardWidth: surfaceSpec.cardWidth,
        cardHeight: surfaceSpec.cardHeight,
        frameWidth,
        frameHeight,
        cardInset: WORKSPACE_TUTORIAL_DOCK_FRAME_INSET,
        slotTopOffset: WORKSPACE_TUTORIAL_DOCK_SLOT_TOP_OFFSET,
        snapRadius: WORKSPACE_TUTORIAL_DOCK_SNAP_RADIUS,
      },
      suppressedNodeIds: [cardId],
    }
  }

  return {
    family: layoutSpec.family,
    key: cardId,
    cardSize: presentationCardSize,
    shellWidth: layoutSpec.shellWidth,
    shellHeight: layoutSpec.shellHeight,
    layoutMode: layoutSpec.layoutMode,
    surface: framedSurface,
    suppressedNodeIds: [cardId],
    content: (
      <div
        className="mx-auto"
        style={{ width: surfaceSpec.cardWidth }}
      >
        <WorkspaceBoardCard data={resolvedPresentationCardData} />
      </div>
    ),
  }
}

export function resolveWorkspaceTutorialPresentation({
  tutorialStepIndex,
  openedStepIds = [],
  acceleratorModuleViewerOpen = false,
  cardDataLookup,
  cardMeasuredHeights = {},
}: {
  tutorialStepIndex: number
  openedStepIds?: WorkspaceCanvasTutorialStepId[]
  acceleratorModuleViewerOpen?: boolean
  cardDataLookup: Record<string, WorkspaceBoardNodeData>
  cardMeasuredHeights?: Partial<
    Record<WorkspaceCardId, Partial<Record<WorkspaceCardSize, number>>>
  >
}): WorkspaceTutorialPresentation {
  const cardId = resolveWorkspaceTutorialPresentationCardId({
    tutorialStepIndex,
    openedStepIds,
  })

  if (cardId) {
    return buildCardPresentation({
      cardId,
      tutorialStepIndex,
      openedStepIds,
      acceleratorModuleViewerOpen,
      cardDataLookup,
      cardMeasuredHeights,
    })
  }

  return null
}
