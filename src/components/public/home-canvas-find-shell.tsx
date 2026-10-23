"use client"

import { useRouter } from "next/navigation"
import { useState, type CSSProperties, type ReactNode } from "react"

import { ShellRightRail } from "@/components/app-shell/components/shell-right-rail"
import {
  RightRailProvider,
  useRightRailPresence,
} from "@/components/app-shell/right-rail"
import { useAppShellRightRailState } from "@/components/app-shell/use-app-shell-right-rail-state"
import { HomeCanvasPreviewHeader } from "@/components/public/home-canvas-preview-shell"
import { HomeCanvasDockHostContext, HomeCanvasSearchDockSkeleton } from "./home-canvas-dock-slot"
import { HomeCanvasPreviewSidebar } from "@/components/public/home-canvas-preview-sidebar"
import {
  HomeCanvasSidebarSlotProvider,
  useHomeCanvasSidebarContent,
  useHomeCanvasSidebarPresence,
} from "@/components/public/home-canvas-sidebar-slot"
import type { CanvasSectionId } from "@/components/public/home-canvas-preview-config"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export function HomeCanvasFindShell({
  children,
  inset = true,
  glassHeader = false,
  headerInFlow = false,
  showAuthActions = true,
  showPublicSearch = true,
  showPublicNavigation = true,
  frameCanvas = true,
  sidebarFallback = null,
  canvasClassName,
  className,
  searchDockBelowCanvas = false,
}: {
  children: ReactNode
  inset?: boolean
  glassHeader?: boolean
  headerInFlow?: boolean
  showAuthActions?: boolean
  showPublicSearch?: boolean
  showPublicNavigation?: boolean
  frameCanvas?: boolean
  sidebarFallback?: ReactNode
  canvasClassName?: string
  className?: string
  searchDockBelowCanvas?: boolean
}) {
  return (
    <RightRailProvider>
      <HomeCanvasSidebarSlotProvider>
        <HomeCanvasFindShellContent
          inset={inset}
          glassHeader={glassHeader}
          headerInFlow={headerInFlow}
          showAuthActions={showAuthActions}
          showPublicSearch={showPublicSearch}
          showPublicNavigation={showPublicNavigation}
          frameCanvas={frameCanvas}
          sidebarFallback={sidebarFallback}
          canvasClassName={canvasClassName}
          className={className}
          searchDockBelowCanvas={searchDockBelowCanvas}
        >
          {children}
        </HomeCanvasFindShellContent>
      </HomeCanvasSidebarSlotProvider>
    </RightRailProvider>
  )
}

