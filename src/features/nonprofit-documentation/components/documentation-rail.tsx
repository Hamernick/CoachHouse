"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import BookOpenTextIcon from "lucide-react/dist/esm/icons/book-open-text"
import FlagIcon from "lucide-react/dist/esm/icons/flag"
import DollarSignIcon from "lucide-react/dist/esm/icons/dollar-sign"
import WaypointsIcon from "lucide-react/dist/esm/icons/waypoints"
import WrenchIcon from "lucide-react/dist/esm/icons/wrench"
import LibraryIcon from "lucide-react/dist/esm/icons/library"

import { Badge } from "@/components/ui/badge"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { DOCUMENTATION_NAVIGATION, DOCUMENTATION_PATH } from "../lib"

const SECTION_STYLE = {
  "fund-your-project": {
    Icon: DollarSignIcon,
    color: "text-emerald-700 dark:text-emerald-400",
  },
  "get-started": {
    Icon: FlagIcon,
    color: "text-amber-700 dark:text-amber-400",
  },
  "best-practices": {
    Icon: WaypointsIcon,
    color: "text-violet-700 dark:text-violet-400",
  },
  tools: { Icon: WrenchIcon, color: "text-sky-700 dark:text-sky-400" },
  resources: { Icon: LibraryIcon, color: "text-rose-700 dark:text-rose-400" },
}

const RAIL_LINK_CLASS =
  "relative h-auto min-h-11 justify-start gap-2 rounded-lg py-1 bg-transparent text-sm font-normal text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground active:bg-sidebar-accent data-[active=true]:bg-transparent data-[active=true]:hover:bg-sidebar-accent data-[active=true]:focus-visible:bg-sidebar-accent data-[active=true]:active:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-foreground md:h-auto md:min-h-8 motion-reduce:transition-none [&>span:last-child]:overflow-visible [&>span:last-child]:text-clip [&>span:last-child]:whitespace-normal"

export function DocumentationRail({
  contextual = false,
}: {
  contextual?: boolean
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <nav
      className={cn(
        "flex flex-col gap-3 px-3 pt-2 pb-4 group-data-[collapsible=icon]:px-0",
        contextual &&
          "border-border/60 mt-2 border-t pt-3 group-data-[collapsible=icon]:hidden"
      )}
      aria-label="Documentation navigation"

    >
      <SidebarGroup className="py-0">
        <SidebarGroupContent>
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === DOCUMENTATION_PATH}
                tooltip="Documentation home"
                className={RAIL_LINK_CLASS}
              >
                <Link
                  href={DOCUMENTATION_PATH}
                  onNavigate={() => setOpenMobile(false)}
                  className="flex items-center gap-2"
                  aria-current={
                    pathname === DOCUMENTATION_PATH ? "page" : undefined
                  }
                >
                  <BookOpenTextIcon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words whitespace-normal">Home</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {DOCUMENTATION_NAVIGATION.map((section) => {
        const { Icon, color } = SECTION_STYLE[section.id]
        return (
          <SidebarGroup key={section.id} className="py-0">
            <SidebarGroupLabel className="text-foreground mb-0 h-auto min-h-7 gap-2.5 whitespace-normal text-sm font-medium tracking-normal normal-case">
              <Icon className={cn("size-4 shrink-0", color)} aria-hidden />
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {section.items.map((item) => {
                  const active = Boolean(
                    item.href &&
                    !item.href.includes("#") &&
                    pathname === item.href
                  )

                  return (
                    <SidebarMenuItem key={item.title}>
                      {item.href ? (
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className={cn(RAIL_LINK_CLASS, "pl-[1.875rem]")}
                        >
                          <Link
                            href={item.href}
                            onNavigate={() => setOpenMobile(false)}
                            className="flex min-w-0 items-center gap-2"
                            title={item.description}
                            aria-current={active ? "page" : undefined}
                          >
                            {active ? (
                              <span
                                aria-hidden
                                className={cn("absolute left-2.5 size-1.5 rounded-full bg-current", color)}
                              />
                            ) : null}
                            <span className="min-w-0 break-words whitespace-normal">{item.title}</span>
                            {item.isNew ? (
                              <Badge variant="secondary" className="shrink-0 rounded-full px-1.5 py-0 text-[10px] font-medium">
                                New
                              </Badge>
                            ) : null}
                            {item.external ? (
                              <ArrowUpRightIcon
                                className="ml-auto size-3.5 shrink-0"
                                aria-hidden
                              />
                            ) : null}
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        <div
                          className="text-muted-foreground/70 flex min-h-11 min-w-0 items-center py-1 pr-2 pl-[1.875rem] text-sm md:min-h-8"
                          aria-disabled="true"
                          title={`${item.description} Planned for a later phase.`}
                        >
                          <span className="min-w-0 break-words whitespace-normal">{item.title}</span>
                        </div>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </nav>
  )
}
