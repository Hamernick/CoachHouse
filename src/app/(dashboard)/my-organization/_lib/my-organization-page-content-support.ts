import type { User } from "@supabase/supabase-js"

import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import type { WorkspaceBoardState } from "../_components/workspace-board/workspace-board-types"
import type { ModuleCard } from "@/lib/accelerator/progress"
import { canInviteWorkspaceCollaborators } from "./workspace-state"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { WorkspaceAcceleratorCardStep } from "@/features/workspace-accelerator-card"
import type { resolveActiveOrganization } from "@/lib/organization/active-org"
import type { RoadmapSection } from "@/lib/roadmap"
import { buildOnboardingFlowDefaults } from "@/lib/onboarding/defaults"
import { buildSavedOnboardingFlowDefaults } from "@/lib/onboarding/saved-defaults"
import { buildInitialOrganizationProfile } from "./helpers"
import { hydrateWorkspaceSeedAcceleratorState } from "./my-organization-page-content-helpers"
import { resolveOrganizationProfileComplete } from "./my-organization-page-content-helpers"
import { countWorkspaceDocuments } from "./my-organization-page-content-helpers"
import type { FormationSummary } from "./types"
import { buildMyOrganizationCalendarView } from "./calendar"
import type { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"

type MyOrganizationRequestContext = NonNullable<
  Awaited<ReturnType<typeof resolveOptionalAuthenticatedAppContext>>
>

const WORKSPACE_PROGRAM_SELECT = [
  "id",
  "title",
  "subtitle",
  "description",
  "location",
  "location_type",
  "location_url",
  "team_ids",
  "image_url",
  "duration_label",
  "features",
  "status_label",
  "goal_cents",
  "raised_cents",
  "is_public",
  "created_at",
  "start_date",
  "end_date",
  "address_city",
  "address_state",
  "address_country",
  "cta_label",
  "cta_url",
  "wizard_snapshot",
].join(", ")

const WORKSPACE_PROGRAM_LEGACY_SELECT = [
  "id",
  "title",
  "subtitle",
  "location",
  "image_url",
  "duration_label",
  "features",
  "status_label",
  "goal_cents",
  "raised_cents",
  "is_public",
  "created_at",
  "start_date",
  "end_date",
].join(", ")

export async function buildWorkspaceOnboardingDefaults({
  needsOnboarding,
  builderPlanTier,
  orgProfile,
  orgSlug,
  requestContext,
  userMeta,
}: {
  needsOnboarding: boolean
  builderPlanTier: Parameters<
    typeof buildOnboardingFlowDefaults
  >[0]["builderPlanTier"]
  orgProfile: Record<string, unknown>
  orgSlug: string | null
  requestContext: MyOrganizationRequestContext
  userMeta: Record<string, unknown> | null
}) {
  const { profileAudience, user } = requestContext
  return buildSavedOnboardingFlowDefaults({
    organizationId: requestContext.activeOrg.orgId,
    supabase: requestContext.supabase,
    needsOnboarding: needsOnboarding || Boolean(orgProfile.name),
    userId: user.id,
    email: user.email ?? null,
    displayName:
      profileAudience.fullName ??
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null),
    avatarUrl:
      profileAudience.avatarUrl ??
      (typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null),
    profileTitle: profileAudience.headline,
    userMetadata: userMeta,
    orgProfile,
    orgSlug,
    builderPlanTier,
  })
}

export async function fetchWorkspacePrograms({
  supabase,
  orgId,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  orgId: string
}) {
  const primaryResult = await supabase
    .from("programs")
    .select(WORKSPACE_PROGRAM_SELECT)
    .eq("user_id", orgId)
    .order("created_at", { ascending: false })

  if (!primaryResult.error) {
    return (primaryResult.data ?? []) as unknown as OrgProgram[]
  }

  const legacyResult = await supabase
    .from("programs")
    .select(WORKSPACE_PROGRAM_LEGACY_SELECT)
    .eq("user_id", orgId)
    .order("created_at", { ascending: false })

  if (legacyResult.error) {
    console.error("workspace programs query failed", {
      orgId,
      primaryMessage: primaryResult.error.message,
      legacyMessage: legacyResult.error.message,
    })
    return []
  }

  return ((legacyResult.data ?? []) as unknown as OrgProgram[]).map(
    (program) => ({
      ...program,
      wizard_snapshot: null,
    })
  )
}

