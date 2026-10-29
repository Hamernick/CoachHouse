import type { createSupabaseServerClient } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import type { OrganizationMemberRole } from "@/lib/organization/active-org"
import type { RoadmapSection } from "@/lib/roadmap"
import type { WorkspaceAcceleratorCardStep } from "@/features/workspace-accelerator-card"
import type { OnboardingFlowDefaults } from "@/components/onboarding/onboarding-dialog/types"

import {
  buildWorkspaceCommunicationActivityByDayFromPosts,
  canInviteWorkspaceCollaborators,
  readWorkspaceBoardStateValue,
  readWorkspaceCommunicationChannelConnectionsFromRows,
  readWorkspaceCommunicationPostsFromRows,
  readWorkspaceCollaborationInvitesFromRows,
  type WorkspaceCommunicationChannelConnectionRow,
  type WorkspaceCommunicationPostRow,
  type WorkspaceCollaborationInviteRow,
} from "./workspace-state"
import {
  buildWorkspaceActivityFeed,
  buildWorkspaceActivityHeatmapWindow,
  type WorkspaceActivityAcceleratorProgressRow,
  type WorkspaceActivityCalendarEventRow,
} from "./workspace-activity"
import {
  isMissingModuleProgressTableError,
  isMissingRoadmapCalendarInternalEventsTableError,
  isUuidLike,
  isMissingWorkspaceBoardsTableError,
  isMissingWorkspaceCommunicationChannelsTableError,
  isMissingWorkspaceCommunicationsTableError,
  isMissingWorkspaceInvitesTableError,
  isMissingWorkspaceObjectiveAssigneesTableError,
  isMissingWorkspaceObjectiveGroupsTableError,
  isMissingWorkspaceObjectivesTableError,
  mapObjectiveRowsToTrackerState,
} from "./workspace-view-helpers"
import {
  loadWorkspaceViewMemberSeed,
  type WorkspaceViewMembershipRow,
} from "./workspace-view-members"

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

type BuildWorkspaceViewSeedInput<
  TInitialProfile,
  TFormationSummary,
  TCalendarView,
> = {
  supabase: SupabaseServerClient
  orgId: string
  role: OrganizationMemberRole
  canEdit: boolean
  isPlatformAdmin?: boolean
  hasAcceleratorAccess: boolean
  learningUserId?: string
  presentationMode: boolean
  viewer: {
    id: string
    email: string | null
    fullName: string | null
    avatarUrl: string | null
  }
  organizationTitle: string
  organizationSubtitle: string
  fundingGoalCents: number
  raisedCents: number
  programsCount: number
  peopleCount: number
  teammateCount: number
  organizationProfileComplete: boolean
  workspaceDocumentCount: number
  initialProfile: TInitialProfile
  roadmapSections: RoadmapSection[]
  formationSummary: TFormationSummary
  acceleratorTimeline: WorkspaceAcceleratorCardStep[]
  calendar: TCalendarView
  initialOnboarding?: {
    required: boolean
    defaults: OnboardingFlowDefaults
  }
}

export async function buildWorkspaceViewSeed<
  TInitialProfile,
  TFormationSummary,
  TCalendarView,
