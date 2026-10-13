"use client"

import { FIND_PATH } from "@/lib/find/routes"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type CSSProperties, type ReactNode } from "react"

import { ShellRightRail } from "@/components/app-shell/components/shell-right-rail"
import {
  RightRailProvider,
  useRightRailPresence,
} from "@/components/app-shell/right-rail"
import { useAppShellRightRailState } from "@/components/app-shell/use-app-shell-right-rail-state"
import {
  HomeCanvasFindRoutePendingToast,
  HomeCanvasPreviewHeader,
} from "@/components/public/home-canvas-preview-shell"
import { HomeCanvasPreviewSidebar } from "@/components/public/home-canvas-preview-sidebar"
import { HomeCanvasProductNavigator } from "@/components/public/home-canvas-product-navigator"
import { useHomeCanvasSectionLinkController } from "@/components/public/home-canvas-section-link-controller"
import {
  HomeCanvasSidebarSlotProvider,
  useHomeCanvasSidebarContent,
  useHomeCanvasSidebarPresence,
} from "@/components/public/home-canvas-sidebar-slot"
import { isHomeSectionId } from "@/components/public/home-canvas-preview-config"
import { isPrimaryPlainNavigationIntent } from "@/components/public/home-canvas-route-link-helpers"
import { useHomeCanvasNavigation } from "@/components/public/home-canvas-preview-navigation"
import {
  CanvasAuthPanel,
  HomeSectionPanel,
} from "@/components/public/home-canvas-preview-panels"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import type {
  SignupBuilderPlanTier,
  SignupIntentFocus,
} from "@/lib/onboarding/signup-plan"
import { cn } from "@/lib/utils"

type HomeCanvasPreviewProps = {
  initialSection?: string
  loginRedirectTo?: string
  mapboxToken?: string
  pricingPanel?: ReactNode
  findPanel?: ReactNode
  signupIntentFocus?: SignupIntentFocus | null
  signupPlanTier?: SignupBuilderPlanTier | null
}

export function HomeCanvasPreview({
  initialSection,
  loginRedirectTo,
  mapboxToken,
  pricingPanel,
  findPanel,
  signupIntentFocus,
  signupPlanTier,
}: HomeCanvasPreviewProps) {
  return (
    <RightRailProvider>
      <HomeCanvasSidebarSlotProvider>
        <HomeCanvasPreviewContent
          initialSection={initialSection}
          loginRedirectTo={loginRedirectTo}
          mapboxToken={mapboxToken}
          pricingPanel={pricingPanel}
          findPanel={findPanel}
          signupIntentFocus={signupIntentFocus}
          signupPlanTier={signupPlanTier}
        />
      </HomeCanvasSidebarSlotProvider>
    </RightRailProvider>
  )
}

