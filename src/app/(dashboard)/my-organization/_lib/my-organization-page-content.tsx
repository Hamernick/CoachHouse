import { redirect, notFound } from "next/navigation"
import { workspaceIdSchema } from "@/features/workspace-management"
import { loadOrganizationWorkspaceFinanceInput } from "@/actions/workspace-finance-helpers"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canEditOrganization } from "@/lib/organization/active-org"
import { measureServerStep } from "@/lib/performance/server-timing"
import type { Json } from "@/lib/supabase"
import { fetchAcceleratorProgressSummary } from "@/lib/accelerator/progress"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { resolvePricingPlanTier } from "@/lib/billing/plan-tier"
import { getWorkspaceAcceleratorPaywallPath } from "@/lib/workspace/routes"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { buildWorkspaceAcceleratorCardSteps } from "@/features/workspace-accelerator-card"
import { completeOnboardingAction } from "../../onboarding/actions"
import { buildMyOrganizationCalendarView } from "./calendar"
import { applyOrganizationAcceleratorProgressOverrides } from "./my-organization-accelerator-progress"
import {
  buildAcceleratorTimelineModules,
  buildModuleGroupMetaById,
} from "./my-organization-accelerator-timeline"
import {
  buildAcceleratorWorkspaceSeed,
  buildMyOrganizationDerivedMetrics,
  buildWorkspaceOnboardingDefaults,
  buildWorkspaceViewer,
  fetchWorkspacePrograms,
} from "./my-organization-page-content-support"
import { mapUpcomingEvents, buildWorkspaceCalendarView, type UpcomingEventRow } from "./upcoming-events"
import { buildWorkspaceViewSeed } from "./workspace-view"
import {
  applyWorkspaceOnboardingStageToSeed,
  applyWorkspaceTutorialActivationToSeed,
  hydrateWorkspaceSeedAcceleratorState,
  partitionRoadmapModules,
} from "./my-organization-page-content-helpers"
import { isMissingWorkspaceBoardsTableError } from "./workspace-view-helpers"
import { readWorkspaceBoardStateValue } from "./workspace-state"
import type { MyOrganizationSearchParams } from "./types"
import { buildWorkspaceOrganizationEditorData } from "./workspace-organization-editor-data"
import { loadMyOrganizationProfileContext } from "./my-organization-page-profile"
import {
  redirectLegacyMyOrganizationTab,
  resolveMyOrganizationPageSearchState,
} from "./my-organization-page-search"
import {
  getOnboarding,
  resolveInitialWorkspaceDrawerData,
} from "./my-organization-page-state"
import {
  loadMyOrganizationFiscalSponsorshipWorkflow,
  resolveFiscalApplicantPrefillIdentity,
} from "./my-organization-page-fiscal"
import {
  buildWorkspacePeopleData,
  loadOrganizationPeopleTaxonomy,
} from "./workspace-people-segments"

function loadAcceleratorSteps(
  input: Parameters<typeof buildAcceleratorTimelineModules>[0]
) {
  return measureServerStep(
    "workspace.content.build_accelerator_timeline",
    () => buildAcceleratorTimelineModules(input),
    { thresholdMs: 750 }
  ).then(buildWorkspaceAcceleratorCardSteps)
}

function loadWorkspaceProfileContext(
  input: Parameters<typeof loadMyOrganizationProfileContext>[0]
) {
  return measureServerStep(
    "workspace.content.load_profile_context",
    () => loadMyOrganizationProfileContext(input),
    { thresholdMs: 750 }
  )
}

