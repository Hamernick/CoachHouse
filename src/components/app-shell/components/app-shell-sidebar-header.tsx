import type { ReactNode } from "react"
import dynamic from "next/dynamic"
import XIcon from "lucide-react/dist/esm/icons/x"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { SidebarBrand } from "./sidebar-brand"

const AppShellCalendarAction = dynamic(
  () => import("./app-shell-calendar-action").then((mod) => mod.AppShellCalendarAction),
  { ssr: false, loading: () => <span aria-hidden className="block h-11 w-full" /> }
)

export function AppShellSidebarHeader({
  children,
  brandHref,
  showCalendar = false,
}: {
  children?: ReactNode
  brandHref: string
  showCalendar?: boolean
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarHeader className="shrink-0 group-data-[collapsible=icon]:px-2 md:min-h-14">
      <div className="flex min-w-0 items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
        {children ?? <SidebarBrand href={brandHref} />}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 md:hidden"
          aria-label="Close menu"
          onClick={() => setOpenMobile(false)}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="flex items-center justify-between px-2 pt-2 md:hidden [&>button]:size-11">
        <span className="text-muted-foreground text-xs">Appearance</span>
        <ThemeToggle />
      </div>
      {showCalendar ? (
        <div className="px-2 md:hidden">
          <AppShellCalendarAction placement="sidebar" />
        </div>
      ) : null}
    </SidebarHeader>
  )
}
