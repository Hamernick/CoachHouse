import type { ReactNode } from "react"
import Link from "next/link"

import MenuIcon from "lucide-react/dist/esm/icons/menu"
import PanelRightCloseIcon from "lucide-react/dist/esm/icons/panel-right-close"
import PanelRightOpenIcon from "lucide-react/dist/esm/icons/panel-right-open"

import { AppShellCalendarAction } from "@/components/app-shell/components/app-shell-calendar-action"
import { NotificationsMenu } from "@/components/notifications/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { RIGHT_RAIL_ID } from "../constants"
import { useRightRailPresence } from "../right-rail"

type AppShellHeaderProps = {
  breadcrumbs?: ReactNode
  headerSearch?: ReactNode
  compactMobileSpacing?: boolean
  hideOnMobile?: boolean
  hasUser: boolean
  isAdmin: boolean
  onboardingLocked: boolean
  rightOpen: boolean
  onRightOpenChange: (open: boolean) => void
}

export function AppShellHeader({
  breadcrumbs,
  headerSearch,
  compactMobileSpacing = false,
  hideOnMobile = false,
  hasUser,
  isAdmin,
  onboardingLocked,
  rightOpen,
  onRightOpenChange,
}: AppShellHeaderProps) {
  const hasRightRail = useRightRailPresence()
  const { isMobile, openMobile, toggleSidebar } = useSidebar()
  const hasBreadcrumbs = Boolean(breadcrumbs)
  const isCompactMobileHeader = isMobile && onboardingLocked
  const showHeaderToggles = !isMobile
  const toggleButtonClass =
    "size-8 rounded-md border border-[color:var(--shell-border)] bg-transparent text-muted-foreground shadow-none transition-colors hover:bg-foreground/5 hover:text-foreground"

  return (
    <header className={cn("text-muted-foreground flex shrink-0 flex-col bg-[var(--shell-bg)] text-sm", hideOnMobile && "max-md:hidden")}>
      <div
        className={cn(
          "flex min-h-16 min-w-0 items-center py-2 pr-1 pl-[var(--shell-content-pad)] md:min-h-14 md:py-0 md:pr-[var(--shell-content-pad)]",
          isCompactMobileHeader && "min-h-12 py-1.5",
          compactMobileSpacing && "max-md:min-h-0 max-md:pb-0"
        )}
      >
        <div
          className={cn(
            "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]",
            headerSearch && "grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto]"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:hidden"
              aria-label="Menu"
              aria-expanded={openMobile}
              onClick={toggleSidebar}
            >
              <MenuIcon />
            </Button>
            <SidebarTrigger
              className={cn(toggleButtonClass, "hidden md:inline-flex")}
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
          {!headerSearch ? (
            <div
              id="site-header-actions-center"
              className="hidden min-w-0 items-center overflow-hidden md:flex md:justify-end lg:justify-center"
            />
          ) : null}
          <div
            className={cn(
              "flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 md:flex-nowrap md:gap-2 [&>button]:max-md:min-h-11 [&>button]:max-md:min-w-11",
              headerSearch && "flex-nowrap"
            )}
          >
            {hasUser ? headerSearch : null}
            <div
              id="site-header-actions-right"
              className="flex flex-wrap items-center gap-2 md:flex-nowrap"
            />
            {hasUser && !isMobile ? (
              <AppShellCalendarAction />
            ) : null}
            {hasUser && !isCompactMobileHeader && !(hideOnMobile && isMobile) ? <NotificationsMenu /> : null}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            {!hasUser ? headerSearch : null}
            {!hasUser ? (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-[color:var(--shell-border)] bg-transparent"
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
