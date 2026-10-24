import type { Metadata } from "next"
import type { ReactNode } from "react"
import { OrganizationWorkspaceSupportPanel, WorkspaceOrganizationScope } from "@/features/organization-workspace-support"

import { AppShell } from "@/components/app-shell"
import { readAppSidebarDefaultOpen } from "@/components/app-shell/sidebar-state-server"
import { FrameEscape } from "@/components/navigation/frame-escape"
import { AppPricingFeedbackPrompt } from "@/features/app-pricing-feedback"
import { MemberWorkspaceSidebarHeader } from "@/features/member-workspace"
import { measureServerStep } from "@/lib/performance/server-timing"

import { resolveDashboardLayoutState } from "@/components/app-shell/dashboard-layout-state"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
  breadcrumbs: ReactNode
}) {
  const [state, defaultSidebarOpen] = await Promise.all([
    measureServerStep(
      "dashboard.layout.resolve_state",
      () => resolveDashboardLayoutState(),
      { thresholdMs: 750 }
    ),
    readAppSidebarDefaultOpen(),
  ])

  return (
    <WorkspaceOrganizationScope organizationId={state.organizationScope?.orgId} supportAccess={state.organizationScope?.supportAccess}>
      <FrameEscape />
      <AppShell
        sidebarHeaderContent={
          <MemberWorkspaceSidebarHeader state={state.memberWorkspaceHeader} />
        }
        sidebarTree={state.sidebarTree}
        user={state.user}
        isAdmin={state.isAdmin}
        platformAccessLevel={state.platformAccessLevel}
        hasCoachingAccess={state.hasCoachingAccess}
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
        isTester={state.isTester}
        onboardingLocked={state.onboardingLocked}
        onboardingIntentFocus={state.onboardingIntentFocus}
        formationStatus={state.formationStatus}
        defaultSidebarOpen={defaultSidebarOpen}
        context="platform"
      >
        {!state.memberWorkspaceHeader && state.organizationScope?.presenceOrganizationId ? <OrganizationWorkspaceSupportPanel organizationId={state.organizationScope.presenceOrganizationId} supportAccess={state.organizationScope.supportAccess} /> : null}
        {children}
      </AppShell>
      {state.user?.email && !state.onboardingLocked ? (
        <AppPricingFeedbackPrompt
          prompt={state.appPricingFeedbackPrompt}
          tutorial="platform"
          tutorialPending={state.tutorialWelcome.platform}
        />
      ) : null}
    </WorkspaceOrganizationScope>
  )
}
