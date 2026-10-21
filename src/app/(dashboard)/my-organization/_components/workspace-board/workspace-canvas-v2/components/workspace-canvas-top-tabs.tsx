"use client"

import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"
import styles from "./workspace-dock.module.css"

const items = [
  { value: "people", label: "People" },
  { value: "documents", label: "Documents" },
  { value: "tools", label: "Tools" },
  { value: "accelerator", label: "Accelerator" },
] as const

export function WorkspaceCanvasTopTabs({ tab, drawerCollapsed, handleTabOpen, handleTabChange, tabsListRef }: Pick<WorkspaceDrawerTabsProps, "tab" | "drawerCollapsed" | "handleTabOpen" | "handleTabChange" | "tabsListRef">) {
  return (
    <div className={styles.topNavigation} data-workspace-top-navigation>
      <TabsList ref={tabsListRef} aria-label="Workspace panels" className={styles.topTabList}>
        {items.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            aria-label={label}
            data-setup-guide-tab={value}
            data-panel-open={!drawerCollapsed && tab === value}
            // Activate on click, so Radix mousedown cannot select a new tab
            // and then mistake the same click for a request to close it.
            onMouseDown={(event) => { if (event.button === 0 && !event.ctrlKey) event.preventDefault() }}
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true })
              if (value === tab) handleTabOpen(value, true)
              else handleTabChange(value)
            }}
            onKeyDown={(event) => {
              if (value === tab && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                handleTabOpen(value, true)
              }
            }}
            className={styles.topTab}
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}
