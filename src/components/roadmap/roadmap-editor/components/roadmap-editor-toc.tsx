import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import {
  RoadmapTocStatusDot,
  RoadmapTocCompletedRailSegment,
  RoadmapTocCompletionCheck,
} from "@/components/roadmap/roadmap-status-indicators"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import type { CSSProperties, RefObject } from "react"

import { Button } from "@/components/ui/button"
import { SectionRailIndicator } from "@/components/ui/section-rail-indicator"
import { cn } from "@/lib/utils"
import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"

import type { RoadmapDraft, RoadmapTocItem } from "../types"

function resolveRoadmapTocButtonStateClassName({
  isActive,
  status,
}: {
  isActive: boolean
  status: RoadmapSectionStatus
}) {
  return isActive || status === "complete"
    ? "text-foreground"
    : "text-muted-foreground hover:text-foreground"
}

type RoadmapEditorTocProps = {
  tocItems: RoadmapTocItem[]
  activeSectionId: string
  drafts: Record<string, RoadmapDraft>
  openGroups: Record<string, boolean>
  tocIndicator: { top: number; height: number; visible: boolean }
  tocRailOffset?: string
  sectionsListRef: RefObject<HTMLDivElement | null>
  onSectionSelect: (next: { id: string; slug: string }) => void
  onToggleGroup: (groupId: string) => void
  isFrameworkSection: (section: RoadmapSection) => boolean
  resolveSectionStatus: (
    section: RoadmapSection,
    draft?: RoadmapDraft | null
  ) => RoadmapSectionStatus
}

export function RoadmapEditorToc({
  tocItems,
  activeSectionId,
  drafts,
  openGroups,
  tocIndicator,
  tocRailOffset = "0.25rem",
  sectionsListRef,
  onSectionSelect,
  onToggleGroup,
  isFrameworkSection,
  resolveSectionStatus,
}: RoadmapEditorTocProps) {
  return (
    <div
      ref={sectionsListRef}
      {...getReactGrabOwnerProps({
        ownerId: "roadmap-editor:navigation",
        component: "RoadmapEditorToc",
        source:
          "src/components/roadmap/roadmap-editor/components/roadmap-editor-toc.tsx",
        slot: "root",
      })}
      id="roadmap-section-picker-trigger"
      className="relative w-full min-w-0 space-y-1.5 pr-2 pl-4 text-sm"
      style={
        {
          "--roadmap-toc-rail-offset": tocRailOffset,
          "--roadmap-toc-content-offset": "1rem",
        } as CSSProperties
      }
    >
      <span
        aria-hidden
        className="bg-border/60 absolute top-0 left-[var(--roadmap-toc-rail-offset)] h-full w-px rounded-full"
      />
      <SectionRailIndicator
        {...tocIndicator}
        className="left-[var(--roadmap-toc-rail-offset)] z-10"
      />
      {tocItems.map((item) => {
        if (item.type === "group") {
          const groupOpen = openGroups[item.section.id] ?? true
          const isActive = item.section.id === activeSectionId
          const draft = drafts[item.section.id]
          const draftTitle = draft?.title?.trim()
          const displayTitle = isFrameworkSection(item.section)
            ? item.section.templateTitle
            : draftTitle || item.section.title?.trim() || ""
          const itemStatus = resolveSectionStatus(item.section, draft)
          return (
            <div
              key={item.section.id}
              className="snap-start snap-always space-y-1"
            >
              <div className="group relative flex items-center gap-2">
                {itemStatus === "complete" ? (
                  <RoadmapTocCompletedRailSegment />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-toc-item
                  data-active={isActive}
                  data-status={itemStatus}
                  data-toc-id={item.section.id}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "h-auto min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    resolveRoadmapTocButtonStateClassName({
                      isActive,
                      status: itemStatus,
                    })
                  )}
                  onClick={() =>
                    onSectionSelect({
                      id: item.section.id,
                      slug: item.section.slug,
                    })
                  }
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <RoadmapTocStatusDot status={itemStatus} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {displayTitle}
                    </span>
                  </span>
                  <RoadmapTocCompletionCheck status={itemStatus} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-foreground h-7 w-7 rounded-md transition",
                    groupOpen && "text-foreground"
                  )}
                  aria-label={
                    groupOpen
                      ? "Collapse section group"
                      : "Expand section group"
                  }
                  aria-expanded={groupOpen}
                  onClick={() => onToggleGroup(item.section.id)}
                >
                  <ChevronDownIcon
                    className={cn(
                      "h-4 w-4 transition-transform",
                      groupOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </Button>
              </div>
              {groupOpen
                ? item.children.map((child) => {
                    const childIsActive = child.id === activeSectionId
                    const childDraft = drafts[child.id]
                    const childTitle = childDraft?.title?.trim()
                    const childDisplayTitle = isFrameworkSection(child)
                      ? child.templateTitle
                      : childTitle || child.title?.trim() || ""
                    const childStatus = resolveSectionStatus(child, childDraft)
                    return (
                      <div
                        key={child.id}
                        className="group relative flex snap-start snap-always items-center gap-2"
                      >
                        {childStatus === "complete" ? (
                          <RoadmapTocCompletedRailSegment />
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-toc-item
                          data-active={childIsActive}
                          data-status={childStatus}
                          data-toc-id={child.id}
                          aria-current={childIsActive ? "page" : undefined}
                          className={cn(
                            "h-auto min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 pl-6 text-left transition-colors",
                            resolveRoadmapTocButtonStateClassName({
                              isActive: childIsActive,
                              status: childStatus,
                            })
                          )}
                          onClick={() =>
                            onSectionSelect({ id: child.id, slug: child.slug })
                          }
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <RoadmapTocStatusDot status={childStatus} />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                              {childDisplayTitle}
                            </span>
                          </span>
                          <RoadmapTocCompletionCheck status={childStatus} />
                        </Button>
                      </div>
                    )
                  })
                : null}
            </div>
          )
        }

        const isActive = item.section.id === activeSectionId
        const draft = drafts[item.section.id]
        const draftTitle = draft?.title?.trim()
        const displayTitle = isFrameworkSection(item.section)
          ? item.section.templateTitle
          : draftTitle || item.section.title?.trim() || ""
        const itemStatus = resolveSectionStatus(item.section, draft)

        return (
          <div
            key={item.section.id}
            className="group relative flex snap-start snap-always items-center gap-2"
          >
            {itemStatus === "complete" ? (
              <RoadmapTocCompletedRailSegment />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-toc-item
              data-active={isActive}
              data-status={itemStatus}
              data-toc-id={item.section.id}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-auto min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                resolveRoadmapTocButtonStateClassName({
                  isActive,
                  status: itemStatus,
                })
              )}
              onClick={() =>
                onSectionSelect({
                  id: item.section.id,
                  slug: item.section.slug,
                })
              }
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <RoadmapTocStatusDot status={itemStatus} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {displayTitle}
                </span>
              </span>
              <RoadmapTocCompletionCheck status={itemStatus} />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
