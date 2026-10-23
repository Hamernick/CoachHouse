import type { ReactNode } from "react"
import { OrganizationWorkspaceSupportPanel, WorkspaceOrganizationScope } from "@/features/organization-workspace-support"

import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { readAppSidebarDefaultOpen } from "@/components/app-shell/sidebar-state-server"
import { MemberWorkspaceSidebarHeader } from "@/features/member-workspace/server"
import { resolveDashboardLayoutState } from "@/components/app-shell/dashboard-layout-state"

export default async function AdminLayout({
  children,
  breadcrumbs,
}: {
  children: ReactNode
  breadcrumbs: ReactNode
}) {
  const [state, defaultSidebarOpen] = await Promise.all([
    resolveDashboardLayoutState(),
    readAppSidebarDefaultOpen(),
  ])

  if (!state.userPresent) {
    redirect("/team/login?redirect=/admin")
  }

  return (
    <WorkspaceOrganizationScope organizationId={state.organizationScope?.orgId} supportAccess={state.organizationScope?.supportAccess}>
    <AppShell
      breadcrumbs={breadcrumbs}
      sidebarHeaderContent={
        <MemberWorkspaceSidebarHeader state={state.memberWorkspaceHeader} />
      }
      sidebarTree={state.sidebarTree}
      user={state.user}
      isAdmin={state.isAdmin}
      platformAccessLevel={state.platformAccessLevel}
      hasCoachingAccess={state.hasCoachingAccess}
      isTester={state.isTester}
      showOrgAdmin={state.showOrgAdmin}
      canAccessOrgAdmin={state.canAccessOrgAdmin}
      acceleratorProgress={state.acceleratorProgress}
      showAccelerator={state.showAccelerator}
      showLiveBadges={state.showLiveBadges}
      hasActiveSubscription={state.hasActiveSubscription}
      hasBillingCancellationRisk={state.hasBillingCancellationRisk}
      hasAcceleratorAccess={state.hasAcceleratorAccess}
      hasElectiveAccess={state.hasElectiveAccess}
      ownedElectiveModuleSlugs={state.ownedElectiveModuleSlugs}
      currentPlanTier={state.currentPlanTier}
      showMemberWorkspace={state.showMemberWorkspace}
      organizationName={state.organizationName}
      onboardingLocked={state.onboardingLocked}
      onboardingIntentFocus={state.onboardingIntentFocus}
      formationStatus={state.formationStatus}
      defaultSidebarOpen={defaultSidebarOpen}
      context="admin"
    >
      {!state.memberWorkspaceHeader && state.organizationScope?.presenceOrganizationId ? <OrganizationWorkspaceSupportPanel organizationId={state.organizationScope.presenceOrganizationId} supportAccess={state.organizationScope.supportAccess} /> : null}
        {children}
    </AppShell>
    </WorkspaceOrganizationScope>
  )
}
