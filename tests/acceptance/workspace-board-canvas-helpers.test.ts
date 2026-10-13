import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { resolveWorkspaceJourneyGuideState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-journey"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import {
  buildWorkspaceBoardStateWithNodePosition,
  buildToggleCardVisibilityHandler,
  resolveWorkspaceTutorialCompletionExitRequest,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-helpers"
import { buildCompletedWorkspaceTutorialBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-onboarding-flow"
import type {
  WorkspaceBoardState,
  WorkspaceSeedData,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

function buildSeed(
  overrides?: Omit<
    Partial<WorkspaceSeedData>,
    "journeyReadiness" | "initialProfile" | "calendar"
  > & {
    journeyReadiness?: Partial<WorkspaceSeedData["journeyReadiness"]>
    initialProfile?: Partial<WorkspaceSeedData["initialProfile"]>
    calendar?: Partial<WorkspaceSeedData["calendar"]>
  }
) {
  return {
    hasAcceleratorAccess: true,
    fundingGoalCents: 0,
    programsCount: 0,
    journeyReadiness: {
      organizationProfileComplete: true,
      teammateCount: 2,
      workspaceDocumentCount: 1,
      acceleratorStarted: false,
      acceleratorCompletedStepCount: 0,
      ...(overrides?.journeyReadiness ?? {}),
    },
    initialProfile: {
      brandPrimary: null,
      brandColors: [],
      boilerplate: null,
      ...(overrides?.initialProfile ?? {}),
    },
    roadmapSections: overrides?.roadmapSections ?? [],
    calendar: {
      nextEvent: null,
      upcomingEvents: [],
      ...(overrides?.calendar ?? {}),
    },
    ...(overrides ?? {}),
  } as unknown as WorkspaceSeedData
}

function buildNodePositionLookup(boardState: WorkspaceBoardState) {
  return new Map(
    boardState.nodes.map((node) => [
      node.id,
      {
        x: node.x,
        y: node.y,
      },
    ])
  )
}

function expectNodePositionsToMatch(
  boardState: WorkspaceBoardState,
  expectedPositions: Map<string, { x: number; y: number }>
) {
  for (const node of boardState.nodes) {
    expect({
      x: node.x,
      y: node.y,
    }).toEqual(expectedPositions.get(node.id))
  }
}

describe("workspace board canvas helpers", () => {
  it("updates a dropped node position without changing no-op placements", () => {
    const initialBoardState = buildDefaultBoardState("balanced")
    const next = buildWorkspaceBoardStateWithNodePosition({
      boardState: initialBoardState,
      cardId: "fiscal-sponsorship",
      x: 320,
      y: 904,
    })

    expect(next).not.toBe(initialBoardState)
    expect(
      next.nodes.find((node) => node.id === "fiscal-sponsorship")
    ).toMatchObject({
      x: 320,
      y: 904,
      positionMode: "manual",
    })

    expect(
      buildWorkspaceBoardStateWithNodePosition({
        boardState: next,
        cardId: "fiscal-sponsorship",
        x: 320,
        y: 904,
      })
    ).toBe(next)
  })

  it("composes manual ownership across selection-dragged root updates", () => {
    const initialBoardState = buildDefaultBoardState("balanced")
    const organizationMoved = buildWorkspaceBoardStateWithNodePosition({
      boardState: initialBoardState,
      cardId: "organization-overview",
      x: 480,
      y: 360,
    })
    const selectionMoved = buildWorkspaceBoardStateWithNodePosition({
      boardState: organizationMoved,
      cardId: "programs",
      x: 920,
      y: 360,
    })

    expect(
      selectionMoved.nodes.find((node) => node.id === "organization-overview")
    ).toMatchObject({ x: 480, y: 360, positionMode: "manual" })
    expect(
      selectionMoved.nodes.find((node) => node.id === "programs")
    ).toMatchObject({ x: 920, y: 360, positionMode: "manual" })
  })

  it("preserves board placement when toggling the fiscal sponsorship card", () => {
    const initialBoardState = buildDefaultBoardState("balanced")
    let boardState: WorkspaceBoardState = {
      ...initialBoardState,
      hiddenCardIds: initialBoardState.hiddenCardIds.filter(
        (cardId) => cardId !== "fiscal-sponsorship"
      ),
      nodes: initialBoardState.nodes.map((node) =>
        node.id === "fiscal-sponsorship"
          ? {
              ...node,
              x: 320,
              y: 904,
            }
          : node
      ),
    }
    let acceleratorFocusRequestKey = 0
    const toggleCardVisibility = buildToggleCardVisibilityHandler({
      setBoardState: (updater) => {
        boardState =
          typeof updater === "function" ? updater(boardState) : updater
      },
      setAcceleratorFocusRequestKey: (updater) => {
        acceleratorFocusRequestKey =
          typeof updater === "function"
            ? updater(acceleratorFocusRequestKey)
            : updater
      },
    })
    const expectedPositions = buildNodePositionLookup(boardState)

    toggleCardVisibility("fiscal-sponsorship", { source: "dock" })

    expect(boardState.hiddenCardIds).toContain("fiscal-sponsorship")
    expectNodePositionsToMatch(boardState, expectedPositions)
    expect(
      boardState.nodes.find((node) => node.id === "fiscal-sponsorship")
    ).toMatchObject({
      x: 320,
      y: 904,
    })

    toggleCardVisibility("fiscal-sponsorship", { source: "dock" })

    expect(boardState.hiddenCardIds).not.toContain("fiscal-sponsorship")
    expectNodePositionsToMatch(boardState, expectedPositions)
    expect(
      boardState.nodes.find((node) => node.id === "fiscal-sponsorship")
    ).toMatchObject({
      x: 320,
      y: 904,
    })
  })

  it("lands the completion state on the connected workspace graph", () => {
    const initial = buildDefaultBoardState("balanced")
    const next = buildCompletedWorkspaceTutorialBoardState(initial)

    expect(next.onboardingFlow.active).toBe(false)
    expect(next.autoLayoutMode).toBe("dagre-tree")
    expect(next.onboardingFlow.openedTutorialStepIds).toEqual([])
    expect(next.onboardingFlow.acknowledgedTutorialStepIds).toEqual([])
    expect(next.hiddenCardIds).not.toContain("organization-overview")
    expect(next.hiddenCardIds).not.toContain("programs")
    expect(next.hiddenCardIds).not.toContain("roadmap")
    expect(next.hiddenCardIds).not.toContain("accelerator")
    expect(next.hiddenCardIds).toContain("calendar")
    expect(next.hiddenCardIds).toContain("economic-engine")
    expect(next.hiddenCardIds).toContain("communications")
    expect(
      next.connections.some(
        (connection) =>
          connection.source === "organization-overview" &&
          connection.target === "programs"
      )
    ).toBe(true)
    expect(
      next.connections.some(
        (connection) =>
          connection.source === "organization-overview" &&
          connection.target === "roadmap"
      )
    ).toBe(true)
    expect(
      next.connections.some(
        (connection) =>
          connection.source === "organization-overview" &&
          connection.target === "accelerator"
      )
    ).toBe(true)
    expect(
      next.connections.some(
        (connection) =>
          connection.source === "accelerator" &&
          connection.target === "calendar"
      )
    ).toBe(true)

    const organization = next.nodes.find(
      (node) => node.id === "organization-overview"
    )
    const programs = next.nodes.find((node) => node.id === "programs")
    const roadmap = next.nodes.find((node) => node.id === "roadmap")
    const accelerator = next.nodes.find((node) => node.id === "accelerator")
    const calendar = next.nodes.find((node) => node.id === "calendar")

    expect(organization).toBeTruthy()
    expect(programs).toBeTruthy()
    expect(roadmap).toBeTruthy()
    expect(accelerator).toBeTruthy()
    expect(calendar).toBeTruthy()
    expect(accelerator?.size).toBe("sm")
    expect(accelerator?.x ?? 0).toBeLessThan(roadmap?.x ?? 0)
    expect(roadmap?.x ?? 0).toBeLessThan(organization?.x ?? 0)
    expect(organization?.x ?? 0).toBeLessThan(programs?.x ?? 0)
    expect(programs?.y ?? 0).toBe(organization?.y ?? 0)
    expect(calendar?.y ?? 0).toBeGreaterThan(organization?.y ?? 0)
  })

  it("resolves one explicit completion exit request from the completed board state", () => {
    const seed = buildSeed()
    const timelineBoardState = {
      ...buildDefaultBoardState("balanced"),
      autoLayoutMode: "timeline" as const,
    }
    const nextTimelineBoardState =
      buildCompletedWorkspaceTutorialBoardState(timelineBoardState)
    const journeyGuideState = resolveWorkspaceJourneyGuideState({
      seed,
      acceleratorState: timelineBoardState.accelerator,
      acceleratorStepNodeVisible: false,
    })

    expect(
      resolveWorkspaceTutorialCompletionExitRequest({
        boardState: nextTimelineBoardState,
        targetCardId: journeyGuideState.targetCardId,
        requestKey: 7,
      })
    ).toEqual({
      kind: "fit-visible",
      requestKey: 7,
    })

    const dagreBoardState = {
      ...buildDefaultBoardState("balanced"),
      autoLayoutMode: "dagre-tree" as const,
    }
    const nextDagreBoardState =
      buildCompletedWorkspaceTutorialBoardState(dagreBoardState)

    expect(
      resolveWorkspaceTutorialCompletionExitRequest({
        boardState: nextDagreBoardState,
        targetCardId: journeyGuideState.targetCardId,
        requestKey: 8,
      })
    ).toEqual({
      kind: "fit-visible",
      requestKey: 8,
    })
  })

  it("does not fire journey autofocus on initial canvas mount", () => {
    const source = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-helpers.ts"
    )

    expect(source).toContain(
      "const didInitializeJourneyFocusRef = useRef(false)"
    )
    expect(source).toContain("if (!didInitializeJourneyFocusRef.current)")
    expect(source).toContain("lastJourneyFocusKeyRef.current =")
    expect(source).toContain('autoLayoutMode === "timeline" && !disabled')
  })
})
