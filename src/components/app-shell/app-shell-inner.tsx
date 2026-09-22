"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { AppShellNavigation } from "@/components/app-shell/components/app-shell-navigation"
import { SidebarBody } from "@/components/app-sidebar"
import { AppShellSidebarHeader } from "@/components/app-shell/components/app-shell-sidebar-header"
import { ClassesSection } from "@/components/app-sidebar/classes-section"
import {
  PaywallOverlay,
  TutorialManager,
} from "@/components/app-shell/dynamic-components"
import { AppShellAccountMenuActionsProvider } from "@/components/app-shell/account-menu-actions-context"
import {
  AppShellHeader,
  ShellMainContent,
  ShellRightRail,
} from "@/components/app-shell/components"
import {
  RightRailSlot,
  useRightRailPresence,
} from "@/components/app-shell/right-rail"
import { AppShellRightRailControlsProvider } from "@/components/app-shell/right-rail-controls"
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useIsMobile } from "@/hooks/use-mobile"
import { FIND_PATH } from "@/lib/find/routes"
import { MobileMapNavigationProvider } from "@/features/mobile-navigation/client"
import { releaseStaleInteractionLocks } from "@/lib/ui/interaction-lock-guard"
import { cn } from "@/lib/utils"
import { resolveMemberWorkspaceNavAccess } from "@/lib/workspace/member-workspace-nav-access"
import { resolveAppShellOnboardingRedirectTarget } from "./onboarding-redirect"
import { useAppShellRouteTransition } from "./use-app-shell-route-transition"
import { useAppShellRightRailState } from "./use-app-shell-right-rail-state"

import type { AppShellProps } from "./types"

function useReleaseInteractionLocksOnRouteChange(
  pathname: string | null,
  searchParamsKey: string
) {
  useEffect(() => {
    const run = () => releaseStaleInteractionLocks()
    const timeoutId = window.setTimeout(run, 0)
    const rafId = window.requestAnimationFrame(run)

    window.addEventListener("focus", run)
    window.addEventListener("pageshow", run)
    document.addEventListener("visibilitychange", run)
    return () => {
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("focus", run)
      window.removeEventListener("pageshow", run)
      document.removeEventListener("visibilitychange", run)
    }
  }, [pathname, searchParamsKey])
}

function useOnboardingRedirectTarget(onboardingRedirectTarget: string | null) {
  useEffect(() => {
    if (!onboardingRedirectTarget) return
    const currentTarget = `${window.location.pathname}${window.location.search}`
    if (currentTarget === onboardingRedirectTarget) return
    window.location.replace(onboardingRedirectTarget)
  }, [onboardingRedirectTarget])
}

function useAppShellNavUser(user: AppShellProps["user"]) {
  return useMemo(
    () => ({
      name: user?.name ?? null,
      title: user?.title ?? null,
      email: user?.email ?? null,
      avatar: user?.avatar ?? null,
    }),
    [user?.avatar, user?.email, user?.name, user?.title]
  )
}

