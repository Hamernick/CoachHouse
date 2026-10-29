import { organizationLearningUserId } from "@/lib/accelerator/organization-context"
import { notFound, redirect } from "next/navigation"

import { ModuleDetail as TrainingModuleDetail } from "@/components/training/module-detail"
import { fetchLearningEntitlements } from "@/lib/accelerator/entitlements"
import { isElectiveAddOnModule } from "@/lib/accelerator/elective-modules"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { buildModuleStates } from "@/lib/module-progress"
import { getClassModulePageForUser } from "@/lib/modules/module-page-service"
import { resolveRoadmapSections, type RoadmapSectionStatus } from "@/lib/roadmap"

type ModuleParams = {
  slug: string
  index: string
}

type ModuleSearchParams = {
  from?: string | string[]
}

export async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<ModuleParams>
  searchParams?: Promise<ModuleSearchParams>
}) {
  const { slug, index } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const moduleIndex = Number.parseInt(index, 10)
  if (!Number.isFinite(moduleIndex) || moduleIndex <= 0) {
    notFound()
  }

  const requestContext = await resolveOptionalAuthenticatedAppContext()
  if (!requestContext) {
    redirect(`/login?redirect=/class/${slug}/module/${index}`)
  }

  const { supabase, user, profileAudience, activeOrg } = requestContext
  const isAdmin = profileAudience.isAdmin
  const learningUserId = organizationLearningUserId(user.id, activeOrg)

  const [orgRowResult, entitlements, classContext] = await Promise.all([
    supabase
      .from("organizations")
      .select("profile")
      .eq("user_id", activeOrg.orgId)
      .maybeSingle<{ profile: Record<string, unknown> | null }>(),
    fetchLearningEntitlements({
      supabase,
      userId: user.id,
      orgUserId: activeOrg.orgId,
      isAdmin,
    }),
    getClassModulePageForUser({
      classSlug: slug,
      moduleIndex,
      userId: learningUserId,
      forceAdmin: isAdmin,
      supabase,
    }),
  ])

  const roadmapStatusBySectionId = resolveRoadmapSections(
    orgRowResult.data?.profile ?? {},
  ).reduce(
    (acc, section) => {
      acc[section.id] = (section.status ?? "not_started") as RoadmapSectionStatus
      return acc
    },
    {} as Record<string, RoadmapSectionStatus>,
  )

  if (classContext.modules.length === 0) {
    notFound()
  }

  const moduleStates = buildModuleStates(classContext.modules, classContext.progressMap)
  const currentState = moduleStates.find((state) => state.module.idx === moduleIndex)
  if (!currentState) {
    notFound()
  }
  const currentStateIndex = moduleStates.findIndex((state) => state.module.id === currentState.module.id)
  const nextState = currentStateIndex >= 0 ? moduleStates[currentStateIndex + 1] ?? null : null
  const nextLocked = !isAdmin && nextState ? !nextState.module.published : false

  const isFormationClass = slug === "electives"
  if (!entitlements.hasAcceleratorAccess && !isAdmin && !isFormationClass) {
    redirect("/organization?paywall=organization&plan=organization&source=module")
  }

  if (!isAdmin && isFormationClass) {
    const moduleSlug = currentState.module.slug.trim().toLowerCase()
    const requiresElectivePurchase = isElectiveAddOnModule({
      slug: moduleSlug,
      title: currentState.module.title,
    })
    const hasElectiveAccess =
      entitlements.hasAcceleratorAccess ||
      entitlements.ownedElectiveModuleSlugs.includes(moduleSlug)
    if (requiresElectivePurchase && !hasElectiveAccess) {
      redirect(
        `/organization?paywall=organization&plan=organization&module=${encodeURIComponent(moduleSlug)}&source=module`,
      )
    }
  }

  const classDef = {
    id: classContext.classId,
    title: classContext.classTitle,
    blurb: classContext.classDescription ?? "",
      description: classContext.classDescription ?? "",
      slug,
      modules: classContext.modules.map((module) => ({
        id: module.id,
        idx: module.idx,
        title: module.title,
        subtitle: module.description ?? undefined,
      })),
    }

  const contentMd = (currentState.module as { contentMd?: string | null }).contentMd ?? null
  const moduleTitle = currentState.module.title
  const moduleSubtitle = currentState.module.description ?? undefined

  const moduleDef = {
    id: currentState.module.id,
    title: moduleTitle,
    subtitle: moduleSubtitle,
    videoUrl: currentState.module.videoUrl ?? null,
    contentMd,
    resources: currentState.module.resources,
    assignment: currentState.module.assignment,
    assignmentSubmission: currentState.module.assignmentSubmission,
    locked: currentState.locked,
    hasDeck: currentState.module.hasDeck,
  }
  const completedModuleIds = moduleStates.filter((state) => state.completed).map((state) => state.module.id)
  const fromParam = Array.isArray(resolvedSearchParams.from)
    ? resolvedSearchParams.from[0]
    : resolvedSearchParams.from
  const returnHref = fromParam === "documents" ? "/organization/documents" : null

  return (
    <div className="flex min-h-full w-full flex-col">
      <TrainingModuleDetail
        c={classDef}
        m={moduleDef}
        isAdmin={isAdmin}
        nextLocked={nextLocked}
        roadmapStatusBySectionId={roadmapStatusBySectionId}
        completedModuleIds={completedModuleIds}
        returnHref={returnHref}
      />
    </div>
  )
}
