"use client"

import { useMemo, type ReactNode } from "react"

import { CoachSchedulingCard } from "@/components/coaching/coach-scheduling-card"
import { CoachSchedulingSidebarItem } from "@/components/coaching/coach-scheduling-sidebar-item"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import type { SidebarClass } from "@/lib/academy"
import type { PlatformAccessLevel } from "@/features/platform-access"

import { ClassesSection } from "@/components/app-sidebar/classes-section"
import { RESOURCE_NAV, buildMainNav } from "@/components/app-sidebar/nav-data"
import { SidebarContent, SidebarFooter } from "@/components/ui/sidebar"
import { resolveMemberWorkspaceNavAccess } from "@/lib/workspace/member-workspace-nav-access"

export type AppSidebarProps = {
  user?: {
    name?: string | null
    title?: string | null
    email?: string | null
    avatar?: string | null
  }
  isAdmin?: boolean
  platformAccessLevel?: PlatformAccessLevel | null
  isTester?: boolean
  showOrgAdmin?: boolean
  canAccessOrgAdmin?: boolean
  classes?: SidebarClass[]
  acceleratorProgress?: number | null
  showAccelerator?: boolean
  hasActiveSubscription?: boolean
  hasBillingCancellationRisk?: boolean
  hasAcceleratorAccess?: boolean
  hasElectiveAccess?: boolean
  ownedElectiveModuleSlugs?: string[]
  formationStatus?: string | null
  onboardingLocked?: boolean
  onboardingIntentFocus?: "build" | "find" | "fund" | "support" | null
  organizationName?: string | null
  showCoachScheduling?: boolean
  showWorkspaceHome?: boolean
  showMemberWorkspace?: boolean
}

export function AppSidebar({
  user,
  isAdmin = false,
  platformAccessLevel = null,
  isTester = false,
  showOrgAdmin = false,
  canAccessOrgAdmin = true,
  classes,
  showAccelerator,
  hasActiveSubscription = false,
  hasBillingCancellationRisk = false,
  hasAcceleratorAccess,
  hasElectiveAccess,
  ownedElectiveModuleSlugs,
  formationStatus,
  onboardingLocked = false,
  onboardingIntentFocus = null,
  organizationName = null,
  showCoachScheduling = false,
  showWorkspaceHome = true,
  showMemberWorkspace,
}: AppSidebarProps) {
  const resolvedUser = useMemo(
    () => ({
      name: user?.name ?? null,
      title: user?.title ?? null,
      email: user?.email ?? null,
      avatar: user?.avatar ?? null,
    }),
    [user?.avatar, user?.email, user?.name, user?.title]
  )

  return (
    <aside className="border-border/70 bg-sidebar hidden h-full w-72 shrink-0 border-r px-3 pt-0 pb-0 md:flex md:flex-col md:gap-6">
      <SidebarBody
        isAdmin={isAdmin}
        platformAccessLevel={platformAccessLevel}
        isTester={isTester}
        classes={classes}
        user={resolvedUser}
        showAccelerator={showAccelerator}
        hasActiveSubscription={hasActiveSubscription}
        hasBillingCancellationRisk={hasBillingCancellationRisk}
        showOrgAdmin={showOrgAdmin}
        canAccessOrgAdmin={canAccessOrgAdmin}
        hasAcceleratorAccess={hasAcceleratorAccess}
        hasElectiveAccess={hasElectiveAccess}
        ownedElectiveModuleSlugs={ownedElectiveModuleSlugs}
        formationStatus={formationStatus}
        onboardingLocked={onboardingLocked}
        onboardingIntentFocus={onboardingIntentFocus}
        organizationName={organizationName}
        showCoachScheduling={showCoachScheduling}
        showWorkspaceHome={showWorkspaceHome}
        showMemberWorkspace={showMemberWorkspace}
      />
    </aside>
  )
}

