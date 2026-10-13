import { describe, expect, it } from "vitest"

import { resolveWorkspaceCanvasCardReadinessMap } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/runtime/workspace-canvas-card-readiness"
import type {
  WorkspaceBoardState,
  WorkspaceSeedData,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"
import { buildInitialOrganizationProfile } from "@/app/(dashboard)/my-organization/_lib/helpers"
import { WORKSPACE_CANVAS_V2_CARD_IDS } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/contracts/workspace-card-contract"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { ROADMAP_SECTION_IDS } from "@/lib/roadmap/definitions"

function makeBoardState(): WorkspaceBoardState {
  return {
    version: 1,
    preset: "balanced",
    autoLayoutMode: "dagre-tree",
    nodes: [],
    connections: [],
    accelerator: {
      activeStepId: null,
      completedStepIds: [],
    },
    communications: {
      channel: "social",
      mediaMode: "text",
      copy: "",
      scheduledFor: "",
      connectedChannels: {
        social: false,
        email: false,
        blog: false,
      },
      channelConnections: {
        social: {
          connected: false,
          provider: null,
          connectedAt: null,
          connectedBy: null,
        },
        email: {
          connected: false,
          provider: null,
          connectedAt: null,
          connectedBy: null,
        },
        blog: {
          connected: false,
          provider: null,
          connectedAt: null,
          connectedBy: null,
        },
      },
      activityByDay: {},
    },
    tracker: {
      tab: "accelerator",
      archivedAcceleratorGroups: [],
      categories: [],
      tickets: [],
    },
    onboardingFlow: {
      active: false,
      stage: 4,
      tutorialStepIndex: 0,
      openedTutorialStepIds: [],
      acknowledgedTutorialStepIds: [],
      completedStages: [],
      updatedAt: "2026-04-29T00:00:00.000Z",
    },
    hiddenCardIds: [],
    updatedAt: "2026-04-29T00:00:00.000Z",
  }
}

function makeSeed(
  roadmapSections: Array<Record<string, unknown>>
): WorkspaceSeedData {
  const boardState = makeBoardState()
  const rawProfile = {
    name: "Coach House",
    roadmap: {
      sections: roadmapSections,
    },
  }

  return {
    orgId: "org-1",
    viewerId: "user-1",
    viewerName: "Test User",
    viewerAvatarUrl: null,
    presentationMode: false,
    role: "owner",
    canEdit: true,
    canInviteCollaborators: true,
    hasAcceleratorAccess: true,
    organizationTitle: "Coach House",
    organizationSubtitle: "",
    fundingGoalCents: 0,
    raisedCents: 0,
    programsCount: 0,
    peopleCount: 0,
    journeyReadiness: {
      organizationProfileComplete: false,
      teammateCount: 0,
      workspaceDocumentCount: 0,
      acceleratorStarted: false,
      acceleratorCompletedStepCount: 0,
    },
    initialProfile: buildInitialOrganizationProfile({
      profile: rawProfile,
      organization: {
        ein: null,
        public_slug: null,
        is_public: null,
      },
    }),
    roadmapSections: resolveRoadmapSections(rawProfile),
    formationSummary: {} as WorkspaceSeedData["formationSummary"],
    activityFeed: [],
    calendar: {
      monthLabel: "October", previousMonthHref: "", nextMonthHref: "",
      previousMonthLabel: "September", nextMonthLabel: "November", grid: [],
      weekdayLabels: [], eventDays: new Set<number>(), selectedDay: null,
      nextEvent: null,
      upcomingEvents: [],
    } as WorkspaceSeedData["calendar"],
    collaborationInvites: [],
    members: [],
    boardState,
    initialOnboarding: {
      required: false,
      defaults: {},
    } as WorkspaceSeedData["initialOnboarding"],
  }
}

describe("workspace canvas card readiness", () => {
  it("returns readiness for every canvas card id", () => {
    const seed = makeSeed([])
    const readinessMap = resolveWorkspaceCanvasCardReadinessMap({
      seed,
      boardState: seed.boardState,
    })

    expect(Object.keys(readinessMap).sort()).toEqual(
      [...WORKSPACE_CANVAS_V2_CARD_IDS].sort()
    )
    expect(readinessMap["fiscal-sponsorship"]).toEqual({
      status: "partial",
      isReady: false,
    })
  })

  it("marks the roadmap card partial when stored status is stale but content exists", () => {
    const seed = makeSeed([
      {
        id: "need",
        content: "Families need after-school support.",
        status: "not_started",
      },
    ])

    expect(
      resolveWorkspaceCanvasCardReadinessMap({
        seed,
        boardState: seed.boardState,
      }).roadmap
    ).toEqual({
      status: "partial",
      isReady: false,
    })
  })

  it("marks the roadmap card ready when every roadmap section is complete", () => {
    const seed = makeSeed(
      ROADMAP_SECTION_IDS.map((id) => ({
        id,
        content: `${id} complete`,
        status: "complete",
      }))
    )

    expect(
      resolveWorkspaceCanvasCardReadinessMap({
        seed,
        boardState: seed.boardState,
      }).roadmap
    ).toEqual({
      status: "ready",
      isReady: true,
    })
  })
})
