"use client"

import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import BookOpenIcon from "lucide-react/dist/esm/icons/book-open"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"
import CreditCardIcon from "lucide-react/dist/esm/icons/credit-card"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import FolderKanbanIcon from "lucide-react/dist/esm/icons/folder-kanban"
import HelpCircleIcon from "lucide-react/dist/esm/icons/help-circle"
import LayersIcon from "lucide-react/dist/esm/icons/layers"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"
import RocketIcon from "lucide-react/dist/esm/icons/rocket"
import RouteIcon from "lucide-react/dist/esm/icons/route"
import ShieldIcon from "lucide-react/dist/esm/icons/shield"
import ShoppingBagIcon from "lucide-react/dist/esm/icons/shopping-bag"
import UsersIcon from "lucide-react/dist/esm/icons/users"

import type { SearchResult } from "@/lib/search/types"
import {
  WORKSPACE_PATH,
  WORKSPACE_ROADMAP_PATH,
  getWorkspaceDrawerPath,
  getWorkspaceEditorPath,
  getWorkspaceRoadmapDrawerPath,
} from "@/lib/workspace/routes"

export const SEARCH_MIN_WIDTH = 240

const GROUP_ORDER = [
  "Pages",
  "Accelerator",
  "Classes",
  "Modules",
  "Questions",
  "Programs",
  "My organization",
  "Roadmap",
  "Documents",
  "Community",
  "Marketplace",
  "Admin",
]

export function formatClassTitle(title: string) {
  const match = title.match(/^Session\s+[A-Za-z]\d+\s*[\u2013-]\s*(.+)$/i)
  if (match) return match[1].trim()
  return title
}