function HomeCanvasFindShellContent({
  children,
  inset,
  glassHeader,
  headerInFlow,
  showAuthActions,
  showPublicSearch,
  showPublicNavigation,
  frameCanvas,
  sidebarFallback,
  canvasClassName,
  className,
  searchDockBelowCanvas,
}: {
  children: ReactNode
  inset: boolean
  glassHeader: boolean
  headerInFlow: boolean
  showAuthActions: boolean
  showPublicSearch: boolean
  showPublicNavigation: boolean
  frameCanvas: boolean
  sidebarFallback: ReactNode
  canvasClassName?: string
  className?: string
  searchDockBelowCanvas: boolean
}) {
  const [dockHost, setDockHost] = useState<HTMLDivElement | null>(null)
  const ContentContainer = inset ? SidebarInset : "div"
  const router = useRouter()
  const hasRightRail = useRightRailPresence()
  const hasSidebarSlot = useHomeCanvasSidebarPresence()
  const sidebarSlotContent = useHomeCanvasSidebarContent()
  const showSidebarShell = hasSidebarSlot || sidebarFallback !== null
  const isMobile = useIsMobile()
  const { rightOpen, handleRightOpenChangeUser, handleRightOpenChangeAuto } =
    useAppShellRightRailState({ hasRightRail, isMobile })

  function navigateToSection(section: CanvasSectionId) {
    const target = section === "login" ? "/login"
      : section === "signup" ? "/sign-up"
      : section === "pricing" ? "/pricing"
      : section === "platform" ? "/build"
      : section === "find" ? "/resources"
      : "/"
    router.push(target)
  }

  return (
    <HomeCanvasDockHostContext.Provider value={searchDockBelowCanvas ? dockHost : undefined}>
    <SidebarProvider
      defaultOpen
      data-shell-root
      style={
        {
          "--sidebar-width": sidebarFallback === null ? "23rem" : "15rem",
        } as CSSProperties
      }
      className={cn("text-foreground h-svh min-h-0 overflow-hidden bg-[var(--shell-bg)] [--shell-bg:var(--background)] [--shell-border:var(--border)] [--shell-content-pad:1rem] [--shell-rail-gap:1rem] [--shell-rail-item-gap:0.5rem] [--shell-rail-item-padding:0.5rem] [--shell-rail-padding:0.75rem] [--shell-rail:var(--background)] [--shell-right-rail-width:20rem] [--sidebar-border:var(--border)] [--sidebar-foreground:var(--foreground)] [--sidebar:var(--background)] sm:[--shell-content-pad:1.25rem]", className)}
    >
      <div className="flex min-h-0 min-w-0 flex-1">
        {showSidebarShell ? (
          <HomeCanvasPreviewSidebar
            showFindSidebarShell
            sidebarSlotContent={sidebarSlotContent ?? sidebarFallback}
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1">
          <ContentContainer className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--shell-bg)]">
            <div
              data-public-header-glass={glassHeader ? "" : undefined}
              className={cn(
                "shrink-0",
                glassHeader && "z-40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75",
                glassHeader && !frameCanvas && "[html.light_&]:bg-transparent [html.light_&]:backdrop-blur-none",
                glassHeader && (headerInFlow || (inset && frameCanvas) ? "relative" : "absolute inset-x-0 top-0")
              )}
            >
            <HomeCanvasPreviewHeader
              activeSection="find"
              changeSection={navigateToSection}
              onRightOpenChange={handleRightOpenChangeUser}
              railToggleClassName="text-muted-foreground size-10 rounded-md border border-[color:var(--shell-border)] hover:bg-foreground/5 hover:text-foreground md:size-8"
              rightOpen={rightOpen}
              showAuthActions={showAuthActions}
              showPublicSearch={showPublicSearch}
              showPublicNavigation={showPublicNavigation}
              showShellSidebar={showSidebarShell}
              showRightRailToggle={hasRightRail}
            />
            </div>

            {inset && frameCanvas ? (
              <div
                data-public-find-content-frame=""
                className="flex min-h-0 flex-1 p-[var(--shell-content-pad)] pt-0 md:pr-[var(--shell-content-pad)] md:pb-[var(--shell-content-pad)] md:pl-[var(--shell-content-pad)]"
              >
                <div data-public-find-canvas="" className={cn("relative flex min-h-0 w-full flex-1 overflow-hidden rounded-[28px] border border-[color:var(--shell-border)] bg-background", canvasClassName)}>
                  <div className="absolute inset-0 overflow-hidden overscroll-contain">
                    {children}
                  </div>
                </div>
              </div>
            ) : (
              children
            )}
            {searchDockBelowCanvas ? (
              <div ref={setDockHost} data-public-home-dock-host="" className={cn("z-30 min-h-[calc(110px+max(var(--shell-content-pad),env(safe-area-inset-bottom)))] shrink-0 px-[var(--shell-content-pad)] pb-[max(var(--shell-content-pad),env(safe-area-inset-bottom))] [&:has([data-public-map-search-dock])>[data-public-map-search-dock-loading]]:hidden", frameCanvas ? "relative" : "pointer-events-none absolute inset-x-0 bottom-0")}>
                <HomeCanvasSearchDockSkeleton />
              </div>
            ) : null}
          </ContentContainer>
          <ShellRightRail
            open={rightOpen}
            onOpenChange={handleRightOpenChangeUser}
            onAutoClose={handleRightOpenChangeAuto}
          />
        </div>
      </div>
    </SidebarProvider>
    </HomeCanvasDockHostContext.Provider>
  )
}
