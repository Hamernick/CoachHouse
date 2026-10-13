import { describe, expect, it } from "vitest"

import {
  applyWorkspaceTutorialSnapshot,
  areWorkspaceOnboardingFlowStatesEqual,
  buildDefaultWorkspaceOnboardingFlowState,
  buildCompletedWorkspaceTutorialBoardState,
  buildRestartedWorkspaceTutorialBoardState,
  normalizeWorkspaceOnboardingFlowState,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-onboarding-flow"
import type { WorkspaceCanvasTutorialStepId } from "@/features/workspace-canvas-tutorial"
import type { WorkspaceBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"
import { buildDefaultBoardState, toggleWorkspaceBoardCardVisibility } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"

const BASE_BOARD_STATE: WorkspaceBoardState = {
  version: 1,
  preset: "balanced",
  autoLayoutMode: "dagre-tree",
  nodes: [
    { id: "organization-overview", x: 120, y: 220, size: "md" },
    { id: "programs", x: 632, y: 220, size: "md" },
    { id: "accelerator", x: 1144, y: 220, size: "sm" },
    { id: "brand-kit", x: 120, y: 692, size: "sm" },
    { id: "economic-engine", x: 1544, y: 220, size: "md" },
    { id: "calendar", x: 1544, y: 500, size: "sm" },
    { id: "communications", x: 1544, y: 988, size: "md" },
    { id: "deck", x: 480, y: 692, size: "md" },
    { id: "roadmap", x: 632, y: 220, size: "sm" },
    { id: "atlas", x: 840, y: 692, size: "md" },
  ],
  connections: [],
  communications: {
    channel: "social",
    mediaMode: "text",
    copy: "",
    scheduledFor: "",
    connectedChannels: { social: false, email: false, blog: false },
    channelConnections: {
      social: { connected: false, provider: null, connectedAt: null, connectedBy: null },
      email: { connected: false, provider: null, connectedAt: null, connectedBy: null },
      blog: { connected: false, provider: null, connectedAt: null, connectedBy: null },
    },
    activityByDay: {},
  },
  tracker: {
    tab: "accelerator",
    archivedAcceleratorGroups: [],
    categories: [],
    tickets: [],
  },
  accelerator: {
    activeStepId: null,
    completedStepIds: [],
  },
  acceleratorUi: {
    stepOpen: true,
    lastStepId: "intro",
  },
  onboardingFlow: buildDefaultWorkspaceOnboardingFlowState(),
  hiddenCardIds: ["brand-kit", "deck", "atlas"],
  visibility: {
    allCardsHiddenExplicitly: false,
  },
  updatedAt: "2026-03-09T12:00:00.000Z",
}

describe("workspace board onboarding flow equality", () => {
  it("keeps fiscal sponsorship hidden through new-board tutorial completion", () => {
    const initial = buildDefaultBoardState()
    const completed = buildCompletedWorkspaceTutorialBoardState(initial)
    expect(initial.hiddenCardIds).toContain("fiscal-sponsorship")
    expect(completed.hiddenCardIds).toContain("fiscal-sponsorship")
    const restarted = buildRestartedWorkspaceTutorialBoardState(completed)
    expect(restarted.hiddenCardIds).toContain("fiscal-sponsorship")
  })

  it("does not hide fiscal sponsorship that an existing organization opened", () => {
    const visible = toggleWorkspaceBoardCardVisibility(buildDefaultBoardState(), "fiscal-sponsorship")
    expect(buildCompletedWorkspaceTutorialBoardState(visible).hiddenCardIds).not.toContain("fiscal-sponsorship")
  })

  it("treats opened tutorial step changes as meaningful", () => {
    const base = buildDefaultWorkspaceOnboardingFlowState()
    const openedTutorialStepIds: WorkspaceCanvasTutorialStepId[] = ["accelerator"]
    const next = {
      ...base,
      openedTutorialStepIds,
    }

    expect(areWorkspaceOnboardingFlowStatesEqual(base, next)).toBe(false)
  })

  it("treats acknowledged tutorial step changes as meaningful", () => {
    const base = buildDefaultWorkspaceOnboardingFlowState()
    const acknowledgedTutorialStepIds: WorkspaceCanvasTutorialStepId[] = ["accelerator"]
    const next = {
      ...base,
      acknowledgedTutorialStepIds,
    }

    expect(areWorkspaceOnboardingFlowStatesEqual(base, next)).toBe(false)
  })

  it("treats otherwise identical flow state as equal", () => {
    const base = buildDefaultWorkspaceOnboardingFlowState()
    const next = {
      ...base,
      openedTutorialStepIds: [...base.openedTutorialStepIds],
      acknowledgedTutorialStepIds: [...base.acknowledgedTutorialStepIds],
      completedStages: [...base.completedStages],
    }

    expect(areWorkspaceOnboardingFlowStatesEqual(base, next)).toBe(true)
  })

  it("maps legacy completed tutorial steps into acknowledged-only state", () => {
    const next = normalizeWorkspaceOnboardingFlowState({
      active: true,
      tutorialStepIndex: 3,
      completedTutorialStepIds: ["accelerator"],
    })

    expect(next.openedTutorialStepIds).toEqual([])
    expect(next.acknowledgedTutorialStepIds).toEqual(["accelerator"])
  })

  it("applies a trimmed tutorial snapshot without locking positions or connections", () => {
    const next = applyWorkspaceTutorialSnapshot(BASE_BOARD_STATE, {
      ...BASE_BOARD_STATE.onboardingFlow,
      active: true,
      tutorialStepIndex: 2,
      openedTutorialStepIds: ["accelerator", "calendar"],
      acknowledgedTutorialStepIds: ["accelerator", "calendar"],
      updatedAt: "2026-03-09T12:05:00.000Z",
    })

    expect(next.onboardingFlow.openedTutorialStepIds).toEqual([])
    expect(next.onboardingFlow.acknowledgedTutorialStepIds).toEqual([])
    expect(next.hiddenCardIds).toContain("calendar")
    expect(next.hiddenCardIds).toContain("accelerator")
    expect(next.hiddenCardIds).not.toContain("organization-overview")
    expect(next.nodes).toBe(BASE_BOARD_STATE.nodes)
    expect(next.connections).toBe(BASE_BOARD_STATE.connections)
    expect(next.acceleratorUi?.stepOpen).toBe(false)
    expect(next.visibility?.allCardsHiddenExplicitly).toBe(false)
  })

  it("allows the welcome tutorial snapshot to hide the organization card", () => {
    const next = applyWorkspaceTutorialSnapshot(BASE_BOARD_STATE, {
      ...BASE_BOARD_STATE.onboardingFlow,
      active: true,
      tutorialStepIndex: 0,
      openedTutorialStepIds: [],
      acknowledgedTutorialStepIds: [],
      updatedAt: "2026-03-09T12:05:00.000Z",
    })

    expect(next.hiddenCardIds).toContain("organization-overview")
    expect(next.hiddenCardIds).toContain("accelerator")
    expect(next.hiddenCardIds).toContain("calendar")
    expect(next.hiddenCardIds).toContain("programs")
    expect(next.hiddenCardIds).toContain("roadmap")
    expect(next.hiddenCardIds).toContain("economic-engine")
    expect(next.hiddenCardIds).toContain("communications")
  })

  it("restarts the workspace tutorial from the beginning and closes the step node", () => {
    const next = buildRestartedWorkspaceTutorialBoardState({
      ...BASE_BOARD_STATE,
      onboardingFlow: {
        ...BASE_BOARD_STATE.onboardingFlow,
        active: false,
        tutorialStepIndex: 6,
        openedTutorialStepIds: ["accelerator", "accelerator-first-module"],
        acknowledgedTutorialStepIds: ["organization", "tool-buttons", "accelerator"],
        completedStages: [2, 3, 4],
      },
    })

    expect(next.onboardingFlow.active).toBe(true)
    expect(next.onboardingFlow.tutorialStepIndex).toBe(0)
    expect(next.onboardingFlow.openedTutorialStepIds).toEqual([])
    expect(next.onboardingFlow.acknowledgedTutorialStepIds).toEqual([])
    expect(next.onboardingFlow.completedStages).toEqual([])
    expect(next.hiddenCardIds).toContain("organization-overview")
    expect(next.hiddenCardIds).toContain("accelerator")
    expect(next.acceleratorUi?.stepOpen).toBe(false)
  })
})