export function getInitials(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

export function getResultIcon(item: SearchResult) {
  const href = item.href
  const group = item.group.toLowerCase()

  if (item.id === "page-accelerator") return RocketIcon
  if (item.id === "page-roadmap") return RouteIcon
  if (item.id === "page-people") return UsersIcon
  if (item.id === "page-documents") return FileTextIcon
  if (group === "admin") return ShieldIcon
  if (group === "accelerator") return RocketIcon
  if (group === "classes") return BookOpenIcon
  if (group === "modules") return LayersIcon
  if (group === "questions") return HelpCircleIcon
  if (group === "documents") return FileTextIcon
  if (group === "roadmap") return RouteIcon
  if (group === "programs") return LayersIcon
  if (group === "community") return MapPinIcon
  if (group === "marketplace") return ShoppingBagIcon
  if (group === "my organization" || group === "organization")
    return Building2Icon

  if (href.startsWith("/billing")) return CreditCardIcon
  if (href.startsWith("/internal")) return ShieldIcon
  if (href.startsWith("/admin")) return ShieldIcon
  if (href.startsWith("/projects")) return FolderKanbanIcon
  if (href.startsWith("/tasks") || href.startsWith("/my-tasks")) {
    return ClipboardListIcon
  }
  if (href.startsWith("/people")) return UsersIcon
  if (href.startsWith("/community")) return MapPinIcon
  if (href.startsWith("/marketplace")) return ShoppingBagIcon
  if (href.startsWith("/accelerator")) return RocketIcon
  if (href.startsWith("/roadmap")) return RouteIcon
  if (href.startsWith("/organization")) return Building2Icon

  return ArrowUpRight
}

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function getPrefixedSearchId(id: string, prefix: string) {
  if (!id.startsWith(prefix)) return null
  const value = id.slice(prefix.length).trim()
  return value || null
}

function getSearchModuleId(item: SearchResult) {
  if (item.group === "Modules") {
    return (
      getPrefixedSearchId(item.id, "module:") ??
      getPrefixedSearchId(item.id, "module-")
    )
  }

  if (item.group !== "Questions") return null
  const indexedId = getPrefixedSearchId(item.id, "question:")
  if (indexedId) {
    return indexedId.split(":")[0] || null
  }

  return item.id.match(UUID_PATTERN)?.[0] ?? null
}

function getTrailingSearchId(id: string, prefix: string) {
  const value = getPrefixedSearchId(id, prefix)
  if (!value) return null
  const segments = value.split(":")
  return segments[segments.length - 1] || null
}

export function resolveGlobalSearchResultHref(item: SearchResult) {
  if (
    item.href.startsWith(`${WORKSPACE_PATH}?drawer=`) ||
    item.href.startsWith(`${WORKSPACE_PATH}?view=editor`) ||
    item.href.startsWith(WORKSPACE_ROADMAP_PATH)
  ) {
    return item.href
  }

  if (item.id === "page-accelerator") {
    return getWorkspaceDrawerPath({ tab: "accelerator" })
  }
  if (item.id === "page-roadmap") {
    return getWorkspaceDrawerPath({ tab: "roadmap" })
  }
  if (item.id === "page-programs") {
    return getWorkspaceEditorPath({ tab: "programs" })
  }
  if (item.id === "page-people") {
    return getWorkspaceDrawerPath({ tab: "people" })
  }
  if (item.id === "page-supporters") {
    return getWorkspaceEditorPath({ tab: "supporters" })
  }
  if (item.id === "page-documents") {
    return getWorkspaceDrawerPath({ tab: "documents" })
  }

  if (item.group === "Accelerator" || item.group === "Classes") {
    return getWorkspaceDrawerPath({ tab: "accelerator" })
  }

  const moduleId = getSearchModuleId(item)
  if (moduleId) {
    return getWorkspaceDrawerPath({ tab: "accelerator", moduleId })
  }

  if (item.group === "Programs") {
    const programId =
      getPrefixedSearchId(item.id, "program:") ??
      getPrefixedSearchId(item.id, "program-")
    return programId
      ? getWorkspaceEditorPath({ tab: "programs", programId })
      : getWorkspaceEditorPath({ tab: "programs" })
  }

  if (item.group === "My organization" || item.group === "Organization") {
    return getWorkspaceEditorPath({ tab: "company" })
  }

  if (item.group === "Roadmap") {
    const sectionSlug = getTrailingSearchId(item.id, "roadmap:")
    return sectionSlug
      ? getWorkspaceRoadmapDrawerPath(sectionSlug)
      : getWorkspaceDrawerPath({ tab: "roadmap" })
  }

  if (item.group === "Documents") {
    return getWorkspaceDrawerPath({
      tab: "documents",
      focus: getTrailingSearchId(item.id, "doc:"),
    })
  }

  return item.href
}

export function buildBaseSearchItems({
  enableAccelerator,
  showOrgAdmin,
  showMemberWorkspace,
  showPlatformLab,
}: {
  enableAccelerator: boolean
  showOrgAdmin: boolean
  showMemberWorkspace: boolean
  showPlatformLab: boolean
}): SearchResult[] {
  return [
    ...(enableAccelerator
      ? [
          {
            id: "page-accelerator",
            label: "Accelerator",
            href: getWorkspaceDrawerPath({ tab: "accelerator" }),
            group: "Pages",
            keywords: ["classes", "modules"],
          } satisfies SearchResult,
        ]
      : []),
    ...(showMemberWorkspace
      ? [
          {
            id: "page-workspace",
            label: "Workspace",
            href: "/workspace",
            group: "Pages",
            keywords: ["organization", "canvas", "workspace"],
          } satisfies SearchResult,
          {
            id: "page-projects",
            label: "Projects",
            href: "/projects",
            group: "Pages",
            keywords: ["workspace", "organization", "projects"],
          } satisfies SearchResult,
          {
            id: "page-tasks",
            label: "Tasks",
            href: "/tasks",
            group: "Pages",
            keywords: ["assigned", "tasks", "work"],
          } satisfies SearchResult,
          {
            id: "page-roadmap",
            label: "Roadmap",
            href: getWorkspaceDrawerPath({ tab: "roadmap" }),
            group: "Pages",
            keywords: ["strategic"],
          },
          {
            id: "page-programs",
            label: "Programs",
            href: getWorkspaceEditorPath({ tab: "programs" }),
            group: "Pages",
          },
          {
            id: "page-people",
            label: "People",
            href: getWorkspaceDrawerPath({ tab: "people" }),
            group: "Pages",
            keywords: ["team", "org chart"],
          },
          {
            id: "page-supporters",
            label: "Supporters",
            href: getWorkspaceEditorPath({ tab: "supporters" }),
            group: "Pages",
          },
          {
            id: "page-documents",
            label: "Documents",
            href: getWorkspaceDrawerPath({ tab: "documents" }),
            group: "Pages",
          },
        ]
      : []),
    {
      id: "page-find",
      label: "Find",
      href: "/",
      group: "Pages",
      keywords: ["map", "organizations"],
    },
    {
      id: "page-billing",
      label: "Billing",
      href: "/billing",
      group: "Pages",
      keywords: ["subscription", "plan"],
    },
    {
      id: "page-community",
      label: "Community",
      href: "/community",
      group: "Pages",
      keywords: ["map", "network"],
    },
    {
      id: "page-marketplace",
      label: "Marketplace",
      href: "/documentation/marketplace",
      group: "Pages",
      keywords: ["tools", "resources"],
    },
    ...(showOrgAdmin
      ? [
          {
            id: "page-admin",
            label: "Admin",
            href: "/admin",
            group: "Pages",
            keywords: ["access", "invites", "roles"],
          } satisfies SearchResult,
        ]
      : []),
    ...(showPlatformLab
      ? [
          {
            id: "page-platform-lab",
            label: "Platform Lab",
            href: "/internal/platform-lab",
            group: "Pages",
            keywords: ["internal", "dashboard", "lab", "projects"],
          } satisfies SearchResult,
        ]
      : []),
  ]
}

export function groupSearchResults(items: SearchResult[]) {
  const map = new Map<string, SearchResult[]>()
  items.forEach((item) => {
    const list = map.get(item.group) ?? []
    list.push(item)
    map.set(item.group, list)
  })

  const entries = Array.from(map.entries())
  entries.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a[0])
    const bi = GROUP_ORDER.indexOf(b[0])
    if (ai === -1 && bi === -1) return a[0].localeCompare(b[0])
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return entries
}
