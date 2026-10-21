"use client"

import { useState } from "react"
import Link from "next/link"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { WorkspaceSidebarSlot } from "@/components/workspace/workspace-sidebar-slot"
import { WorkspaceSidebarActions } from "@/features/workspace-management/client"
import { cn } from "@/lib/utils"
import { type NavMainItem } from "./item"

export function NavMainWorkspaceItem({ item, isActive, namedWorkspaceSelected, showControls, onPrefetch, tourId }: {
  item: NavMainItem
  isActive: boolean
  namedWorkspaceSelected: boolean
  showControls: boolean
  onPrefetch: (href: string | undefined) => void
  tourId?: string
}) {
  const [open, setOpen] = useState(true)
  const homeActive = isActive && !namedWorkspaceSelected
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <div className="flex min-w-0 items-center pr-11 md:pr-8 group-data-[collapsible=icon]:pr-0">
          <SidebarMenuButton
            asChild tooltip={{ children: item.title }}
            className="w-auto max-w-full justify-start gap-0 font-medium text-sidebar-foreground/60 hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent group-has-data-[sidebar=menu-action]/menu-item:pr-0 group-data-[collapsible=icon]:justify-center"

          >
            <Link data-workspace-navigation href="/workspace" prefetch title={item.title} data-tour={tourId} aria-current={homeActive ? "page" : undefined}
              onFocus={() => onPrefetch(item.href)} onPointerEnter={() => onPrefetch(item.href)}

            >
              {item.icon ? <item.icon className="hidden size-4 shrink-0 group-data-[collapsible=icon]:block" /> : null}
              <span className="min-w-0 truncate leading-snug whitespace-nowrap group-data-[collapsible=icon]:hidden">{item.title}</span>
            </Link>
          </SidebarMenuButton>
          {showControls ? <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={open ? "Collapse Workspace" : "Expand Workspace"}
              className="size-11 shrink-0 rounded-md bg-transparent text-sidebar-foreground/60 hover:bg-transparent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden md:size-6 dark:hover:bg-transparent">
              <ChevronRightIcon className={cn("size-3.5 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
            </Button>
          </CollapsibleTrigger> : null}
        </div>
        {showControls ? <WorkspaceSidebarActions><WorkspaceSidebarSlot /></WorkspaceSidebarActions> : null}
      </SidebarMenuItem>
    </Collapsible>
  )
}
