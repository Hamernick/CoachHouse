import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { AppBreadcrumbs } from "@/components/app-shell/breadcrumbs"
import { FrameEscape } from "@/components/navigation/frame-escape"
import {
  MemberWorkspaceOrgSwitcher,
  setActiveOrganizationAction,
  type MemberWorkspaceHeaderState,
} from "@/features/member-workspace"
import type { SidebarClass } from "@/lib/academy"
import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import type { PlatformAccessLevel } from "@/features/platform-access"
import { FIND_PATH } from "@/lib/find/routes"

type AuthenticatedFindShellState = {
  sidebarTree: SidebarClass[]
  user: {
    name: string | null
    title: string | null
    email: string | null
    avatar: string | null
  }
  isAdmin: boolean
  platformAccessLevel: PlatformAccessLevel | null
  isTester: boolean
  showOrgAdmin: boolean
  canAccessOrgAdmin: boolean
  acceleratorProgress: number | null
  showAccelerator: boolean
  showLiveBadges: boolean
  hasActiveSubscription: boolean
  hasBillingCancellationRisk: boolean
  hasAcceleratorAccess: boolean
  hasElectiveAccess: boolean
  ownedElectiveModuleSlugs: string[]
  currentPlanTier: PricingPlanTier
  showMemberWorkspace: boolean
  memberWorkspaceHeader: MemberWorkspaceHeaderState | null
  organizationName: string | null
  tutorialWelcome: {
    platform: boolean
    accelerator: boolean
  }
  onboardingLocked: boolean
  onboardingIntentFocus: "build" | "find" | "fund" | "support" | null
  memberMapOnboarding: {
    hasOrganizationSwitcher: boolean
  }
  formationStatus: string | null
}

export function AuthenticatedFindShell({
  children,
  state,
  defaultSidebarOpen = false,
  organizationDetail = false,
}: {
  children: ReactNode
  state: AuthenticatedFindShellState
  defaultSidebarOpen?: boolean
  organizationDetail?: boolean
}) {
  const segments = organizationDetail
    ? [{ label: "Find", href: FIND_PATH }, { label: "Organization" }]
    : [{ label: "Find" }]

  return (
    <>
      <FrameEscape />
      <AppShell
        breadcrumbs={<AppBreadcrumbs segments={segments} />}
        accountMenuContent={
          state.memberWorkspaceHeader ? (
            <MemberWorkspaceOrgSwitcher
              presentation="account-menu"
              activeOrganization={
                state.memberWorkspaceHeader.activeOrganization
              }
              organizations={
                state.memberWorkspaceHeader.accessibleOrganizations
              }
              setActiveOrganizationAction={setActiveOrganizationAction}
            />
          ) : null
        }
        sidebarTree={state.sidebarTree}
        user={state.user}
        isAdmin={state.isAdmin}
        platformAccessLevel={state.platformAccessLevel}
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
        organizationName={state.organizationName}
        onboardingLocked={state.onboardingLocked}
        onboardingIntentFocus={state.onboardingIntentFocus}
        formationStatus={state.formationStatus}
        defaultSidebarOpen={defaultSidebarOpen}
        resizableRightRail
        context="public"
        contentPresentation="full-bleed"
        brandHref={FIND_PATH}
        showWorkspaceHome={state.showMemberWorkspace}
        showMemberWorkspace={state.showMemberWorkspace}
      >
        {children}
      </AppShell>
    </>
  )
}
