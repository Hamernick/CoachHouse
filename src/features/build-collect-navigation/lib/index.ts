import { FIND_PATH } from "@/lib/find/routes"
import type { BuildCollectNavigationItem } from "../types"

export const COLLECT_NAVIGATION_ITEMS: BuildCollectNavigationItem[] = [
  {
    id: "explore",
    label: "Explore",
    description: "Find local support.",
    href: FIND_PATH,
  },
  {
    id: "collections",
    label: "Collections",
    description: "Save useful resources.",
    href: `/login?redirect=${encodeURIComponent(FIND_PATH)}`,
  },
]

export const BUILD_NAVIGATION_ITEMS: BuildCollectNavigationItem[] = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Plan and work together.",
    href: "/build#workspace",
  },
  {
    id: "accelerator",
    label: "Accelerator",
    description: "Launch your nonprofit.",
    href: "/build#accelerator",
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Learn the essentials.",
    href: "/build#documentation",
  },
  {
    id: "pricing",
    label: "Pricing",
    description: "Find your plan.",
    href: "/build#pricing",
  },
]
