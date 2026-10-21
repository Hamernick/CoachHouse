"use client"
import { useRef, useState } from "react"
import { Tabs } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { WorkspaceCanvasOrganizationButton } from "./workspace-canvas-organization-button"
import { WorkspaceCanvasTopTabs } from "./workspace-canvas-top-tabs"
import { WorkspaceDrawerNavigation } from "./workspace-drawer-navigation-view"
import { WorkspaceContentWindow } from "./workspace-content-window"
import { WorkspaceDrawerContent } from "./workspace-drawer-content"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"

// One Tabs provider and content tree in both responsive presentations.
export function WorkspaceDrawerTabs(props: WorkspaceDrawerTabsProps) {
  const { tab, handleTabChange, drawerCollapsed } = props
  const organizationTriggerRef = useRef<HTMLButtonElement>(null)
  const [hasExpanded, setHasExpanded] = useState(!drawerCollapsed)
  if (!drawerCollapsed && !hasExpanded) setHasExpanded(true)
  const showSelectedTab = !drawerCollapsed || hasExpanded
  const title = props.bodyOverride
    ? (props.particleInspectorTitle ?? "Particle")
    : tab.charAt(0).toUpperCase() + tab.slice(1)
  const [lastVisible, setLastVisible] = useState({
    bodyOverride: props.bodyOverride,
    title,
    maxWidth: props.particleInspectorMaxWidth,
  })
  if (
    !drawerCollapsed &&
    (lastVisible.bodyOverride !== props.bodyOverride ||
      lastVisible.title !== title ||
      lastVisible.maxWidth !== props.particleInspectorMaxWidth)
  )
    setLastVisible({
      bodyOverride: props.bodyOverride,
      title,
      maxWidth: props.particleInspectorMaxWidth,
    })
  const visibleBody = drawerCollapsed
    ? lastVisible.bodyOverride
    : props.bodyOverride
  return (
    <Tabs
      value={showSelectedTab ? tab : ""}
      onValueChange={handleTabChange}
      activationMode="manual"
      orientation="horizontal"
      className={cn(
        props.composerMode ? "contents" : "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0",
        drawerCollapsed || props.windowState?.geometry
          ? "overflow-visible"
          : "overflow-hidden"
      )}
    >
      {props.composerMode ? <WorkspaceCanvasOrganizationButton {...props} triggerRef={organizationTriggerRef} /> : null}
      {props.composerMode ? <WorkspaceCanvasTopTabs {...props} /> : <WorkspaceDrawerNavigation
        {...props}
        tabIndicator={{
          ...props.tabIndicator,
          visible: showSelectedTab && props.tabIndicator.visible,
        }}
        drawerCollapsed={
          drawerCollapsed || Boolean(props.windowState?.geometry)
        }
      />}
      <WorkspaceContentWindow
        organizationTriggerRef={organizationTriggerRef}
        headerSlots={
          Boolean(visibleBody) ||
          ["organization", "people", "documents", "accelerator", "particles"].includes(tab)
        }
        windowState={props.windowState}
        collapsed={drawerCollapsed}
        title={drawerCollapsed ? lastVisible.title : title}
        maxWidth={
          visibleBody
            ? drawerCollapsed
              ? lastVisible.maxWidth
              : props.particleInspectorMaxWidth
            : undefined
        }
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