function HomeCanvasPreviewContent(props: HomeCanvasPreviewProps) {
  const {
    initialSection,
    loginRedirectTo,
    mapboxToken,
    pricingPanel,
    findPanel,
    signupIntentFocus,
    signupPlanTier,
  } = props
  const router = useRouter()
  const { activeSection, direction, activeSectionBehavior, changeSection } =
    useHomeCanvasNavigation({ initialSection })
  const hasRightRail = useRightRailPresence()
  const hasSidebarSlot = useHomeCanvasSidebarPresence()
  const sidebarSlotContent = useHomeCanvasSidebarContent()
  const isMobile = useIsMobile()
  const [isFindRoutePending, setIsFindRoutePending] = useState(false)
  const { rightOpen, handleRightOpenChangeUser, handleRightOpenChangeAuto } =
    useAppShellRightRailState({ hasRightRail, isMobile })
  const showFindSidebarShell = activeSection === "find" && hasSidebarSlot
  const showRightRailToggle = hasRightRail
  const { authPanelProps, handleCanvasPanelClick } =
    useHomeCanvasSectionLinkController({
      changeSection,
      loginRedirectTo,
      signupIntentFocus,
      signupPlanTier,
    })
  const railToggleClassName =
    "size-10 rounded-md border border-[color:var(--shell-border)] text-muted-foreground hover:bg-foreground/5 hover:text-foreground md:size-8"
  useEffect(() => {
    if (activeSection === "find") {
      setIsFindRoutePending(false)
      return
    }
    router.prefetch(FIND_PATH)
  }, [activeSection, router])

  function primeFindRoute() {
    if (activeSection === "find") return
    router.prefetch(FIND_PATH)
  }

  function handleFindRouteClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      !isPrimaryPlainNavigationIntent({
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        metaKey: event.metaKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        target: event.currentTarget.target,
      })
    ) {
      return
    }

    setIsFindRoutePending(true)
  }

  return (
    <SidebarProvider
      defaultOpen
      data-shell-root
      style={
        showFindSidebarShell
          ? ({
              "--sidebar-width": "23rem",
            } as CSSProperties)
          : undefined
      }
      className={cn(
        "text-foreground h-svh min-h-0 overflow-hidden bg-[var(--shell-bg)]",
        "[--shell-bg:var(--background)] [--shell-border:var(--border)] [--shell-rail:var(--background)]",
        "[--sidebar-border:var(--border)] [--sidebar-foreground:var(--foreground)] [--sidebar:var(--background)]",
        "[--shell-content-pad:1rem] [--shell-rail-gap:1rem] [--shell-rail-item-gap:0.5rem] [--shell-rail-item-padding:0.5rem] [--shell-rail-padding:0.75rem] [--shell-right-rail-width:20rem] sm:[--shell-content-pad:1.25rem]"
      )}
    >
      <div className="flex min-h-0 flex-1">
        {showFindSidebarShell ? (
          <HomeCanvasPreviewSidebar
            showFindSidebarShell={showFindSidebarShell}
            sidebarSlotContent={sidebarSlotContent}
          />
        ) : null}

        <div className="flex min-h-0 flex-1">
          <SidebarInset className="h-full min-h-0 overflow-hidden bg-[var(--shell-bg)]">
            <HomeCanvasPreviewHeader
              activeSection={activeSection}
              changeSection={changeSection}
              onRightOpenChange={handleRightOpenChangeUser}
              railToggleClassName={railToggleClassName}
              rightOpen={rightOpen}
              showShellSidebar={showFindSidebarShell}
              showRightRailToggle={showRightRailToggle}
            />

            <div
              className={cn(
                "flex min-h-0 flex-1 p-[var(--shell-content-pad)] md:pt-0 md:pr-[var(--shell-content-pad)] md:pb-[var(--shell-content-pad)]",
                showFindSidebarShell
                  ? "md:pl-0"
                  : "md:pl-[var(--shell-content-pad)]"
              )}
            >
              <div className="relative flex min-h-0 w-full flex-1 overflow-hidden rounded-[28px] border border-[color:var(--shell-border)] bg-[var(--shell-bg)]">
                <HomeCanvasProductNavigator
                  activeSection={activeSection}
                  changeSection={changeSection}
                  handleFindRouteClick={handleFindRouteClick}
                  isFindRoutePending={isFindRoutePending}
                  primeFindRoute={primeFindRoute}
                />
                {isFindRoutePending ? (
                  <HomeCanvasFindRoutePendingToast />
                ) : null}
                <div
                  key={activeSection}
                  data-home-canvas-panel={activeSection}
                  className={cn(
                    "absolute inset-0 overscroll-contain motion-safe:animate-[home-canvas-panel-in_220ms_cubic-bezier(0.22,1,0.36,1)_both]",
                    activeSectionBehavior.scrollable
                      ? "overflow-x-hidden overflow-y-auto"
                      : "overflow-hidden"
                  )}
                  onClickCapture={handleCanvasPanelClick}
                  style={
                    {
                      "--home-canvas-panel-y": direction > 0 ? "44px" : "-44px",
                    } as CSSProperties
                  }
                >
                  {activeSection === "login" ? (
                    <CanvasAuthPanel {...authPanelProps} mode="login" />
                  ) : activeSection === "signup" ? (
                    <CanvasAuthPanel {...authPanelProps} mode="signup" />
                  ) : activeSection === "pricing" ? (
                    (pricingPanel ?? (
                      <div className="mx-auto flex min-h-full w-full max-w-[960px] items-center justify-center px-4 py-6 md:px-6 lg:px-8">
                        <div className="border-border/60 bg-card/60 w-full max-w-xl rounded-2xl border p-6 text-center">
                          <p className="text-muted-foreground text-sm">
                            Pricing is currently unavailable in this preview.
                          </p>
                          <Button asChild className="mt-4 rounded-xl">
                            <Link href="/pricing">
                              Open pricing
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : activeSection === "find" ? (
                    (findPanel ?? (
                      <div className="mx-auto flex min-h-full w-full max-w-[960px] items-center justify-center px-4 py-6 md:px-6 lg:px-8">
                        <div className="border-border/60 bg-card/60 w-full max-w-xl rounded-2xl border p-6 text-center">
                          <p className="text-muted-foreground text-sm">
                            Find organizations is currently unavailable.
                          </p>
                          <Button asChild className="mt-4 rounded-xl">
                            <Link
                              href={FIND_PATH}
                              prefetch
                              aria-busy={isFindRoutePending || undefined}
                              onClick={handleFindRouteClick}
                              onFocus={primeFindRoute}
                              onMouseEnter={primeFindRoute}
                              onTouchStart={primeFindRoute}
                            >
                              {isFindRoutePending ? "Opening…" : "Open map"}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : isHomeSectionId(activeSection) ? (
                    <HomeSectionPanel
                      sectionId={activeSection}
                      mapboxToken={mapboxToken}
                      pricingPanel={pricingPanel}
                    />
                  ) : (
                    <HomeSectionPanel
                      sectionId="hero"
                      mapboxToken={mapboxToken}
                      pricingPanel={pricingPanel}
                    />
                  )}
                </div>
              </div>
            </div>
          </SidebarInset>
          <ShellRightRail
            open={rightOpen}
            onOpenChange={handleRightOpenChangeUser}
            onAutoClose={handleRightOpenChangeAuto}
          />
        </div>
      </div>
    </SidebarProvider>
  )
}