export function AppShellInner({
  children,
  breadcrumbs,
  sidebarHeaderContent,
  headerSearch,
  contextualNavigation,
  sidebarTree,
  user,
  isAdmin,
  platformAccessLevel = null,
  isTester = false,
  showOrgAdmin = false,
  canAccessOrgAdmin = true,
  acceleratorProgress,
  showAccelerator,
  hasActiveSubscription,
  hasBillingCancellationRisk = false,
  hasAcceleratorAccess,
  hasElectiveAccess,
  ownedElectiveModuleSlugs = [],
  currentPlanTier = "free",
  organizationName = null,
  onboardingLocked = false,
  onboardingIntentFocus = null,
  context,
  contentPresentation = "default",
  defaultSidebarOpen = false,
  resizableRightRail = false,
  formationStatus,
  brandHref: brandHrefOverride,
  showWorkspaceHome = true,
  showMemberWorkspace,
  allowOnboardingLockedContent = false,
}: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const hasUser = Boolean(user?.email)
  const derivedContext =
    context ??
    (pathname?.startsWith("/accelerator") ? "accelerator" : "platform")
  const isAdminContext = derivedContext === "admin"
  const isAcceleratorContext = derivedContext === "accelerator"
  const isAcceleratorRoadmapRoute = Boolean(
    pathname?.startsWith("/accelerator/roadmap")
  )
  const isModulePage = pathname?.includes("/module/")
  const isWorkspaceHomeRoute = pathname === "/workspace"
  const showClasses = Boolean(pathname?.includes("/class/"))
  const showLeftClasses = showClasses && !isAcceleratorContext
  const showAcceleratorTrackRail = false
  const showAcceleratorRail =
    showAcceleratorTrackRail &&
    isAcceleratorContext &&
    !isAcceleratorRoadmapRoute &&
    sidebarTree.length > 0
  const canShowMemberWorkspace = resolveMemberWorkspaceNavAccess({
    isAdmin,
    showMemberWorkspace,
    hasActiveSubscription,
  })
  const showMemberWorkspaceNav =
    !onboardingLocked &&
    !isAcceleratorContext &&
    onboardingIntentFocus !== "fund" &&
    canShowMemberWorkspace

  const hasRightRail = useRightRailPresence()
  const isMobile = useIsMobile()
  const { rightOpen, handleRightOpenChangeUser, handleRightOpenChangeAuto } =
    useAppShellRightRailState({
      hasRightRail,
      isMobile,
      autoOpenOnDesktopWhenAvailable: hasUser,
    })
  const rightRailControls = useMemo(
    () => ({
      rightOpen,
      setRightOpenUser: handleRightOpenChangeUser,
      setRightOpenAuto: handleRightOpenChangeAuto,
    }),
    [handleRightOpenChangeAuto, handleRightOpenChangeUser, rightOpen]
  )

  const navUser = useAppShellNavUser(user)

  const classesBasePath = isAcceleratorContext ? "/accelerator" : ""
  const resolvedHasAcceleratorAccess =
    hasAcceleratorAccess ??
    Boolean(hasActiveSubscription || showAccelerator || isAdmin)
  const resolvedHasElectiveAccess =
    hasElectiveAccess ?? resolvedHasAcceleratorAccess
  const isOrganizationRoute = Boolean(
    pathname?.startsWith("/organization") ||
    pathname?.startsWith("/workspace") ||
    pathname?.startsWith("/my-organization")
  )
  const hasOrganizationEditorParams = Boolean(
    searchParams.get("view") === "editor" ||
    searchParams.get("tab") ||
    searchParams.get("programId")
  )
  const isCoachingRoute =
    pathname === "/coaching" || Boolean(pathname?.startsWith("/coaching/"))
  const useMobileSingleGutterContent = isCoachingRoute
  const useFullBleedContent =
    contentPresentation === "full-bleed" ||
    (isOrganizationRoute && hasOrganizationEditorParams)
  const useDesktopResizableRightRail =
    !isMobile && hasRightRail && rightOpen && resizableRightRail
  const rightRailDefaultSize = isAcceleratorContext
    ? "28%"
    : isModulePage
      ? "30%"
      : derivedContext === "public"
        ? "24%"
        : "20%"
  const isPublicMapSurface = derivedContext === "public" && useFullBleedContent
  const showMobileNavigation = pathname !== "/admin/dashboard" && !pathname?.startsWith("/admin/dashboard/")
  const useMapMobileNavigation = isPublicMapSurface && !onboardingLocked
  const contentPadding = "pb-0 md:pb-4"
  const contentHorizontalPadding = cn(
    "px-0",
    !isPublicMapSurface && isCoachingRoute && "px-[var(--shell-content-pad)]",
    "md:pl-[var(--shell-outer-gutter)] md:pr-0"
  )
  const onboardingRedirectTarget = resolveAppShellOnboardingRedirectTarget({
    onboardingLocked,
    onboardingIntentFocus,
    isAdminContext,
    pathname,
    allowOnboardingLockedContent,
  })
  const routeTransitionRef = useAppShellRouteTransition({
    enabled: !onboardingRedirectTarget,
    pathname,
  })

  const brandHref =
    brandHrefOverride ??
    (hasUser
      ? isAcceleratorContext
        ? "/accelerator"
        : derivedContext === "public"
          ? FIND_PATH
          : canShowMemberWorkspace
            ? "/workspace"
            : FIND_PATH
      : "/")
  useReleaseInteractionLocksOnRouteChange(pathname, searchParamsKey)
  useOnboardingRedirectTarget(onboardingRedirectTarget)

  const mainShellContent = (
    <ShellMainContent
      showMobileNavigation={showMobileNavigation}
      isAcceleratorContext={isAcceleratorContext}
      isMobile={isMobile}
      hasNestedScrollContent={
        pathname === "/workspace" ||
        Boolean(pathname?.startsWith("/workspace/"))
      }
      onboardingRedirectTarget={onboardingRedirectTarget}
      routeTransitionRef={routeTransitionRef}
      useFlushContentBody={useFullBleedContent}
      useFullBleedContent={useFullBleedContent}
      useMobileSingleGutterContent={useMobileSingleGutterContent}
    >
      {children}
    </ShellMainContent>
  )

  return (
    <AppShellAccountMenuActionsProvider>
      <MobileMapNavigationProvider enabled={useMapMobileNavigation && isMobile}>
      <AppShellRightRailControlsProvider value={rightRailControls}>
        <SidebarProvider
          defaultOpen={defaultSidebarOpen}
          data-shell-root
          className={cn(
            "text-foreground h-svh min-h-0 overflow-hidden bg-[var(--shell-bg)]",
            "[--shell-bg:var(--background)] [--shell-panel:var(--background)] [--shell-rail:var(--background)]",
            "[--shell-border:var(--border)] [--shell-card:var(--background)]",
            "[--shell-content-pad:1rem] [--shell-gutter:1.25rem] [--shell-rail-gap:1rem] [--shell-rail-item-padding:0.5rem] [--shell-rail-padding:0.75rem] [--shell-right-rail-pad:0.75rem] sm:[--shell-content-pad:1.25rem] lg:[--shell-content-pad:1.5rem]",
            "[--shell-right-rail-width:var(--sidebar-width)]",
            "[--sidebar-border:var(--border)] [--sidebar-foreground:var(--foreground)] [--sidebar:var(--background)]",
            isWorkspaceHomeRoute && "[--shell-right-rail-width:17rem]",
            isAcceleratorContext &&
              "[--shell-right-rail-pad:0rem] [--shell-right-rail-width:26rem]",
            isModulePage &&
              "[--shell-right-rail-pad:0rem] [--shell-right-rail-width:27rem]",
            derivedContext === "public" &&
              "[--shell-right-rail-width:min(22rem,calc(100vw-1rem))] md:[--shell-right-rail-width:min(22rem,36vw)]"
          )}
        >
          {showAcceleratorRail ? (
            <RightRailSlot priority={1}>
              <ClassesSection
                classes={sidebarTree}
                isAdmin={isAdmin}
                basePath={classesBasePath}
                hasAcceleratorAccess={resolvedHasAcceleratorAccess}
                hasElectiveAccess={resolvedHasElectiveAccess}
                ownedElectiveModuleSlugs={ownedElectiveModuleSlugs}
                formationStatus={formationStatus}
              />
            </RightRailSlot>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1">
            <Sidebar
              collapsible="icon"
              variant="sidebar"
              className="border-0 bg-[var(--shell-rail)]"
            >
              <AppShellSidebarHeader
                brandHref={brandHref}
                showCalendar={isMobile && hasUser && !onboardingLocked}
              >
                {sidebarHeaderContent}
              </AppShellSidebarHeader>
              <SidebarBody
                isAdmin={isAdmin}
                platformAccessLevel={platformAccessLevel}
                isTester={isTester}
                showOrgAdmin={showOrgAdmin}
                canAccessOrgAdmin={canAccessOrgAdmin}
                classes={sidebarTree}
                user={navUser}
                showAccelerator={showAccelerator}
                hasActiveSubscription={Boolean(hasActiveSubscription)}
                hasBillingCancellationRisk={hasBillingCancellationRisk}
                showClasses={showLeftClasses}
                classesBasePath={classesBasePath}
                hasAcceleratorAccess={resolvedHasAcceleratorAccess}
                hasElectiveAccess={resolvedHasElectiveAccess}
                ownedElectiveModuleSlugs={ownedElectiveModuleSlugs}
                formationStatus={formationStatus}
                onboardingLocked={onboardingLocked}
                onboardingIntentFocus={onboardingIntentFocus}
                organizationName={organizationName}
                showCoachScheduling={!isAcceleratorContext}
                showWorkspaceHome={showWorkspaceHome}
                showMemberWorkspace={showMemberWorkspaceNav}
                contextualNavigation={contextualNavigation}
              />
            </Sidebar>

            <SidebarInset
              className={cn(
                "text-foreground h-full min-h-0 min-w-0 overflow-hidden bg-[var(--shell-bg)]",
                "[--shell-max-w:min(1400px,100%)] md:peer-data-[state=collapsed]:[--shell-max-w:min(1600px,100%)]",
                "[--shell-outer-gutter:0px] md:peer-data-[state=collapsed]:[--shell-outer-gutter:0px]"
              )}
            >
              <AppShellHeader
                breadcrumbs={breadcrumbs}
                headerSearch={headerSearch}
                compactMobileSpacing={isPublicMapSurface}
                hideOnMobile={useMapMobileNavigation}
                hasUser={hasUser}
                isAdmin={isAdmin}
                onboardingLocked={onboardingLocked}
                rightOpen={rightOpen}
                onRightOpenChange={handleRightOpenChangeUser}
              />
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                <div
                  className={cn(
                    "flex min-h-0 min-w-0 flex-1 gap-0",
                    contentPadding,
                    contentHorizontalPadding,
                    (!hasRightRail || !rightOpen) &&
                      "md:pr-[var(--shell-gutter)]"
                  )}
                >
                  {useDesktopResizableRightRail ? (
                    <ResizablePanelGroup
                      id="app-shell-right-rail-layout"
                      direction="horizontal"
                      className="min-h-0 min-w-0 flex-1"
                    >
                      <ResizablePanel
                        id="app-shell-main-content-panel"
                        minSize="45%"
                        className="flex min-h-0 min-w-0 flex-col"
                      >
                        {mainShellContent}
                      </ResizablePanel>
                      <ResizableHandle
                        aria-label="Resize right rail"
                        withHandle
                        className="before:bg-border z-40 -ml-px shrink-0 bg-transparent before:absolute before:inset-y-16 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:content-['']"
                      />
                      <ResizablePanel
                        id="app-shell-right-rail-panel"
                        defaultSize={rightRailDefaultSize}
                        minSize="18%"
                        maxSize="42%"
                        className="flex min-h-0 min-w-0 flex-col"
                      >
                        <ShellRightRail
                          open={rightOpen}
                          onOpenChange={handleRightOpenChangeUser}
                          onAutoClose={handleRightOpenChangeAuto}
                          resizablePanel
                        />
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  ) : (
                    <>
                      {mainShellContent}

                      <ShellRightRail
                        open={rightOpen}
                        onOpenChange={handleRightOpenChangeUser}
                        onAutoClose={handleRightOpenChangeAuto}
                      />
                    </>
                  )}
                </div>
              </div>
            </SidebarInset>
          </div>

          <AppShellNavigation
            showMobileNavigation={showMobileNavigation}
            isMobile={isMobile}
            mapNavigation={useMapMobileNavigation}
            account={{
              user: navUser,
              isAdmin,
              showOrgAdmin,
              canAccessOrgAdmin,
              hasActiveSubscription: hasBillingCancellationRisk,
            }}
            search={{
              isAdmin,
              showOrgAdmin,
              context: isAcceleratorContext ? "accelerator" : "platform",
              classes: sidebarTree,
              showAccelerator,
              showMemberWorkspace: showMemberWorkspaceNav,
            }}
            showGlobalSearch={hasUser && !headerSearch && !onboardingLocked && !isAdminContext && platformAccessLevel !== "coach"}
            showWorkspace={hasUser && showWorkspaceHome && !isAdminContext}
            onboardingLocked={onboardingLocked}
            rightOpen={rightOpen}
            onRightOpenChange={handleRightOpenChangeUser}
          />
          {!isAdminContext ? (
            <PaywallOverlay currentPlanTier={currentPlanTier} />
          ) : null}
          {!isAdminContext ? <TutorialManager /> : null}
        </SidebarProvider>
      </AppShellRightRailControlsProvider>
      </MobileMapNavigationProvider>
    </AppShellAccountMenuActionsProvider>
  )
}
