"use client"

import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react"
import { useRouter } from "next/navigation"

import { RoadmapEditorToc } from "@/components/roadmap/roadmap-editor/components/roadmap-editor-toc"
import { ROADMAP_TOC_GROUP_PARENT_BY_CHILD } from "@/components/roadmap/roadmap-editor/constants"
import {
  buildRoadmapTocItems,
  createDraftMap,
  isFrameworkSection,
  resolveRoadmapSectionStatus,
} from "@/components/roadmap/roadmap-editor/helpers"
import { useRoadmapEditorLayoutMetrics } from "@/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-layout-metrics"
import type { RoadmapDraft } from "@/components/roadmap/roadmap-editor/types"
import { Button } from "@/components/ui/button"
import type { RoadmapSection } from "@/lib/roadmap"
import {
  getWorkspaceRoadmapDrawerPath,
  WORKSPACE_ROADMAP_PATH,
} from "@/lib/workspace/routes"
import { requestWorkspaceRoadmapDrawer } from "@/lib/workspace/data-drawer-events"
import { cn } from "@/lib/utils"

export type RoadmapNavigatorSectionProps = {
  sections: RoadmapSection[]
  basePath: string
  activeSectionId?: string | null
  drafts?: Record<string, RoadmapDraft>
  onSectionSelect?: (next: { id: string; slug: string }) => void
  showHeader?: boolean
  collapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  tocRailOffset?: string
}

const DEFAULT_OPEN_GROUPS = {
  fundraising: true,
  board_strategy: true,
} as const

const ROADMAP_TOC_TITLE_CLASS_NAME =
  "text-[15px] leading-5 font-semibold tracking-tight text-foreground"

export const ROADMAP_NAVIGATOR_HEADER_BUTTON_CLASS_NAME =
  "hover:bg-muted/30 h-8 w-full justify-between rounded-lg px-2.5 py-0 text-left"

function RoadmapNavigatorHeaderButton({
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={ROADMAP_NAVIGATOR_HEADER_BUTTON_CLASS_NAME}

      {...props}
    >
      {children}
    </Button>
  )
}

export function RoadmapNavigatorSection({
  sections,
  basePath,
  activeSectionId = null,
  drafts,
  onSectionSelect,
  showHeader = true,
  collapsed,
  onCollapsedChange,
  tocRailOffset,
}: RoadmapNavigatorSectionProps) {
  const router = useRouter()
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(DEFAULT_OPEN_GROUPS)
  const resolvedCollapsed = collapsed ?? internalCollapsed
  const tocItems = useMemo(() => buildRoadmapTocItems(sections), [sections])
  const resolvedDrafts = useMemo(
    () => drafts ?? createDraftMap(sections),
    [drafts, sections]
  )
  const { tocIndicator, sectionsListRef } = useRoadmapEditorLayoutMetrics({
    activeId: activeSectionId ?? "",
    openGroups,
    sections,
    headerTitle: "",
    headerSubtitle: "",
  })

  useEffect(() => {
    const parentId = ROADMAP_TOC_GROUP_PARENT_BY_CHILD.get(
      activeSectionId ?? ""
    )
    if (!parentId) return
    setOpenGroups((previous) =>
      previous[parentId] ? previous : { ...previous, [parentId]: true }
    )
  }, [activeSectionId])

  const handleToggleGroup = useCallback((groupId: string) => {
    setOpenGroups((previous) => ({
      ...previous,
      [groupId]: !(previous[groupId] ?? true),
    }))
  }, [])

  const handleSectionClick = useCallback(
    (next: { id: string; slug: string }) => {
      if (onSectionSelect) {
        onSectionSelect(next)
        return
      }
      if (
        basePath === WORKSPACE_ROADMAP_PATH &&
        requestWorkspaceRoadmapDrawer(next.slug)
      ) {
        return
      }
      router.push(
        basePath === WORKSPACE_ROADMAP_PATH
          ? getWorkspaceRoadmapDrawerPath(next.slug)
          : `${basePath}/${next.slug}`
      )
    },
    [basePath, onSectionSelect, router]
  )
  const handleCollapsedChange = useCallback(() => {
    const nextCollapsed = !resolvedCollapsed
    if (onCollapsedChange) {
      onCollapsedChange(nextCollapsed)
      return
    }
    setInternalCollapsed(nextCollapsed)
  }, [onCollapsedChange, resolvedCollapsed])

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col px-0.5",
        showHeader ? "gap-2.5 py-1" : "py-0"
      )}
      aria-label="Strategic roadmap"
    >
      {showHeader ? (
        <header className="flex min-h-8 items-center">
          <RoadmapNavigatorHeaderButton
            aria-controls="roadmap-section-picker-trigger"
            aria-expanded={!resolvedCollapsed}
            onClick={handleCollapsedChange}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-2",
                ROADMAP_TOC_TITLE_CLASS_NAME
              )}
            >
              <span className="truncate">Core Documents</span>
            </span>
            <ChevronDownIcon
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                resolvedCollapsed && "-rotate-90"
              )}
              aria-hidden
            />
          </RoadmapNavigatorHeaderButton>
        </header>
      ) : null}
      {resolvedCollapsed ? null : (
        <div className={cn("min-h-0", showHeader ? "pb-1" : "pt-0 pb-2.5")}>
          <RoadmapEditorToc
            tocItems={tocItems}
            activeSectionId={activeSectionId ?? ""}
            drafts={resolvedDrafts}
            openGroups={openGroups}
            tocIndicator={tocIndicator}
            tocRailOffset={tocRailOffset}
            sectionsListRef={sectionsListRef}
            onSectionSelect={handleSectionClick}
            onToggleGroup={handleToggleGroup}
            isFrameworkSection={isFrameworkSection}
            resolveSectionStatus={resolveRoadmapSectionStatus}
          />
        </div>
      )}
    </section>
  )
}
