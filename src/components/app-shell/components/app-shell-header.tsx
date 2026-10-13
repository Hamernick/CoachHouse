import { useEffect, useRef, type ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"

import MenuIcon from "lucide-react/dist/esm/icons/menu"
import PanelRightCloseIcon from "lucide-react/dist/esm/icons/panel-right-close"
import PanelRightOpenIcon from "lucide-react/dist/esm/icons/panel-right-open"

import { NotificationsMenu } from "@/components/notifications/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { RIGHT_RAIL_ID } from "../constants"
import { useRightRailPresence } from "../right-rail"

const AppShellCalendarAction = dynamic(
  () => import("./app-shell-calendar-action").then((mod) => mod.AppShellCalendarAction),
  { ssr: false, loading: () => <span aria-hidden className="block size-9" /> }
)

type AppShellHeaderProps = {
  breadcrumbs?: ReactNode
  hasUser: boolean
  isAdmin: boolean
  onboardingLocked: boolean
  rightOpen: boolean
  onRightOpenChange: (open: boolean) => void
}

export function AppShellHeader({
  breadcrumbs,
  hasUser,
  isAdmin,
  onboardingLocked,
  rightOpen,
  onRightOpenChange,
}: AppShellHeaderProps) {
  const hasRightRail = useRightRailPresence()
  const { isMobile, openMobile, toggleSidebar } = useSidebar()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const wasMobileMenuOpen = useRef(false)
  useEffect(() => {
    if (isMobile && wasMobileMenuOpen.current && !openMobile) {
      const frame = requestAnimationFrame(() => menuButtonRef.current?.focus())
      wasMobileMenuOpen.current = false
      return () => cancelAnimationFrame(frame)
    }
    wasMobileMenuOpen.current = openMobile
  }, [isMobile, openMobile])
  const hasBreadcrumbs = Boolean(breadcrumbs)
  const isCompactMobileHeader = isMobile && onboardingLocked
  const showHeaderToggles = !isMobile
  const toggleButtonClass =
    "size-8 rounded-md border border-[color:var(--shell-border)] bg-transparent text-muted-foreground shadow-none transition-colors hover:bg-foreground/5 hover:text-foreground"

  return (
    <header className="text-muted-foreground flex shrink-0 flex-col bg-[var(--shell-bg)] text-sm">
      <div
        className={cn(
          "flex min-h-16 min-w-0 items-center py-2 pr-1 pl-[var(--shell-content-pad)] md:h-14 md:min-h-14 md:py-0 md:pr-[var(--shell-content-pad)]",
          isCompactMobileHeader && "min-h-12 py-1.5"
        )}
      >
        <div
          className={cn(
            "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 touch-manipulation md:hidden"
              aria-label="Menu"
              aria-expanded={openMobile}
              onClick={toggleSidebar}
            >
              <MenuIcon />
            </Button>
            <SidebarTrigger
              className="hidden size-8 rounded-md border-0 bg-transparent text-sidebar-foreground/80 shadow-none ring-sidebar-ring transition-colors duration-200 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground/70 focus-visible:ring-2 focus-visible:ring-inset active:bg-sidebar-accent active:text-sidebar-accent-foreground motion-reduce:transition-none md:inline-flex dark:hover:bg-sidebar-accent"
              aria-label="Toggle sidebar"
            />
            {showHeaderToggles && hasBreadcrumbs ? (
              <Separator orientation="vertical" className="bg-border h-4" />
            ) : null}
            {hasBreadcrumbs ? (
              <div
                id="site-header-title"
                className="min-w-0 flex-1 overflow-hidden"
              >
                {breadcrumbs}
              </div>
            ) : null}
          </div>
          <div
            id="site-header-actions-center"
            className="hidden min-w-0 items-center overflow-hidden md:flex md:justify-end lg:justify-center"
          />
          <div
            className={cn(
              "flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 md:flex-nowrap [&_button]:max-md:min-h-11 [&_button]:max-md:min-w-11"
            )}
          >
            <div
              id="site-header-actions-right"
              className="flex flex-wrap items-center gap-1 empty:hidden md:flex-nowrap"
            />
            <div id="site-header-actions-search" className="flex items-center empty:hidden" />
            {hasUser && !isMobile && !onboardingLocked ? (
              <AppShellCalendarAction />
            ) : null}
            {hasUser && !isCompactMobileHeader ? <NotificationsMenu /> : null}
            <div className="hidden items-center md:flex">
              <ThemeToggle />
            </div>
            {!hasUser ? (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-[color:var(--shell-border)] bg-transparent max-md:min-h-11 max-md:min-w-11 touch-manipulation"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            ) : null}
            {hasRightRail && showHeaderToggles ? (
              <Button
                variant="ghost"
                size="icon"
                className={toggleButtonClass}
                aria-controls={RIGHT_RAIL_ID}
                aria-expanded={rightOpen}
                onClick={() => onRightOpenChange(!rightOpen)}
              >
                {rightOpen ? (
                  <PanelRightCloseIcon className="h-4 w-4" />
                ) : (
                  <PanelRightOpenIcon className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle details panel</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div
        id="site-header-subnav"
        className="border-t border-[color:var(--shell-border)] bg-[var(--shell-bg)] empty:hidden"
      />
    </header>
  )
}