export default async function MyOrganizationPage({
  searchParams,
}: {
  searchParams?: Promise<MyOrganizationSearchParams>
}) {
  const searchState = await resolveMyOrganizationPageSearchState(searchParams)
  const workspaceParam = searchState.resolvedSearchParams?.workspace
  const workspaceCanvasId = typeof workspaceParam === "string" ? workspaceParam : undefined
  if (workspaceParam !== undefined && !workspaceIdSchema.safeParse(workspaceParam).success) notFound()
  const requestContext = await resolveOptionalAuthenticatedAppContext()
  if (!requestContext) redirect("/login?redirect=/organization")
  const { supabase, user, profileAudience, activeOrg } = requestContext
  const { orgId, role } = activeOrg
  const isAdmin = profileAudience.isAdmin
  const { orgRow, profile, initialProfile, roadmapSections } =
    await loadWorkspaceProfileContext({ supabase, orgId })
  const { userMeta, needsInitialOnboarding } = getOnboarding(requestContext, {
    profile,
    publicSlug: orgRow?.public_slug ?? null,
  })
  const canEdit = isAdmin || canEditOrganization(role)
  const { initialDrawerData } = resolveInitialWorkspaceDrawerData({
    acceleratorGroupParam: searchState.acceleratorGroupParam,
    acceleratorModuleParam: searchState.acceleratorModuleParam,
    acceleratorStepParam: searchState.acceleratorStepParam,
    drawerParam: searchState.drawerParam,
    focusParam: searchState.focusParam,
    needsInitialOnboarding,
    programIdParam: searchState.programIdParam,
    roadmapSectionParam: searchState.roadmapSectionParam,
    tabParam: searchState.tabParam,
    viewParam: searchState.viewParam,
  })
  redirectLegacyMyOrganizationTab({
    tabParam: searchState.tabParam,
    focusParam: searchState.focusParam,
    roadmapSectionParam: searchState.roadmapSectionParam,
  })
  const acceleratorViewRequested = searchState.viewParam === "accelerator"
  const presentationMode =
    searchState.modeParam === "present" ||
    searchState.modeParam === "presentation"
  const nowIso = new Date().toISOString()
  const [
    programsResult,
    upcomingEventsResult,
    acceleratorProgress,
    activeSubscriptionResult,
    entitlements,
    organizationPeopleTaxonomy,
  ] = await measureServerStep(
    "workspace.content.load_parallel_data",
    () =>
      Promise.all([
        fetchWorkspacePrograms({ supabase, orgId }),
        acceleratorViewRequested
          ? Promise.resolve({
              data: [] as UpcomingEventRow[],
              error: null,
            } as { data: UpcomingEventRow[]; error: null })
          : supabase
              .from("roadmap_calendar_internal_events")
              .select(
                "id,title,description,event_type,starts_at,ends_at,all_day,recurrence,status,assigned_roles,updated_at"
              )
              .eq("org_id", orgId)
              .gte("starts_at", nowIso)
              .eq("status", "active")
              .order("starts_at", { ascending: true })
              .limit(5)
              .returns<UpcomingEventRow[]>(),
        fetchAcceleratorProgressSummary({
          supabase,
          userId: user.id,
          isAdmin,
          basePath: "/accelerator",
        }),
        supabase
          .from("subscriptions")
          .select("status, metadata")
          .eq("user_id", orgId)
          .in("status", ["active", "trialing", "past_due", "incomplete"])
          .not("stripe_subscription_id", "ilike", "stub_%")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ status: string | null; metadata: Json | null }>(),
        fetchLearningEntitlements({
          supabase,
          userId: user.id,
          orgUserId: orgId,
          isAdmin,
        }),
        loadOrganizationPeopleTaxonomy({ orgId, supabase }),
      ]),
    { thresholdMs: 1_000 }
  )
  const upcomingEvents = mapUpcomingEvents(upcomingEventsResult.data)
  const currentPlanTier = resolvePricingPlanTier(
    activeSubscriptionResult.data ?? null
  )
  const hasPaidPlan = currentPlanTier !== "free"
  const hasWorkspaceAcceleratorAccess =
    entitlements.hasAcceleratorAccess || entitlements.hasElectiveAccess
  const acceleratorProgressSummary =
    applyOrganizationAcceleratorProgressOverrides(
      acceleratorProgress,
      initialProfile,
      orgRow?.public_slug
    )
  const calendarView = buildMyOrganizationCalendarView({
    monthParam: searchState.monthParam,
    searchParams: searchState.resolvedSearchParams,
    upcomingEvents,
  })
  const {
    sortedRoadmapModules,
    foundationRoadmapModules,
    acceleratorRoadmapModules,
  } = partitionRoadmapModules(
    acceleratorProgressSummary.groups.flatMap((group) => group.modules)
  )
  const { peopleNormalized, peopleSegments, peopleTags } =
    buildWorkspacePeopleData({ profile, ...organizationPeopleTaxonomy })
  const onboardingDefaults = await buildWorkspaceOnboardingDefaults({
    needsOnboarding: needsInitialOnboarding,
    orgSlug: orgRow?.public_slug ?? null,
    builderPlanTier: currentPlanTier,
    orgProfile: profile,
    requestContext,
    userMeta,
  })
  const programRows = (programsResult ?? []) as Array<{
    goal_cents: number | null
    raised_cents: number | null
  }>
  const teammateCount = peopleNormalized.length
  const {
    formationSummary,
    fundingGoalCents,
    organizationProfileComplete,
    organizationSubtitle,
    organizationTitle,
    peopleCount,
    programsCount,
    raisedCents,
    workspaceDocumentCount,
  } = buildMyOrganizationDerivedMetrics({
    initialProfile,
    profile,
    programs: programRows,
    teammateCount,
    foundationRoadmapModules,
    acceleratorRoadmapModules,
  })
  const viewer = buildWorkspaceViewer(user)
  const moduleGroupMetaById = buildModuleGroupMetaById(
    acceleratorProgressSummary.groups
  )
  const loadAcceleratorTimeline = () => loadAcceleratorSteps({
    supabase,
    userId: user.id,
    sortedRoadmapModules,
    groupMetaById: moduleGroupMetaById,
    onboardingDefaults,
  })
  if (acceleratorViewRequested) {
    const acceleratorTimeline = await loadAcceleratorTimeline()
    const { MyOrganizationAcceleratorView } =
      await import("../_components/workspace-board/my-organization-accelerator-view")
    if (!hasWorkspaceAcceleratorAccess) {
      redirect(getWorkspaceAcceleratorPaywallPath())
    }
    const boardResult = await supabase
      .from("organization_workspace_boards")
      .select("state")
      .eq("org_id", orgId)
      .maybeSingle<{ state: unknown }>()
    if (
      boardResult.error &&
      !isMissingWorkspaceBoardsTableError(boardResult.error)
    ) {
      throw supabaseErrorToError(
        boardResult.error,
        "Unable to load workspace board state."
      )
    }
    const acceleratorSeed = buildAcceleratorWorkspaceSeed({
      orgId,
      viewer,
      profileAudience: {
        fullName: profileAudience.fullName,
        avatarUrl: profileAudience.avatarUrl,
      },
      presentationMode,
      role,
      canEdit,
      isPlatformAdmin: isAdmin,
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
      boardState: readWorkspaceBoardStateValue(boardResult.data?.state),
    })

    return (
      <MyOrganizationAcceleratorView
        seed={acceleratorSeed}
        initialStepId={searchState.acceleratorStepParam}
        initialModuleId={searchState.acceleratorModuleParam}
        initialLessonGroupKey={searchState.acceleratorGroupParam}
        programFundingTargets={programRows}
        onWorkspaceOnboardingSubmit={completeOnboardingAction}
      />
    )
  }

  const [acceleratorTimeline, fiscalWorkflow, financeInput] = await Promise.all(
    [
      loadAcceleratorTimeline(),
      measureServerStep(
        "workspace.content.load_fiscal_workflow",
        () => loadMyOrganizationFiscalSponsorshipWorkflow({ orgId, supabase }),
        { thresholdMs: 750 }
      ),
      measureServerStep(
        "workspace.content.load_finance_input",
        () =>
          loadOrganizationWorkspaceFinanceInput({
            canManageAccess: role === "owner" && orgId === user.id,
            orgId,
            programs: programsResult ?? [],
            supabase,
          }),
        { thresholdMs: 750 }
      ),
    ]
  )
  const { fiscalSponsorshipProjectId, fiscalSponsorshipWorkflowSummary } =
    fiscalWorkflow
  const [workspaceSeed, organizationEditorData] = await Promise.all([
    measureServerStep(
      "workspace.content.build_workspace_seed",
      () =>
        buildWorkspaceViewSeed({
          workspaceCanvasId,
          supabase,
          orgId,
          role,
          canEdit,
          isPlatformAdmin: isAdmin,
          hasAcceleratorAccess: hasWorkspaceAcceleratorAccess,
          presentationMode,
          viewer,
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
          calendar: calendarView,
          initialOnboarding: {
            required: needsInitialOnboarding,
            defaults: onboardingDefaults,
          },
        }),
      { thresholdMs: 1_000 }
    ),
    measureServerStep(
      "workspace.content.build_organization_editor_data",
      () =>
        buildWorkspaceOrganizationEditorData({
          ...resolveFiscalApplicantPrefillIdentity({ profileAudience, user }),
          canAccessRoadmapDocuments: entitlements.hasAcceleratorAccess,
          canEdit,
          fiscalSponsorshipProjectId,
          fiscalSponsorshipWorkflowSummary,
          initialProfile,
          ...initialDrawerData,
          organizationLocation: {
            latitude: orgRow?.location_lat ?? null,
            longitude: orgRow?.location_lng ?? null,
          },
          peopleNormalized,
          peopleSegments,
          peopleTags,
          profile,
          programs: programsResult,
          publicSlug: orgRow?.public_slug ?? null,
          roadmapSections,
        }),
      { thresholdMs: 1_000 }
    ),
  ])

  const hydratedWorkspaceSeed = hydrateWorkspaceSeedAcceleratorState({
      ...workspaceSeed,
      calendar: buildWorkspaceCalendarView({
        monthParam: searchState.monthParam, searchParams: searchState.resolvedSearchParams,
        upcomingEvents, stored: workspaceSeed.boardState.particleGraph, orgId, now: nowIso,
      }),
    },
    acceleratorTimeline
  )
  const workspaceSeedForRender = applyWorkspaceOnboardingStageToSeed(
    hydratedWorkspaceSeed,
    searchState.onboardingStageOverride
  )
  const workspaceSeedWithTutorial = applyWorkspaceTutorialActivationToSeed(
    workspaceSeedForRender,
    {
      initialOnboardingRequired: needsInitialOnboarding,
      workspaceOnboardingActive: userMeta?.workspace_onboarding_active === true,
      workspaceTutorialRequested:
        searchState.onboardingFlowRequested ||
        searchState.onboardingStageOverride !== null,
      workspaceOnboardingCompletedAt:
        typeof userMeta?.workspace_onboarding_completed_at === "string"
          ? userMeta.workspace_onboarding_completed_at
          : null,
    }
  )

  const { MyOrganizationWorkspaceView } =
    await import("../_components/workspace-board/my-organization-workspace-view")

  return (
    <MyOrganizationWorkspaceView
      initialFocusCardId={searchState.initialWorkspaceFocusCardId}
      seed={workspaceSeedWithTutorial}
      onInitialOnboardingSubmit={completeOnboardingAction}
      organizationEditorData={organizationEditorData}
      financeInput={financeInput}
    />
  )
}