export function buildAcceleratorWorkspaceSeed({
  orgId,
  viewer,
  profileAudience,
  presentationMode,
  role,
  canEdit,
  isPlatformAdmin = false,
  hasWorkspaceAcceleratorAccess,
  organizationTitle,
  organizationSubtitle,
  fundingGoalCents,
  raisedCents,
  programsCount,
  peopleCount,
  organizationProfileComplete,
  teammateCount,
  workspaceDocumentCount,
  initialProfile,
  roadmapSections,
  formationSummary,
  acceleratorTimeline,
  calendarView,
  needsInitialOnboarding,
  onboardingDefaults,
  boardState,
}: {
  orgId: string
  viewer: {
    id: string
    email: string | null
    fullName: string | null
    avatarUrl: string | null
  }
  profileAudience: {
    fullName: string | null
    avatarUrl: string | null
  }
  presentationMode: boolean
  role: Awaited<ReturnType<typeof resolveActiveOrganization>>["role"]
  canEdit: boolean
  isPlatformAdmin?: boolean
  hasWorkspaceAcceleratorAccess: boolean
  organizationTitle: string
  organizationSubtitle: string
  fundingGoalCents: number
  raisedCents: number
  programsCount: number
  peopleCount: number
  organizationProfileComplete: boolean
  teammateCount: number
  workspaceDocumentCount: number
  initialProfile: ReturnType<typeof buildInitialOrganizationProfile>
  roadmapSections: RoadmapSection[]
  formationSummary: FormationSummary
  acceleratorTimeline: WorkspaceAcceleratorCardStep[]
  calendarView: ReturnType<typeof buildMyOrganizationCalendarView>
  needsInitialOnboarding: boolean
  onboardingDefaults: ReturnType<typeof buildOnboardingFlowDefaults>
  boardState: WorkspaceBoardState
}) {
  return hydrateWorkspaceSeedAcceleratorState(
    {
      orgId,
      viewerId: viewer.id,
      viewerName:
        profileAudience.fullName ??
        viewer.fullName ??
        viewer.email ??
        "Teammate",
      viewerAvatarUrl: profileAudience.avatarUrl ?? viewer.avatarUrl ?? null,
      isPlatformAdmin,
      presentationMode,
      role,
      canEdit,
      canInviteCollaborators: canInviteWorkspaceCollaborators(role),
      hasAcceleratorAccess: hasWorkspaceAcceleratorAccess,
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
          (step) => step.status !== "not_started"
        ),
        acceleratorCompletedStepCount: acceleratorTimeline.filter(
          (step) => step.status === "completed"
        ).length,
      },
      initialProfile,
      roadmapSections,
      formationSummary,
      acceleratorTimeline,
      activityFeed: [],
      calendar: calendarView,
      collaborationInvites: [],
      members: [
        {
          userId: viewer.id,
          name: profileAudience.fullName ?? viewer.fullName ?? null,
          email: viewer.email,
          avatarUrl: profileAudience.avatarUrl ?? viewer.avatarUrl ?? null,
          role,
          isOwner: viewer.id === orgId,
        },
      ],
      boardState,
      initialOnboarding: {
        required: needsInitialOnboarding,
        defaults: onboardingDefaults,
      },
    },
    acceleratorTimeline
  )
}

export function buildMyOrganizationDerivedMetrics({
  initialProfile,
  profile,
  programs,
  teammateCount,
  foundationRoadmapModules,
  acceleratorRoadmapModules,
}: {
  initialProfile: ReturnType<typeof buildInitialOrganizationProfile>
  profile: Record<string, unknown>
  programs: Array<{ goal_cents: number | null; raised_cents: number | null }>
  teammateCount: number
  foundationRoadmapModules: ModuleCard[]
  acceleratorRoadmapModules: ModuleCard[]
}) {
  const organizationProfileComplete =
    resolveOrganizationProfileComplete(initialProfile)
  const workspaceDocumentCount = countWorkspaceDocuments(profile)
  const programsCount = programs.length
  const fundingGoalCents = programs.reduce(
    (sum, program) => sum + (program.goal_cents ?? 0),
    0
  )
  const raisedCents = programs.reduce(
    (sum, program) => sum + (program.raised_cents ?? 0),
    0
  )
  const peopleCount = Math.max(1, teammateCount)
  const formationCompletedCount = foundationRoadmapModules.filter(
    (module) => module.status === "completed"
  ).length
  const formationProgressPercent =
    foundationRoadmapModules.length > 0
      ? Math.round(
          (formationCompletedCount / foundationRoadmapModules.length) * 100
        )
      : 0
  const nextFormationModule =
    foundationRoadmapModules.find((module) => module.status !== "completed") ??
    foundationRoadmapModules[0] ??
    null
  const nextFormationHref = nextFormationModule?.href ?? "/accelerator"
  const organizationTitle = (initialProfile.name ?? "").trim() || "Organization"
  const locationSubtitle = [
    (initialProfile.addressCity ?? "").trim(),
    (initialProfile.addressState ?? "").trim(),
  ]
    .filter(Boolean)
    .join(", ")
  const organizationSubtitle =
    (initialProfile.tagline ?? "").trim() || locationSubtitle || ""

  return {
    organizationProfileComplete,
    workspaceDocumentCount,
    programsCount,
    fundingGoalCents,
    raisedCents,
    peopleCount,
    organizationTitle,
    organizationSubtitle,
    formationSummary: {
      visibleModules: foundationRoadmapModules,
      acceleratorModules: acceleratorRoadmapModules,
      completedCount: formationCompletedCount,
      progressPercent: formationProgressPercent,
      nextHref: nextFormationHref,
    } satisfies FormationSummary,
  }
}

export function buildWorkspaceViewer(user: User) {
  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
  }
}
