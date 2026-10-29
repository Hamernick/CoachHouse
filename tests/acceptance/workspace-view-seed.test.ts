import { describe, expect, it, vi } from "vitest"

import { buildWorkspaceViewSeed } from "@/app/(dashboard)/my-organization/_lib/workspace-view"

type QueryResult<T> = Promise<{ data: T; error: unknown }>

function createQueryChain<T>({
  result,
  maybeSingleResult,
}: {
  result?: QueryResult<T>
  maybeSingleResult?: QueryResult<T>
}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    returns: vi.fn(() => result ?? Promise.resolve({ data: null as T, error: null })),
    maybeSingle: vi.fn(() => maybeSingleResult ?? Promise.resolve({ data: null as T, error: null })),
  }

  return chain
}

function buildSupabaseStub({
  boardState,
  boardError,
  invitesError,
  communicationsError,
  channelsError,
  objectiveGroupsError,
  objectivesError,
  communicationsData,
  calendarEventsData,
  moduleProgressData,
}: {
  boardState?: unknown
  boardError?: unknown
  invitesError?: unknown
  communicationsError?: unknown
  channelsError?: unknown
  objectiveGroupsError?: unknown
  objectivesError?: unknown
  communicationsData?: unknown[]
  calendarEventsData?: unknown[]
  moduleProgressData?: unknown[]
}) {
  const boardsQuery = createQueryChain({
    maybeSingleResult: Promise.resolve({
      data: { state: boardState ?? null },
      error: boardError ?? null,
    }),
  })
  const invitesQuery = createQueryChain({
    result: Promise.resolve({ data: [], error: invitesError ?? null }),
  })
  const communicationsQuery = createQueryChain({
    result: Promise.resolve({ data: communicationsData ?? null, error: communicationsError ?? null }),
  })
  const channelsQuery = createQueryChain({
    result: Promise.resolve({ data: null, error: channelsError ?? null }),
  })
  const membershipsQuery = createQueryChain({
    result: Promise.resolve({ data: [], error: null }),
  })
  const calendarEventsQuery = createQueryChain({
    result: Promise.resolve({ data: calendarEventsData ?? [], error: null }),
  })
  const moduleProgressQuery = createQueryChain({
    result: Promise.resolve({ data: moduleProgressData ?? [], error: null }),
  })
  const objectiveGroupsQuery = createQueryChain({
    result: Promise.resolve({ data: objectiveGroupsError ? null : [], error: objectiveGroupsError ?? null }),
  })
  const objectivesQuery = createQueryChain({
    result: Promise.resolve({ data: objectivesError ? null : [], error: objectivesError ?? null }),
  })
  const objectiveAssigneesQuery = createQueryChain({
    result: Promise.resolve({ data: [], error: null }),
  })
  const profilesQuery = createQueryChain({
    result: Promise.resolve({ data: [], error: null }),
  })

  return {
    from: vi.fn((table: string) => {
      if (table === "organization_workspace_boards") return boardsQuery
      if (table === "organization_workspace_invites") return invitesQuery
      if (table === "organization_workspace_communications") return communicationsQuery
      if (table === "organization_workspace_communication_channels") return channelsQuery
      if (table === "organization_memberships") return membershipsQuery
      if (table === "roadmap_calendar_internal_events") return calendarEventsQuery
      if (table === "module_progress") return moduleProgressQuery
      if (table === "organization_workspace_objective_groups") return objectiveGroupsQuery
      if (table === "organization_workspace_objectives") return objectivesQuery
      if (table === "organization_workspace_objective_assignees") return objectiveAssigneesQuery
      if (table === "profiles") return profilesQuery
      throw new Error(`Unexpected table query: ${table}`)
    }),
  }
}

