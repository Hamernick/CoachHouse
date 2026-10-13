"use client"
import type { CSSProperties } from "react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { WorkspaceCanvasDrawerTab } from "./workspace-canvas-overlay-drawer-tabs"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"
import styles from "./workspace-dock.module.css"

function WorkspaceDrawerTabTrigger({
  value,
  children,
  onOpen,
  composerMode,
}: {
  value: WorkspaceCanvasDrawerTab
  children: string
  composerMode?: boolean
  onOpen: (tab: WorkspaceCanvasDrawerTab) => void
}) {
  return (
    <TabsTrigger
      value={value}
      data-setup-guide-tab={value}
      onClick={() => onOpen(value)}
      className={cn(
        "h-11 min-w-0 flex-none gap-2 px-3 py-2 text-left after:hidden md:h-7 md:px-2 md:py-1",
        composerMode && "!h-[var(--workspace-dock-tabs-height)]",
        composerMode && styles.tab
      )}
    >
      {children}
    </TabsTrigger>
  )
}

export function WorkspaceDrawerNavigation({
  composerMode,
  drawerCollapsed,
  handleTabOpen,
  tabsHeaderRef,
  tabsListRef,
  tabIndicator,
  endAction,
}: Pick<
  WorkspaceDrawerTabsProps,
  | "composerMode"
  | "drawerCollapsed"
  | "handleTabOpen"
  | "tabsHeaderRef"
  | "tabsListRef"
  | "tabIndicator"
  | "endAction"
>) {
  return (
    <div
      ref={tabsHeaderRef}
      data-workspace-dock-navigation={composerMode ? "true" : undefined}
      className={cn(
        "border-border/60 relative flex min-w-0 shrink-0 items-end px-4 pb-0.5 md:px-8",
        drawerCollapsed ? "-mt-3 pt-0" : "border-b pt-0.5",
        composerMode && "mt-0 items-center px-2 pt-0 pb-0 md:px-2"
      )}
    >
      <TabsList
        variant="line"
        ref={tabsListRef}
        className={cn(
          "h-11 w-full min-w-0 justify-start overflow-x-auto p-0 [scrollbar-width:none] group-data-[orientation=horizontal]/tabs:!h-11 md:h-7 md:w-auto md:group-data-[orientation=horizontal]/tabs:!h-7 [&::-webkit-scrollbar]:hidden",
          composerMode &&
            "!h-[var(--workspace-dock-tabs-height)] touch-pan-x scroll-px-2 overscroll-x-contain group-data-[orientation=horizontal]/tabs:!h-[var(--workspace-dock-tabs-height)] md:w-full md:group-data-[orientation=horizontal]/tabs:!h-[var(--workspace-dock-tabs-height)]",
          composerMode && styles.tabList
        )}
      >
        <WorkspaceDrawerTabTrigger
          value="organization"
          composerMode={composerMode}
          onOpen={handleTabOpen}
        >
          Organization
        </WorkspaceDrawerTabTrigger>
        <WorkspaceDrawerTabTrigger
          value="people"
          composerMode={composerMode}
          onOpen={handleTabOpen}
        >
          People
        </WorkspaceDrawerTabTrigger>
        <WorkspaceDrawerTabTrigger
          value="documents"
          composerMode={composerMode}
          onOpen={handleTabOpen}
        >
          Documents
        </WorkspaceDrawerTabTrigger>
        <WorkspaceDrawerTabTrigger
          value="particles"
          composerMode={composerMode}
          onOpen={handleTabOpen}
        >
          Particles
        </WorkspaceDrawerTabTrigger>
        <WorkspaceDrawerTabTrigger
          value="tools"
          composerMode={composerMode}
          onOpen={handleTabOpen}
        >
          Tools
        </WorkspaceDrawerTabTrigger>
        <WorkspaceDrawerTabTrigger
          value="accelerator"
          composerMode={composerMode}
          onOpen={handleTabOpen}
        >
          Accelerator
        </WorkspaceDrawerTabTrigger>
      </TabsList>
      {endAction}
      <span
        aria-hidden
        data-workspace-data-drawer-tab-indicator="true"
        className={cn(
          "bg-foreground absolute bottom-[-1px] left-0 z-10 h-0.5 rounded-full transition-[transform,width,opacity] duration-200 ease-out motion-reduce:transition-none",
          tabIndicator.visible ? "opacity-100" : "opacity-0"
        )}
        style={
          {
            width: `${tabIndicator.width}px`,
            transform: `translateX(${tabIndicator.left}px)`,
          } satisfies CSSProperties
        }
      />
    </div>
  )
}
