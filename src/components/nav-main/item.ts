import type { ComponentType } from "react"

import type { PrototypeLabSidebarTreeNode } from "@/lib/prototype-lab-sidebar-tree"

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