describe("workspace view seed", () => {
  it("falls back to the default board state and no invites when legacy workspace tables are missing", async () => {
    const supabase = buildSupabaseStub({
      boardError: {
        code: "PGRST205",
        message:
          "Could not find the table 'public.organization_workspace_boards' in the schema cache",
      },
      invitesError: {
        code: "42P01",
        message: 'relation "organization_workspace_invites" does not exist',
      },
    })

    const seed = await buildWorkspaceViewSeed({
      supabase: supabase as never,
      orgId: "org-1",
      role: "owner",
      canEdit: true,
      hasAcceleratorAccess: false,
      presentationMode: false,
      viewer: {
        id: "org-1",
        email: "owner@example.com",
        fullName: "Owner One",
        avatarUrl: null,
      },
      organizationTitle: "Coach House",
      organizationSubtitle: "Nonprofit support",
      fundingGoalCents: 1_000_000,
      raisedCents: 250_000,
      programsCount: 2,
      peopleCount: 4,
      teammateCount: 4,
      organizationProfileComplete: false,
      workspaceDocumentCount: 0,
      initialProfile: {},
      roadmapSections: [],
      formationSummary: {},
      acceleratorTimeline: [],
      calendar: {},
    })

    expect(seed.boardState).toBeDefined()
    expect(seed.collaborationInvites).toEqual([])
    expect(Array.isArray(seed.boardState.hiddenCardIds)).toBe(true)
    expect(seed.viewerName).toBe("Owner One")
  })

  it("gracefully falls back when workspace communications tables are missing from schema cache", async () => {
    const supabase = buildSupabaseStub({
      communicationsError: {
        code: "PGRST205",
        message: "Could not find the table 'public.organization_workspace_communications' in the schema cache",
      },
      channelsError: {
        code: "PGRST205",
        message:
          "Could not find the table 'public.organization_workspace_communication_channels' in the schema cache",
      },
    })

    const seed = await buildWorkspaceViewSeed({
      supabase: supabase as never,
      orgId: "org-1",
      role: "owner",
      canEdit: true,
      hasAcceleratorAccess: false,
      presentationMode: false,
      viewer: {
        id: "org-1",
        email: "owner@example.com",
        fullName: "Owner One",
        avatarUrl: null,
      },
      organizationTitle: "Coach House",
      organizationSubtitle: "Nonprofit support",
      fundingGoalCents: 1_000_000,
      raisedCents: 250_000,
      programsCount: 2,
      peopleCount: 4,
      teammateCount: 4,
      organizationProfileComplete: false,
      workspaceDocumentCount: 0,
      initialProfile: {},
      roadmapSections: [],
      formationSummary: {},
      acceleratorTimeline: [],
      calendar: {},
    })

    expect(seed.boardState.communications.activityByDay).toEqual({})
    expect(seed.activityFeed).toEqual([])
    expect(seed.boardState.communications.channelConnections.social.connected).toBe(false)
    expect(seed.boardState.communications.channelConnections.email.connected).toBe(false)
    expect(seed.boardState.communications.channelConnections.blog.connected).toBe(false)
    expect(seed.viewerName).toBe("Owner One")
  })

  it("preserves persisted workspace communications state when communications tables are unavailable", async () => {
    const supabase = buildSupabaseStub({
      boardState: {
        communications: {
          channel: "email",
          mediaMode: "image",
          copy: "Persisted board update draft",
          scheduledFor: "2026-02-23T18:00:00.000Z",
          channelConnections: {
            social: { connected: false, provider: null, connectedAt: null, connectedBy: null },
            email: {
              connected: true,
              provider: "manual-email",
              connectedAt: "2026-02-22T12:00:00.000Z",
              connectedBy: "staff-1",
            },
            blog: { connected: false, provider: null, connectedAt: null, connectedBy: null },
          },
          activityByDay: {
            "2026-02-22": {
              status: "posted",
              channel: "email",
              timestamp: "2026-02-22T12:30:00.000Z",
            },
          },
        },
      },
      communicationsError: {
        code: "42P01",
        message: "relation \"organization_workspace_communications\" does not exist",
      },
    })

    const seed = await buildWorkspaceViewSeed({
      supabase: supabase as never,
      orgId: "org-1",
      role: "admin",
      canEdit: true,
      hasAcceleratorAccess: true,
      presentationMode: true,
      viewer: {
        id: "viewer-1",
        email: "viewer@example.com",
        fullName: "Viewer",
        avatarUrl: null,
      },
      organizationTitle: "Coach House",
      organizationSubtitle: "Support",
      fundingGoalCents: 2_000_000,
      raisedCents: 500_000,
      programsCount: 3,
      peopleCount: 8,
      teammateCount: 8,
      organizationProfileComplete: true,
      workspaceDocumentCount: 3,
      initialProfile: {},
      roadmapSections: [],
      formationSummary: {},
      acceleratorTimeline: [],
      calendar: {},
    })

    expect(seed.boardState.communications.channel).toBe("email")
    expect(seed.activityFeed).toEqual([])
    expect(seed.boardState.communications.mediaMode).toBe("image")
    expect(seed.boardState.communications.copy).toBe("Persisted board update draft")
    expect(seed.boardState.communications.channelConnections.email.connected).toBe(true)
    expect(seed.boardState.communications.channelConnections.email.provider).toBe("manual-email")
    expect(seed.boardState.communications.connectedChannels.email).toBe(true)
    expect(seed.boardState.communications.activityByDay["2026-02-22"]?.status).toBe("posted")
  })

  it.each([undefined, "selected-owner"])("builds activity for the resolved learner %s", async (learningUserId) => {
    const supabase = buildSupabaseStub({
      communicationsData: [
        {
          id: "post-1",
          channel: "social",
          media_mode: "text",
          content: "Scheduled update",
          status: "scheduled",
          scheduled_for: "2026-02-25T15:00:00.000Z",
          posted_at: null,
          created_by: "staff-1",
          created_at: "2026-02-24T10:00:00.000Z",
        },
      ],
      calendarEventsData: [
        {
          id: "event-1",
          title: "Board meeting",
          description: null,
          event_type: "board_meeting",
          starts_at: "2026-02-26T18:00:00.000Z",
          status: "active",
        },
      ],
      moduleProgressData: [
        {
          module_id: "11111111-1111-4111-8111-111111111111",
          status: "completed",
          completed_at: "2026-02-24T17:30:00.000Z",
          updated_at: "2026-02-24T17:30:00.000Z",
        },
      ],
    })

    const seed = await buildWorkspaceViewSeed({
      supabase: supabase as never,
      orgId: "org-1",
      learningUserId,
      role: "owner",
      canEdit: true,
      hasAcceleratorAccess: true,
      presentationMode: false,
      viewer: {
        id: "viewer-1",
        email: "viewer@example.com",
        fullName: "Viewer",
        avatarUrl: null,
      },
      organizationTitle: "Coach House",
      organizationSubtitle: "Support",
      fundingGoalCents: 2_000_000,
      raisedCents: 500_000,
      programsCount: 3,
      peopleCount: 8,
      teammateCount: 8,
      organizationProfileComplete: true,
      workspaceDocumentCount: 3,
      initialProfile: {},
      roadmapSections: [],
      formationSummary: {},
      acceleratorTimeline: [
        {
          id: "step-1",
          moduleId: "11111111-1111-4111-8111-111111111111",
          moduleTitle: "Launch your first campaign",
          stepKind: "video",
          stepTitle: "Video",
          stepDescription: null,
          href: "/accelerator/step-1",
          status: "completed",
          stepSequenceIndex: 0,
          stepSequenceTotal: 1,
          moduleSequenceIndex: 0,
          moduleSequenceTotal: 1,
          groupTitle: "Foundations",
          videoUrl: null,
          durationMinutes: null,
          resources: [],
          hasAssignment: false,
          hasDeck: false,
        },
      ],
      calendar: {},
    })

    expect(supabase.from("module_progress").eq).toHaveBeenCalledWith(
      "user_id", learningUserId ?? "viewer-1",
    )
    expect(seed.activityFeed.map((entry: { type: string }) => entry.type)).toEqual([
      "calendar_board_meeting",
      "social_scheduled",
      "accelerator",
    ])
  })
})