>({
  supabase,
  orgId,
  role,
  canEdit, isPlatformAdmin = false,
  hasAcceleratorAccess,
  presentationMode,
  viewer,
  learningUserId = viewer.id,
  organizationTitle,
  organizationSubtitle,
  fundingGoalCents,
  raisedCents,
  programsCount,
  peopleCount,
  teammateCount,
  organizationProfileComplete,
  workspaceDocumentCount,
  initialProfile,
  roadmapSections,
  formationSummary,
  acceleratorTimeline,
  calendar,
  initialOnboarding,
}: BuildWorkspaceViewSeedInput<TInitialProfile, TFormationSummary, TCalendarView>) {
  const activityWindow = buildWorkspaceActivityHeatmapWindow()
  const acceleratorModuleIds = Array.from(
    new Set(
      acceleratorTimeline
        .map((step) => step.moduleId)
        .filter((moduleId) => isUuidLike(moduleId)),
    ),
  )
  const [
    boardResult,
    workspaceInvitesResult,
    workspaceCommunicationsResult,
    workspaceCommunicationsChannelsResult,
    membershipsResult,
    workspaceCalendarEventsResult,
    workspaceAcceleratorProgressResult,
    workspaceObjectiveGroupsResult,
    workspaceObjectivesResult,
    workspaceObjectiveAssigneesResult,
  ] = await Promise.all([
    supabase
      .from("organization_workspace_boards")
      .select("state")
      .eq("org_id", orgId)
      .maybeSingle<{ state: unknown }>(),
    supabase
      .from("organization_workspace_invites")
      .select(
        "id, user_id, user_name, user_email, created_by, created_at, expires_at, revoked_at, duration_value, duration_unit",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .returns<WorkspaceCollaborationInviteRow[]>(),
    supabase
      .from("organization_workspace_communications")
      .select("id, channel, media_mode, content, status, scheduled_for, posted_at, created_by, created_at")
      .eq("org_id", orgId)
      .order("scheduled_for", { ascending: false })
      .limit(240)
      .returns<WorkspaceCommunicationPostRow[]>(),
    supabase
      .from("organization_workspace_communication_channels")
      .select("org_id, channel, is_connected, provider, connected_by, connected_at")
      .eq("org_id", orgId)
      .returns<WorkspaceCommunicationChannelConnectionRow[]>(),
    supabase
      .from("organization_memberships")
      .select("member_id, role, member_email")
      .eq("org_id", orgId)
      .returns<WorkspaceViewMembershipRow[]>(),
    supabase
      .from("roadmap_calendar_internal_events")
      .select("id, title, description, event_type, starts_at, status")
      .eq("org_id", orgId)
      .neq("status", "canceled")
      .gte("starts_at", activityWindow.fromIso)
      .lte("starts_at", activityWindow.toIso)
      .order("starts_at", { ascending: true })
      .returns<WorkspaceActivityCalendarEventRow[]>(),
    acceleratorModuleIds.length > 0
      ? supabase
          .from("module_progress")
          .select("module_id, status, completed_at, updated_at")
          .eq("user_id", learningUserId)
          .in("module_id", acceleratorModuleIds)
          .returns<WorkspaceActivityAcceleratorProgressRow[]>()
      : Promise.resolve({ data: [], error: null } as { data: WorkspaceActivityAcceleratorProgressRow[]; error: null }),
    supabase
      .from("organization_workspace_objective_groups")
      .select("id, title, archived_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .returns<Array<{ id: string; title: string; archived_at: string | null; created_at: string }>>(),
    supabase
      .from("organization_workspace_objectives")
      .select("id, group_id, title, description, priority, due_at, status, created_at, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .returns<
        Array<{
          id: string
          group_id: string | null
          title: string
          description: string | null
          priority: string
          due_at: string | null
          status: string
          created_at: string
          updated_at: string
        }>
      >(),
    supabase
      .from("organization_workspace_objective_assignees")
      .select("objective_id, user_id")
      .eq("org_id", orgId)
      .returns<Array<{ objective_id: string; user_id: string }>>(),
  ])

  if (
    boardResult.error &&
    !isMissingWorkspaceBoardsTableError(boardResult.error)
  ) {
    throw supabaseErrorToError(boardResult.error, "Unable to load workspace board state.")
  }
  if (
    workspaceInvitesResult.error &&
    !isMissingWorkspaceInvitesTableError(workspaceInvitesResult.error)
  ) {
    throw supabaseErrorToError(workspaceInvitesResult.error, "Unable to load workspace collaboration invites.")
  }
  if (
    workspaceCommunicationsResult.error &&
    !isMissingWorkspaceCommunicationsTableError(workspaceCommunicationsResult.error)
  ) {
    throw supabaseErrorToError(
      workspaceCommunicationsResult.error,
      "Unable to load workspace communications.",
    )
  }
  if (
    workspaceCommunicationsChannelsResult.error &&
    !isMissingWorkspaceCommunicationChannelsTableError(workspaceCommunicationsChannelsResult.error)
  ) {
    throw supabaseErrorToError(
      workspaceCommunicationsChannelsResult.error,
      "Unable to load workspace communication channels.",
    )
  }
  if (
    workspaceCalendarEventsResult.error &&
    !isMissingRoadmapCalendarInternalEventsTableError(
      workspaceCalendarEventsResult.error,
    )
  ) {
    throw supabaseErrorToError(
      workspaceCalendarEventsResult.error,
      "Unable to load workspace calendar activity.",
    )
  }
  if (
    workspaceAcceleratorProgressResult.error &&
    !isMissingModuleProgressTableError(workspaceAcceleratorProgressResult.error)
  ) {
    throw supabaseErrorToError(
      workspaceAcceleratorProgressResult.error,
      "Unable to load workspace accelerator activity.",
    )
  }
  if (
    workspaceObjectiveGroupsResult.error &&
    !isMissingWorkspaceObjectiveGroupsTableError(workspaceObjectiveGroupsResult.error)
  ) {
    throw supabaseErrorToError(
      workspaceObjectiveGroupsResult.error,
      "Unable to load workspace objective groups.",
    )
  }
  if (
    workspaceObjectivesResult.error &&
    !isMissingWorkspaceObjectivesTableError(workspaceObjectivesResult.error)
  ) {
    throw supabaseErrorToError(
      workspaceObjectivesResult.error,
      "Unable to load workspace objectives.",
    )
  }
  if (
    workspaceObjectiveAssigneesResult.error &&
    !isMissingWorkspaceObjectiveAssigneesTableError(workspaceObjectiveAssigneesResult.error)
  ) {
    throw supabaseErrorToError(
      workspaceObjectiveAssigneesResult.error,
      "Unable to load workspace objective assignees.",
    )
  }

  const persistedBoardState = readWorkspaceBoardStateValue(boardResult.data?.state)
  const collaborationInvites = readWorkspaceCollaborationInvitesFromRows(workspaceInvitesResult.data)
  const communicationPosts = readWorkspaceCommunicationPostsFromRows(workspaceCommunicationsResult.data)
  const communicationChannelRows = workspaceCommunicationsChannelsResult.data ?? []
  const calendarActivityRows = workspaceCalendarEventsResult.data ?? []
  const acceleratorActivityRows = workspaceAcceleratorProgressResult.data ?? []
  const communicationChannelConnections = readWorkspaceCommunicationChannelConnectionsFromRows(
    communicationChannelRows,
  )
  const connectionChannelsReturned = new Set(
    communicationChannelRows
      .map((row) => row.channel)
      .filter((value): value is "social" | "email" | "blog" => value === "social" || value === "email" || value === "blog"),
  )
  const communicationActivityByDay = buildWorkspaceCommunicationActivityByDayFromPosts(communicationPosts)
  const activityFeed = buildWorkspaceActivityFeed({
    communicationPosts,
    calendarEvents: calendarActivityRows,
    acceleratorProgress: acceleratorActivityRows,
    acceleratorTimeline,
  })
  const persistedConnections = persistedBoardState.communications.channelConnections
  const mergedConnections = {
    social: connectionChannelsReturned.has("social")
      ? communicationChannelConnections.social
      : persistedConnections?.social ?? communicationChannelConnections.social,
    email: connectionChannelsReturned.has("email")
      ? communicationChannelConnections.email
      : persistedConnections?.email ?? communicationChannelConnections.email,
    blog: connectionChannelsReturned.has("blog")
      ? communicationChannelConnections.blog
      : persistedConnections?.blog ?? communicationChannelConnections.blog,
  }
  const boardState = {
    ...persistedBoardState,
    communications: {
      ...persistedBoardState.communications,
      connectedChannels: {
        social: mergedConnections.social.connected,
        email: mergedConnections.email.connected,
        blog: mergedConnections.blog.connected,
      },
      channelConnections: mergedConnections,
      activityByDay: {
        ...persistedBoardState.communications.activityByDay,
        ...communicationActivityByDay,
      },
    },
  }
  const mappedTrackerState = mapObjectiveRowsToTrackerState({
    groups: workspaceObjectiveGroupsResult.data ?? [],
    objectives: workspaceObjectivesResult.data ?? [],
    assignees: workspaceObjectiveAssigneesResult.data ?? [],
    tab: persistedBoardState.tracker.tab,
  })
  if (mappedTrackerState) {
    boardState.tracker = mappedTrackerState
  }

  const memberSeed = await loadWorkspaceViewMemberSeed({
    supabase,
    orgId,
    viewer,
    memberships: membershipsResult.data ?? [],
    collaborationInvites,
  })

  return {
    orgId,
    viewerId: viewer.id,
    viewerName: memberSeed.viewerName,
    viewerAvatarUrl: memberSeed.viewerAvatarUrl,
    isPlatformAdmin,
    presentationMode,
    role,
    canEdit,
    canInviteCollaborators: canInviteWorkspaceCollaborators(role),
    hasAcceleratorAccess,
    organizationTitle,
    organizationSubtitle,
    fundingGoalCents,
    raisedCents,
    programsCount,
    peopleCount,
    journeyReadiness: {
      organizationProfileComplete,
      teammateCount,
      workspaceDocumentCount,
      acceleratorStarted: acceleratorTimeline.some(
        (step) => step.status !== "not_started",
      ),
      acceleratorCompletedStepCount: acceleratorTimeline.filter(
        (step) => step.status === "completed",
      ).length,
    },
    initialProfile,
    roadmapSections,
    formationSummary,
    acceleratorTimeline,
    activityFeed,
    calendar,
    collaborationInvites: memberSeed.collaborationInvites,
    members: memberSeed.members,
    boardState,
    initialOnboarding: initialOnboarding ?? {
      required: false,
      defaults: {},
    },
  }
}
