import type { ProfileTab } from "@/components/organization/org-profile-card/types"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { normalizeWorkspaceDrawerTab } from "@/lib/workspace/routes"
import { resolveOnboardingRequirements } from "@/lib/onboarding/requirements"

type MyOrganizationRequestContext = NonNullable<
  Awaited<ReturnType<typeof resolveOptionalAuthenticatedAppContext>>
>

export function resolveInitialWorkspaceDrawerData({
  acceleratorGroupParam,
  acceleratorModuleParam,
  acceleratorStepParam,
  drawerParam,
  focusParam,
  needsInitialOnboarding,
  programIdParam,
  roadmapSectionParam,
  tabParam,
  viewParam,
}: {
  acceleratorGroupParam: string | null
  acceleratorModuleParam: string | null
  acceleratorStepParam: string | null
  drawerParam: string
  focusParam: string
  needsInitialOnboarding: boolean
  programIdParam: string
  roadmapSectionParam: string | null
  tabParam: string
  viewParam: string
}) {
  const requestedDrawerTab = normalizeWorkspaceDrawerTab(drawerParam)
  const organizationEditorRequested =
    !needsInitialOnboarding &&
    (viewParam === "editor" ||
      requestedDrawerTab === "organization" ||
      Boolean(tabParam) ||
      Boolean(programIdParam))
  const allowedTabs: ProfileTab[] = [
    "company",
    "programs",
    "people",
    "supporters",
  ]
  const initialTab = allowedTabs.includes(tabParam as ProfileTab)
    ? (tabParam as ProfileTab)
    : undefined

  return {
    organizationEditorRequested,
    initialDrawerData: {
      initialAcceleratorGroup:
        requestedDrawerTab === "accelerator" ? acceleratorGroupParam : null,
      initialAcceleratorModuleId:
        requestedDrawerTab === "accelerator" ? acceleratorModuleParam : null,
      initialAcceleratorStepId:
        requestedDrawerTab === "accelerator" ? acceleratorStepParam : null,
      initialDrawerTab:
        requestedDrawerTab ??
        (organizationEditorRequested ? ("organization" as const) : null),
      initialRoadmapSectionSlug:
        requestedDrawerTab === "roadmap" ? roadmapSectionParam : null,
      initialFocus:
        organizationEditorRequested || requestedDrawerTab === "documents" || requestedDrawerTab === "accelerator"
          ? focusParam || null
          : null,
      initialEditMode: viewParam === "editor",
      initialProfileTab: organizationEditorRequested
        ? (initialTab ?? (programIdParam ? "programs" : "company"))
        : null,
      initialProgramId: organizationEditorRequested
        ? programIdParam || null
        : null,
    },
  }
}

export function getOnboarding({
  activeOrg,
  profileAudience,
  user,
}: MyOrganizationRequestContext, organization: { profile: Record<string, unknown>; publicSlug: string | null }) {
  const userMeta =
    (user.user_metadata as Record<string, unknown> | null) ?? null
  return {
    userMeta,
    needsInitialOnboarding: resolveOnboardingRequirements({
      userId: user.id,
      organizationId: activeOrg.orgId,
      isPlatformStaff: profileAudience.isAdmin || profileAudience.isPlatformStaff,
      userMetadata: userMeta,
      organizationProfile: organization.profile,
      publicSlug: organization.publicSlug,
    }).required,
  }
}
