import type { ReactNode } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarHeader } from "@/components/ui/sidebar"
import { AppShellCalendarAction } from "./app-shell-calendar-action"
import { SidebarBrand } from "./sidebar-brand"

export function AppShellSidebarHeader({
  children,
  brandHref,
  showCalendar,
}: {
  children?: ReactNode
  brandHref: string
  showCalendar: boolean
}) {
  return (
    <SidebarHeader>
      {children ?? <SidebarBrand href={brandHref} />}
      <div className="flex items-center justify-between px-2 pt-2 pr-10 md:hidden">
        <span className="text-muted-foreground text-xs">Appearance</span>
        <ThemeToggle />
      </div>
      {showCalendar ? (
        <div className="px-2">
          <AppShellCalendarAction placement="sidebar" />
        </div>
      ) : null}
    </SidebarHeader>
  )
}
