import { organizationLearningUserId } from "@/lib/accelerator/organization-context"
import { Empty } from "@/components/ui/empty"
import { AcceleratorOrgSnapshotStrip } from "@/components/accelerator/accelerator-org-snapshot-strip"
import { AcceleratorWelcomeBanner } from "@/components/accelerator/accelerator-welcome-banner"
import { fetchAcceleratorProgressSummary } from "@/lib/accelerator/progress"
import {
  applyOrganizationSetupAcceleratorProgressOverride,
  hasSavedOrganizationSetup,
} from "@/lib/accelerator/organization-setup"
import { RoadmapOutlineCard } from "@/components/roadmap/roadmap-outline-card"
import { AcceleratorOverviewRightRail } from "@/components/accelerator/accelerator-overview-right-rail"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { resolveRoadmapHomework } from "@/lib/roadmap/homework"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { resolveAcceleratorReadiness } from "@/lib/accelerator/readiness"
import { buildReadinessChecklist } from "@/lib/accelerator/readiness-checklist"
import { ProgramBuilderSection } from "./program-builder-section"
import {
  buildVisibleAcceleratorGroups,
  CORE_ROADMAP_SECTION_IDS,
  isRecord,
} from "../_lib/overview-helpers"

export async function AcceleratorOverviewPageContent() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6 lg:p-8">
        <Empty
          title="Sign in to continue"
          description="Your accelerator workspace is ready when you are."
        />
      </div>
    )
  }

  const [profileResult, activeOrg] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>(),
    resolveActiveOrganization(supabase, user.id),
  ])
  const isAdmin = profileResult.data?.role === "admin"
  const learningUserId = organizationLearningUserId(user.id, activeOrg)

  const [
    progressSummary,
    orgResult,
    roadmapHomework,
    entitlements,
    programsResult,
  ] = await Promise.all([
    fetchAcceleratorProgressSummary({ supabase, userId: learningUserId, isAdmin }),
    supabase
      .from("organizations")
      .select("profile, public_slug, ein")
      .eq("user_id", activeOrg.orgId)
      .maybeSingle<{
        profile: Record<string, unknown> | null
        public_slug: string | null
        ein: string | null
      }>(),
    resolveRoadmapHomework(learningUserId, supabase),
    fetchLearningEntitlements({
      supabase,
      userId: user.id,
      orgUserId: activeOrg.orgId,
      isAdmin,
    }),
    supabase
      .from("programs")
      .select("id, goal_cents")
      .eq("user_id", activeOrg.orgId)
      .returns<Array<{ id: string; goal_cents: number | null }>>(),
  ])

  const orgProfile = isRecord(orgResult.data?.profile)
    ? orgResult.data.profile
    : {}
  const { groups } = applyOrganizationSetupAcceleratorProgressOverride(
    progressSummary,
    hasSavedOrganizationSetup({
      organizationName:
        typeof orgProfile["name"] === "string" ? orgProfile["name"] : null,
      publicSlug: orgResult.data?.public_slug,
    })
  )
  const roadmapSections = resolveRoadmapSections(
    orgResult.data?.profile ?? null
  ).map((section) => ({
    ...section,
    homework: roadmapHomework[section.id] ?? null,
  }))
  const ownedElectiveModuleSlugSet = new Set(
    entitlements.ownedElectiveModuleSlugs.map((slug) =>
      slug.trim().toLowerCase()
    )
  )
  const visibleGroups = buildVisibleAcceleratorGroups({
    groups,
    hasAcceleratorAccess: entitlements.hasAcceleratorAccess,
    ownedElectiveModuleSlugSet,
  })
  const timelineModules = visibleGroups.flatMap((group, groupIndex) =>
    group.modules.map((module, moduleIndex) => ({
      ...module,
      groupTitle: group.title,
      sequence: groupIndex * 1000 + moduleIndex,
    }))
  )
  const organizationTitle = String(orgProfile["name"] ?? "").trim()
  const city = String(orgProfile["address_city"] ?? "").trim()
  const state = String(orgProfile["address_state"] ?? "").trim()
  const locationSubtitle = [city, state].filter(Boolean).join(", ")
  const organizationSubtitle =
    String(orgProfile["tagline"] ?? "").trim() || locationSubtitle || null
  const organizationDescription =
    String(orgProfile["description"] ?? "").trim() || null
  const logoUrl = String(orgProfile["logoUrl"] ?? "").trim() || null
  const headerUrl = String(orgProfile["headerUrl"] ?? "").trim() || null
  const peopleCount = Math.max(
    1,
    Array.isArray(orgProfile["org_people"])
      ? orgProfile["org_people"].length
      : 0
  )
  const programs = programsResult.data ?? []
  const programsCount = programs.length
  const fundingGoalCents = programs.reduce(
    (sum, program) => sum + (program.goal_cents ?? 0),
    0
  )
  const formationStatusRaw = String(
    orgProfile["formationStatus"] ?? "in_progress"
  )
  const formationLabel =
    formationStatusRaw === "approved"
      ? "Approved"
      : formationStatusRaw === "pre_501c3"
        ? "Pre-501(c)(3)"
        : "In progress"

  const isRoadmapSectionComplete = (
    section: (typeof roadmapSections)[number]
  ) => {
    if (section.status === "complete") return true
    if (section.content.trim().length > 0) return true
    return section.homework?.status === "complete"
  }

  const roadmapCompletedCount = roadmapSections.filter(
    isRoadmapSectionComplete
  ).length
  const readiness = resolveAcceleratorReadiness({
    profile: { ...orgProfile, ein: orgResult.data?.ein ?? null },
    modules: visibleGroups.flatMap((group) =>
      group.modules.map((module) => ({
        slug: module.slug,
        status: module.status,
      }))
    ),
    roadmapSections,
    programs,
    peopleCount,
  })
  const readinessStateLabel = readiness.verified
    ? "Verified"
    : readiness.fundable
      ? "Fundable"
      : "Building"
  const readinessTargetLabel = readiness.verified
    ? null
    : readiness.fundable
      ? "Verified"
      : "Fundable"
  const formationGroup =
    visibleGroups.find((group) => {
      const slug = group.slug.trim().toLowerCase()
      const title = group.title.trim().toLowerCase()
      return (
        slug === "formation" ||
        slug.includes("formation") ||
        title.includes("formation")
      )
    }) ??
    visibleGroups[0] ??
    null
  const nextIncompleteFormationModule =
    formationGroup?.modules.find((module) => module.status !== "completed") ??
    formationGroup?.modules[0] ??
    null
  const nextCoreRoadmapSection =
    roadmapSections.find(
      (section) =>
        CORE_ROADMAP_SECTION_IDS.has(section.id) &&
        !isRoadmapSectionComplete(section)
    ) ?? null
  const nextCoreRoadmapHref = nextCoreRoadmapSection
    ? `/workspace/roadmap/${nextCoreRoadmapSection.slug ?? nextCoreRoadmapSection.id}`
    : null
  const readinessChecklist = buildReadinessChecklist({
    reasons:
      readinessTargetLabel === "Verified"
        ? readiness.verifiedMissing
        : readiness.fundableMissing,
    nextFormationModuleHref: nextIncompleteFormationModule?.href,
    nextCoreRoadmapHref,
    maxItems: 3,
  })

  const lessonGroupProgress = visibleGroups.reduce(
    (acc, group) => {
      if (group.modules.length === 0) return acc

      const moduleIds = new Set(group.modules.map((module) => module.id))
      const moduleIndexes = new Set(group.modules.map((module) => module.index))
      const modulesComplete = group.modules.every(
        (module) => module.status === "completed"
      )
      const linkedSections = roadmapSections.filter((section) => {
        const homework = section.homework
        if (!homework) return false
        if (moduleIds.has(homework.moduleId)) return true
        return moduleIndexes.has(homework.moduleIdx)
      })
      const deliverablesComplete = linkedSections.every(
        isRoadmapSectionComplete
      )

      return {
        total: acc.total + 1,
        complete:
          acc.complete + (modulesComplete && deliverablesComplete ? 1 : 0),
      }
    },
    { complete: 0, total: 0 }
  )

  const showProgramBuilder = false
  const nextGroup =
    visibleGroups.find((group) =>
      group.modules.some((module) => module.status !== "completed")
    ) ?? null
  const nextModule =
    nextGroup?.modules.find((module) => module.status !== "completed") ??
    nextGroup?.modules[0] ??
    null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6 lg:p-8">
      <AcceleratorOverviewRightRail
        sections={roadmapSections.map((section) => ({
          id: section.id,
          title: section.title,
          slug: section.slug,
          status: section.status,
        }))}
      />
      <section
        id="overview"
        className="space-y-6"
        data-tour="accelerator-get-started"
      >
        <AcceleratorWelcomeBanner userId={user.id} />

        <AcceleratorOrgSnapshotStrip
          organizationTitle={organizationTitle}
          organizationSubtitle={organizationSubtitle}
          organizationDescription={organizationDescription}
          logoUrl={logoUrl}
          headerUrl={headerUrl}
          fundingGoalCents={fundingGoalCents}
          formationLabel={formationLabel}
          programsCount={programsCount}
          peopleCount={peopleCount}
          progressPercent={readiness.progressPercent}
          lessonsComplete={progressSummary.completedModules}
          lessonsTotal={progressSummary.totalModules}
          deliverablesComplete={roadmapCompletedCount}
          deliverablesTotal={roadmapSections.length}
          moduleGroupsComplete={lessonGroupProgress.complete}
          moduleGroupsTotal={lessonGroupProgress.total}
          fundableCheckpoint={readiness.fundableCheckpoint}
          verifiedCheckpoint={readiness.verifiedCheckpoint}
          fundableMilestoneChecklist={readiness.fundableChecklist}
          verifiedMilestoneChecklist={readiness.verifiedChecklist}
          readinessStateLabel={readinessStateLabel}
          readinessTargetLabel={readinessTargetLabel}
          readinessChecklist={readinessChecklist}
        />

        <RoadmapOutlineCard
          sections={roadmapSections}
          modules={timelineModules}
        />
      </section>

      {showProgramBuilder ? <ProgramBuilderSection /> : null}
    </div>
  )
}
