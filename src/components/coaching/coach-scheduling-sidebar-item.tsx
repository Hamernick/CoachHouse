"use client"

import Link from "next/link"

import { CoachingAvatarGroup } from "@/components/coaching/coaching-avatar-group"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function CoachSchedulingSidebarItem() {

  return (
    <SidebarGroup className="px-0 py-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={{children: "Coaching", className: "whitespace-nowrap"}}
              className="justify-start gap-2"
              aria-label="Open coaching scheduling"

            >
              <Link href="/coaching">
                <CoachingAvatarGroup
                  size="sm"
                  label="Coach available"
                  limit={1}
                  showStatus
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1 truncate whitespace-nowrap leading-snug group-data-[collapsible=icon]:hidden">
                  Coaching
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
