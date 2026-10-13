import type { ComponentType } from "react"

import {
  buildAppSidebarMenuButtonOwnerProps,
  buildAppSidebarOwnerId,
  buildAppSidebarTooltipProps,
} from "@/components/app-sidebar/react-grab"
import type { PrototypeLabSidebarTreeNode } from "@/lib/prototype-lab-sidebar-tree"

const NAV_MAIN_SOURCE = "src/components/nav-main.tsx"

export type NavMainItem = {
  title: string
  href?: string
  icon?: ComponentType<{ className?: string }>
  children?: NavMainItem[]
  tree?: PrototypeLabSidebarTreeNode[]
  locked?: boolean
  badge?: string
  upgradeHref?: string
  upgradeLabel?: string
}

export function buildMainNavItemReactGrabProps(item: NavMainItem, source = NAV_MAIN_SOURCE) {
  const ownerId = buildAppSidebarOwnerId("main", item.href ?? item.title)
  const notes = `Main sidebar nav item: ${item.title}`

  return {
    ownerProps: buildAppSidebarMenuButtonOwnerProps({
      ownerId,
      component: "AppSidebarMainNavItem",
      source,
      variant: item.tree?.length ? "tree" : item.locked ? "locked" : "link",
      notes,
    }),
    tooltipProps: buildAppSidebarTooltipProps({
      ownerId,
      component: "AppSidebarMainNavItem",
      source,
      children: item.title,
      notes,
    }),
  }
}
