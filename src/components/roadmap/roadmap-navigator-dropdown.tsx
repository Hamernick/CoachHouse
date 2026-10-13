"use client"

import CheckIcon from "lucide-react/dist/esm/icons/check"
import CircleIcon from "lucide-react/dist/esm/icons/circle"
import CircleDotIcon from "lucide-react/dist/esm/icons/circle-dot"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { withEditorReturnTo } from "@/lib/workspace/editor-navigation"

import {
  getReactGrabLinkedSurfaceProps,
  getReactGrabOwnerProps,
} from "@/components/dev/react-grab-surface"
import {
  buildRoadmapTocItems,
  isFrameworkSection,
  resolveRoadmapSectionStatus,
} from "@/components/roadmap/roadmap-editor/helpers"
import { Button } from "@/components/ui/button"
import { CircularProgress } from "@/components/ui/circular-progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WORKSPACE_COMPACT_PICKER_CLASSNAME } from "@/components/workspace/workspace-tutorial-theme"
import type { RoadmapSection } from "@/lib/roadmap"
import { cn } from "@/lib/utils"
import { requestWorkspaceRoadmapDrawer } from "@/lib/workspace/data-drawer-events"
import {
  getWorkspaceRoadmapDrawerPath,
  getWorkspaceDrawerPath,
  WORKSPACE_ROADMAP_PATH,
} from "@/lib/workspace/routes"

const owner = {
  ownerId: "roadmap-navigator-dropdown",
  component: "RoadmapNavigatorDropdown",
  source: "src/components/roadmap/roadmap-navigator-dropdown.tsx",
  tokenSource: "src/components/workspace/workspace-tutorial-theme.ts",
}

export function RoadmapNavigatorDropdown({
  sections,
  basePath = WORKSPACE_ROADMAP_PATH,
  returnTo,
}: {
  sections: RoadmapSection[]
  basePath?: string
  returnTo?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const guideReturn = searchParams.get("guide") === "1" ? `${pathname}?${searchParams}` : null
  const parentHref = guideReturn ?? returnTo ?? searchParams.get("returnTo") ?? getWorkspaceDrawerPath({ tab: "accelerator" })
  const items = buildRoadmapTocItems(sections).flatMap((item) => [
    { section: item.section, nested: false },
    ...(item.type === "group"
      ? item.children.map((section) => ({ section, nested: true }))
      : []),
  ])

  if (!items.length) return null
  const completedCount = items.filter(
    ({ section }) => resolveRoadmapSectionStatus(section) === "complete"
  ).length
  const completionLabel = `${completedCount} of ${items.length} roadmap sections complete`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-setup-guide-target="roadmap"
          aria-label={`Strategic roadmap, ${completionLabel}`}
          title={completionLabel}
          className={cn(WORKSPACE_COMPACT_PICKER_CLASSNAME, "gap-1.5 text-sm")}
          {...getReactGrabOwnerProps({
            ...owner, slot: "trigger",
            primitiveImport: "@/components/ui/dropdown-menu",
          })}
        >
          <CircularProgress
            value={(completedCount / items.length) * 100}
            size={16}
            strokeWidth={2}
            decorative
            className="shrink-0"
          />
          Strategic roadmap
          <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(30rem,70dvh,var(--radix-dropdown-menu-content-available-height))] w-80 max-w-[calc(100vw-2rem)] overscroll-contain rounded-xl border-border/70 bg-popover p-1.5 text-popover-foreground"
        aria-label="Strategic roadmap"
        {...getReactGrabLinkedSurfaceProps({
          ...owner, slot: "content", surfaceKind: "content",
          primitiveImport: "@/components/ui/dropdown-menu",
        })}
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-sm font-semibold">Your roadmap</span>
          <span className="text-muted-foreground text-xs font-normal tabular-nums" aria-label={completionLabel}>
            {completedCount} / {items.length} complete
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 mb-1.5" />
        {items.map(({ section, nested }, index) => {
          const status = resolveRoadmapSectionStatus(section)
          const title = isFrameworkSection(section)
            ? section.templateTitle
            : section.title
          const isCurrent =
            (searchParams.get("drawer") === "roadmap" &&
              searchParams.get("section") === section.slug) ||
            pathname === `${basePath}/${section.slug}`
          const StatusIcon = status === "complete" ? CheckIcon
            : status === "in_progress" ? CircleDotIcon : CircleIcon
          return (
            <DropdownMenuItem
              asChild
              key={section.id}
              textValue={title}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "group/step relative min-h-11 cursor-pointer gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground sm:min-h-10",
                nested && "ml-5",
                isCurrent && "bg-muted font-medium"
              )}
            >
              <Link
                href={withEditorReturnTo(basePath === WORKSPACE_ROADMAP_PATH ? getWorkspaceRoadmapDrawerPath(section.slug) : `${basePath}/${section.slug}`, parentHref)}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  if (basePath === WORKSPACE_ROADMAP_PATH && requestWorkspaceRoadmapDrawer(section.slug, parentHref)) event.preventDefault()
                }}
              >
              <span className="relative flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
                {index < items.length - 1 && !nested && !items[index + 1]?.nested ? (
                  <span className="bg-border pointer-events-none absolute top-6 h-3 w-px" />
                ) : null}
                <StatusIcon className={cn(
                  "size-4",
                  status === "complete" ? "text-primary" : "text-muted-foreground"
                )} />
              </span>
              <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">{title}</span>
              <span className="text-muted-foreground shrink-0 text-[11px]">
                {isCurrent ? "Current" : status === "in_progress" ? "In progress" : null}
              </span>
              <span className="sr-only">{status.replaceAll("_", " ")}</span>
              <ChevronRightIcon aria-hidden="true" className="size-3.5 opacity-0 group-hover/step:opacity-100 group-data-[highlighted]/step:opacity-100" />
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