type SidebarBodyProps = {
  accountMenuContent?: ReactNode
  isAdmin: boolean
  platformAccessLevel?: PlatformAccessLevel | null
  isTester: boolean
  classes?: SidebarClass[]
  user: {
    name: string | null
    title: string | null
    email: string | null
    avatar?: string | null
  }
  showAccelerator?: boolean
  hasActiveSubscription?: boolean
  hasBillingCancellationRisk?: boolean
  showClasses?: boolean
  classesBasePath?: string
  showOrgAdmin?: boolean
  canAccessOrgAdmin?: boolean
  hasAcceleratorAccess?: boolean
  hasElectiveAccess?: boolean
  ownedElectiveModuleSlugs?: string[]
  formationStatus?: string | null
  onboardingLocked?: boolean
  onboardingIntentFocus?: "build" | "find" | "fund" | "support" | null
  organizationName?: string | null
  showCoachScheduling?: boolean
  showWorkspaceHome?: boolean
  showMemberWorkspace?: boolean
}

export function SidebarBody({
  accountMenuContent,
  isAdmin,
  platformAccessLevel = null,
  isTester,
  classes,
  user,
  showAccelerator,
  hasActiveSubscription = false,
  hasBillingCancellationRisk = false,
  showClasses = false,
  classesBasePath,
  showOrgAdmin = false,
  canAccessOrgAdmin = true,
  hasAcceleratorAccess = false,
  hasElectiveAccess = false,
  ownedElectiveModuleSlugs = [],
  formationStatus = null,
  onboardingLocked = false,
  onboardingIntentFocus = null,
  organizationName = null,
  showCoachScheduling = false,
  showWorkspaceHome = true,
  showMemberWorkspace,
}: SidebarBodyProps) {
  const isCoach = platformAccessLevel === "coach"
  const shouldShowAccelerator =
    !onboardingLocked && Boolean(isAdmin || showAccelerator)
  const hasUser = Boolean(user.email)
  const showMemberWorkspaceNav =
    !onboardingLocked &&
    onboardingIntentFocus !== "fund" &&
    resolveMemberWorkspaceNavAccess({
      isAdmin,
      showMemberWorkspace,
      hasActiveSubscription,
    })
  const hasMemberWorkspaceAccess = showMemberWorkspaceNav
  const showAccountUpgradeCta =
    !platformAccessLevel &&
    hasUser &&
    !hasActiveSubscription
  const mainNavItems = buildMainNav({
    isAdmin,
    platformAccessLevel,
    showOrgAdmin,
    canAccessOrgAdmin,
    showMemberWorkspace: showMemberWorkspaceNav,
    hasMemberWorkspaceAccess,
    showWorkspaceHome,
  })

  return (
    <>
      <SidebarContent className="gap-0">
        {onboardingLocked ? null : (
          <NavMain items={mainNavItems} className="py-0" />
        )}
        {shouldShowAccelerator && showClasses ? (
          <ClassesSection
            classes={classes}
            isAdmin={isAdmin}
            basePath={classesBasePath}
            hasAcceleratorAccess={hasAcceleratorAccess}
            hasElectiveAccess={hasElectiveAccess}
            ownedElectiveModuleSlugs={ownedElectiveModuleSlugs}
            formationStatus={formationStatus}
          />
        ) : null}
      </SidebarContent>

      <SidebarFooter className="mt-auto pb-[var(--shell-rail-padding,0.75rem)]">
        {onboardingLocked ? null : (
          <div className="flex flex-col gap-4 pt-2">
            {showCoachScheduling && !isCoach ? (
              <>
                <div className="hidden group-data-[collapsible=icon]:hidden [@media(min-height:56rem)]:block">
                  <CoachSchedulingCard />
                </div>
                <div className="[@media(min-height:56rem)]:hidden group-data-[collapsible=icon]:!block">
                  <CoachSchedulingSidebarItem />
                </div>
              </>
            ) : null}
            <NavDocuments items={RESOURCE_NAV} label="Resources" />
          </div>
        )}
        {hasUser ? (
          <NavUser
            accountMenuContent={accountMenuContent}
            user={user}
            isAdmin={isAdmin}
            isTester={isTester}
            showOrgAdmin={showOrgAdmin}
            canAccessOrgAdmin={canAccessOrgAdmin}
            showDivider={false}
            showUpgrade={showAccountUpgradeCta && !onboardingLocked}
            planLabel={hasActiveSubscription ? "Paid plan" : "Free"}
            hasActiveSubscription={hasBillingCancellationRisk}
          />
        ) : null}
      </SidebarFooter>
    </>
  )
}
