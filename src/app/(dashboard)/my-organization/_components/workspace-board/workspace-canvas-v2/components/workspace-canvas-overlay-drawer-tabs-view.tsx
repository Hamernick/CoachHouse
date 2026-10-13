"use client"
import { useState } from "react"
import { Tabs } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { WorkspaceDrawerNavigation } from "./workspace-drawer-navigation-view"
import { WorkspaceContentWindow } from "./workspace-content-window"
import { WorkspaceDrawerContent } from "./workspace-drawer-content"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"

// One Tabs provider and content tree in both responsive presentations.
export function WorkspaceDrawerTabs(props: WorkspaceDrawerTabsProps) {
  const { tab, handleTabChange, drawerCollapsed } = props
  const title = props.bodyOverride
    ? "Particle"
    : tab.charAt(0).toUpperCase() + tab.slice(1)
  const [lastVisible, setLastVisible] = useState({
    bodyOverride: props.bodyOverride,
    title,
  })
  if (
    !drawerCollapsed &&
    (lastVisible.bodyOverride !== props.bodyOverride ||
      lastVisible.title !== title)
  )
    setLastVisible({ bodyOverride: props.bodyOverride, title })
  return (
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      activationMode="manual"
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0",
        drawerCollapsed || props.windowState?.geometry
          ? "overflow-visible"
          : "overflow-hidden"
      )}
    >
      <WorkspaceDrawerNavigation
        {...props}
        drawerCollapsed={
          drawerCollapsed || Boolean(props.windowState?.geometry)
        }
      />
      <WorkspaceContentWindow
        windowState={props.windowState}
        collapsed={drawerCollapsed}
        title={drawerCollapsed ? lastVisible.title : title}
      >
        {(present) => (
          <WorkspaceDrawerContent
            {...props}
            contentPresent={present}
            bodyOverride={
              drawerCollapsed && present
                ? lastVisible.bodyOverride
                : props.bodyOverride
            }
          />
        )}
      </WorkspaceContentWindow>
    </Tabs>
  )
}
